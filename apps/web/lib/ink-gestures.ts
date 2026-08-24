import type { InkViewport, Pinch } from "./ink-viewport";

/**
 * Two fingers move the camera; one finger draws. ADR-053.
 *
 * Pan and zoom are the same formula -- a two-finger drag with unchanged spread
 * falls out of `applyPinch` as a pure pan -- so there is no separate pan path
 * to get wrong. Only `touch` participates; pen and mouse pass straight through.
 *
 * IT CAN FEED ITSELF, and that is what unfenced the camera. ADR-102. Given an
 * `outer` element it listens there in the CAPTURE phase, so a pinch reaches it
 * before the surface underneath -- and the surface underneath may be the
 * typing spine, which takes no pointers from the ink layer at all. Without an
 * outer element it is driven by InkInput exactly as before.
 */

export type GestureHost = {
  readonly view: InkViewport;
  /** The screen box of the drawing surface, for client -> surface coordinates. */
  rect(): { left: number; top: number };
  /** A gesture took over mid-stroke. Whatever one finger was doing is void. */
  abortInput(): void;
  /** The camera moved. The host decides what, if anything, React hears. */
  onView(): void;
  /**
   * Something the camera must keep its hands off.
   *
   * A textarea -- the spine or a note on the plane -- owns scrolling its own
   * words and putting a caret between them, and a pinch that panned the world
   * out from under a half-selected sentence is not a camera gesture people
   * asked for.
   */
  ignores?(target: EventTarget | null): boolean;
};

/** One wheel notch is 100+ deltaY, so an unclamped exponential is a 30x jump. */
const MIN_WHEEL_ZOOM = 0.8;
const MAX_WHEEL_ZOOM = 1.25;
const WHEEL_DIVISOR = 320;

/** deltaMode 1 counts lines and 2 counts pages. Both are rare, and both are
 *  silently wrong by two orders of magnitude if read as pixels. */
const LINE_PX = 16;
const PAGE_PX = 800;

type Touch = { x: number; y: number };

const spread = (a: Touch, b: Touch) => Math.hypot(a.x - b.x, a.y - b.y);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A wheel delta in pixels, whatever unit the browser chose to report it in. */
export function wheelPixels(
  e: { deltaX: number; deltaY: number; deltaMode: number },
): { dx: number; dy: number } {
  const s = e.deltaMode === 1 ? LINE_PX : e.deltaMode === 2 ? PAGE_PX : 1;
  return { dx: e.deltaX * s, dy: e.deltaY * s };
}

/** Exponential, so zooming in and back out by the same delta returns exactly
 *  where it started -- and clamped, because one notch is 100+ deltaY. */
export function wheelZoom(dy: number): number {
  return clamp(Math.exp(-dy / WHEEL_DIVISOR), MIN_WHEEL_ZOOM, MAX_WHEEL_ZOOM);
}

export class ViewGestures {
  private readonly touches = new Map<number, Touch>();
  private pinch: Pinch | null = null;
  /**
   * True from the moment a gesture starts until EVERY finger has lifted.
   *
   * Without it, lifting one of two fingers hands the survivor a stroke it
   * never started -- a line drawn from wherever the pinch happened to end.
   */
  private claimed = false;

  /** Where the listeners went: the outer element when there is one, so a
   *  gesture over the spine is seen, and the drawing surface otherwise. */
  private readonly on: HTMLElement;
  /** Whether this instance drives itself from listeners. When false, InkInput
   *  calls `down`/`move`/`up` and must keep doing so. */
  private readonly selfFed: boolean;

