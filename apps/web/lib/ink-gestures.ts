import type { InkViewport, Pinch } from "./ink-viewport";

/**
 * Two fingers move the camera; one finger draws. ADR-053.
 *
 * Pan and zoom are the same formula -- a two-finger drag with unchanged spread
 * falls out of `applyPinch` as a pure pan -- so there is no separate pan path
 * to get wrong. Only `touch` participates; pen and mouse pass straight through.
 */

export type GestureHost = {
  readonly view: InkViewport;
  /** The screen box of the drawing surface, for client -> surface coordinates. */
  rect(): { left: number; top: number };
  /** A gesture took over mid-stroke. Whatever one finger was doing is void. */
  abortInput(): void;
  /** The camera moved. The host decides what, if anything, React hears. */
  onView(): void;
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

  constructor(private readonly el: HTMLElement, private readonly host: GestureHost) {
    // Imperative, because React's delegated onWheel cannot be non-passive and
    // a passive listener may not preventDefault the browser's page zoom.
    el.addEventListener("wheel", this.wheel, { passive: false });
  }

  destroy() {
    this.el.removeEventListener("wheel", this.wheel);
    this.touches.clear();
    this.pinch = null;
  }

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