  constructor(
    private readonly el: HTMLElement,
    private readonly host: GestureHost,
    outer?: HTMLElement,
  ) {
    this.on = outer ?? el;
    this.selfFed = outer !== undefined;
    // Imperative, because React's delegated onWheel cannot be non-passive and
    // a passive listener may not preventDefault the browser's page zoom.
    this.on.addEventListener("wheel", this.wheel, { passive: false, capture: this.selfFed });
    if (!this.selfFed) return;
    // Capture, so the pinch is seen before whatever is under the fingers --
    // which on the spine is a textarea that would otherwise scroll instead.
    this.on.addEventListener("pointerdown", this.onDown, true);
    this.on.addEventListener("pointermove", this.onMove, true);
    this.on.addEventListener("pointerup", this.onUp, true);
    this.on.addEventListener("pointercancel", this.onUp, true);
  }

  destroy() {
    this.on.removeEventListener("wheel", this.wheel, { capture: this.selfFed });
    this.on.removeEventListener("pointerdown", this.onDown, true);
    this.on.removeEventListener("pointermove", this.onMove, true);
    this.on.removeEventListener("pointerup", this.onUp, true);
    this.on.removeEventListener("pointercancel", this.onUp, true);
    this.touches.clear();
    this.pinch = null;
  }

  /** Whether the camera currently owns the pointers. Read by InkInput when
   *  this instance feeds itself, in place of handing it the events. */
  get claiming() { return this.claimed; }

  private onDown = (e: PointerEvent) => {
    if (this.host.ignores?.(e.target)) return;
    if (this.down(e)) e.preventDefault();
  };

  private onMove = (e: PointerEvent) => {
    if (this.move(e)) e.preventDefault();
  };

  private onUp = (e: PointerEvent) => { this.up(e); };

  /** True when the gesture layer consumed the event and drawing must not run. */
  down(e: PointerEvent): boolean {
    if (e.pointerType !== "touch") return false;
    this.touches.set(e.pointerId, this.at(e));
    if (this.touches.size < 2) return this.claimed;
    this.begin();
    return true;
  }

  move(e: PointerEvent): boolean {
    if (e.pointerType !== "touch" || !this.touches.has(e.pointerId)) return false;
    this.touches.set(e.pointerId, this.at(e));
    const p = this.pinch;
    if (!p) return this.claimed;
    const [a, b] = [...this.touches.values()];
    if (!a || !b) return true;
    this.host.view.applyPinch(p, (a.x + b.x) / 2, (a.y + b.y) / 2, spread(a, b));
    this.host.onView();
    return true;
  }

  up(e: PointerEvent): boolean {
    if (e.pointerType !== "touch") return false;
    this.touches.delete(e.pointerId);
    // Re-anchor rather than keep a Pinch whose fingers are gone: with three
    // down, lifting one would otherwise teleport the page to the new pair.
    if (this.touches.size >= 2) this.begin();
    else this.pinch = null;
    if (this.touches.size > 0) return this.claimed;
    const was = this.claimed;
    this.claimed = false;
    return was;
  }

  /** Anchor on the world point under the midpoint, and on the current spread.
   *  Every later move is measured against these, so drift cannot accumulate. */
  private begin() {
    const [a, b] = [...this.touches.values()];
    if (!a || !b) return;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const v = this.host.view;
    this.pinch = { wx: v.toWorldX(mx), wy: v.toWorldY(my), d0: spread(a, b), k0: v.k };
    if (!this.claimed) this.host.abortInput();
    this.claimed = true;
  }

  private at(e: { clientX: number; clientY: number }): Touch {
    const r = this.host.rect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private wheel = (e: WheelEvent) => {
    // A textarea scrolls its own words. Everywhere else the wheel moves the
    // canvas, which is what an endless surface owes a mouse.
    if (this.host.ignores?.(e.target)) return;
    // Always prevented: ctrl+wheel is the browser's own page zoom, and over an
    // endless canvas a plain wheel should move the canvas, not the document.
    e.preventDefault();
    const { dx, dy } = wheelPixels(e);
    const p = this.at(e);
    const v = this.host.view;

    if (e.ctrlKey || e.metaKey) {
      if (v.zoomAbout(p.x, p.y, wheelZoom(dy))) this.host.onView();
      return;
    }

    if (dx === 0 && dy === 0) return;
    v.panBy(-dx, -dy);
    this.host.onView();
  };
}
