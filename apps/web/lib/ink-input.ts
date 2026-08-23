import type { Point, Stroke } from "@jotdojo/domain";
import { isDrawing, type InkTool } from "./canvas-tool";
import type { StrokeCapture } from "./ink-capture";
import type { InkSelection } from "./ink-selection";
import type { InkSurface } from "./ink-surface";
import type { InkViewport } from "./ink-viewport";
import { bindPointer, PalmGuard, pointFrom, samplesOf } from "./ink-pointer";
import { ViewGestures } from "./ink-gestures";
import { classify, snap } from "./ink-shapes";

/**
 * The pointer state machine, split from the page it draws on. ADR-053.
 *
 * One finger, one pen, one stroke at a time. What is DRAWN lives in the engine;
 * what a pointer is currently DOING lives here, and the two grew apart the
 * moment the canvas gained a camera.
 */

/**
 * Hold this long after the pen stops, and a rough shape becomes a real one.
 *
 * Long enough not to fire on the pause between two letters, short enough that
 * somebody who meant it does not think it is broken. There is no confirm step:
 * a popup would put a DECISION in the capture moment, which docs/02 forbids.
 * Lifting immediately keeps exactly what was drawn. ADR-066.
 */
const HOLD_MS = 420;

/** How far the pen may drift and still count as held, in SCREEN pixels. */
const HOLD_SLOP = 3;

/** What the input machine is allowed to ask of the page. Deliberately narrow:
 *  it may start, extend and finish things, and it may never paint. */
export type InputHost = {
  readonly surface: InkSurface;
  readonly view: InkViewport;
  readonly capture: StrokeCapture;
  readonly sel: InkSelection;
  readonly tool: InkTool;
  /** True when something was actually removed, so the drag knows to resend. */
  eraseAt(x: number, y: number): boolean;
  /** The erase drag ended; resend the page if it actually removed anything. */
  endErase(erased: boolean): void;
  commit(stroke: Stroke): void;
  /** Put a caret on the plane, in a box that is there or a new one. True when
   *  the plane took the tap, which is when the canvas must do nothing. */
  tapText(x: number, y: number): boolean;
  /** Let go of whatever has the caret. A pen coming down should not leave one
   *  blinking behind it. */
  blurText(): void;
  finishSelect(): void;
  dropSelection(): void;
  dragSelection(x: number, y: number): void;
  scheduleLive(): void;
  /** The camera moved. */
  onView(): void;
};

export class InkInput {
  private readonly palm = new PalmGuard();
  private penDown = false;
  /** Whether the active pointer is a stylus rather than a finger or a mouse. */
  private penPointer = false;
  private activePointer: number | null = null;
  private startedAt = 0;
  private erasedThisDrag = false;
  /** When the pointer last actually went anywhere, for hold-to-snap. */
  private lastMovedAt = 0;
  private snapped = false;
  private readonly unbind: () => void;
  private readonly gestures: ViewGestures;

  constructor(private readonly el: HTMLElement, private readonly host: InputHost) {
    this.unbind = bindPointer(el, { down: this.down, move: this.move, up: this.up });
    this.gestures = new ViewGestures(el, {
      view: host.view,
      rect: () => host.surface.rect(),
      abortInput: () => this.abort(),
      onView: () => host.onView(),
    });
  }

  destroy() {
    this.unbind();
    this.gestures.destroy();
  }

  /**
   * A gesture claimed the pointer mid-stroke.
   *
   * The erase flush is the subtle half: strokes are already gone locally, and
   * without it `up` never runs, so the page is never resent and the ink comes
   * back on reload -- vanished here, alive on the server.
   */
  private abort() {
    if (!this.penDown) return;
    this.penDown = false;
    this.activePointer = null;
    const host = this.host;
    if (host.tool === "eraser") host.endErase(this.erasedThisDrag);
    else if (host.tool === "select") host.dropSelection();
    else host.capture.abort();
    host.scheduleLive();
  }

  private pointAt(e: PointerEvent): Point {
    return pointFrom(e, this.host.surface.rect(), this.startedAt, this.host.view);
  }

  /**
   * While the stylus is on the glass, touch does nothing at all.
   *
   * Narrower than PalmGuard's page-wide latch, and it has to be: a resting
   * palm is often two contact points, which would otherwise read as a pinch
   * and pan the page out from under the nib. Between strokes fingers pan
   * freely, which is the iPad idiom people already have in their hands.
   */
  private get writingWithPen() { return this.penDown && this.penPointer; }

  private down = (e: PointerEvent) => {
    if (!this.writingWithPen && this.gestures.down(e)) return void e.preventDefault();
    if (!this.palm.accepts(e)) return;
    e.preventDefault();
    this.el.setPointerCapture(e.pointerId);
    this.activePointer = e.pointerId;
    this.penPointer = e.pointerType === "pen";
    this.penDown = true;
    this.startedAt = performance.now();
    this.erasedThisDrag = false;
    this.lastMovedAt = this.startedAt;
    this.snapped = false;

    const p = this.pointAt(e);
    const host = this.host;

    // The plane first, so a tap meant for a box never lands as a stroke under
    // one. An existing box takes its own tap natively -- the textarea is above
    // the canvas and pointer-events are on for this tool -- so what reaches
    // here is either empty ground or a box the hit test disagrees about.
    if (host.tool === "textbox") {
      host.tapText(p[0], p[1]);
      this.penDown = false;
      this.activePointer = null;
      return;
    }
    // Any other tool coming down means the caret is finished with.
    host.blurText();

    if (host.tool === "eraser") return void this.erase(p);

    if (host.tool === "select") {
      // Inside an existing marquee means "move this", not "start over" --
      // otherwise a selection could never be dragged, only redrawn.
      if (host.sel.covers(p[0], p[1])) return void host.sel.beginDrag(p[0], p[1]);
      host.dropSelection();
      host.sel.beginLasso(p);
      return void host.scheduleLive();
    }

    host.capture.begin(p);
    host.scheduleLive();
  };

  private move = (e: PointerEvent) => {
    // Before the guards below, which key on the ONE active pointer and would
    // otherwise drop the second finger of every pinch on the floor.
    if (!this.writingWithPen && this.gestures.move(e)) return void e.preventDefault();
    if (!this.penDown || e.pointerId !== this.activePointer) return;
    e.preventDefault();
    const host = this.host;

    if (host.tool === "eraser") return void this.erase(this.pointAt(e));

    if (host.tool === "select") {
      const p = this.pointAt(e);
      if (host.sel.dragging) return void host.dragSelection(p[0], p[1]);
      host.sel.extendLasso(p);
      return void host.scheduleLive();
    }

    // The hot path: hoist the rect and the camera once, then map every sample
    // the pen actually produced rather than the one per frame the event carries.
    const rect = host.surface.rect();
    const view = host.view;
    const before = host.capture.points.length;
    for (const sample of samplesOf(e)) {
      host.capture.extend(pointFrom(sample, rect, this.startedAt, view));
    }
    this.watchHold(before);
    host.scheduleLive();
  };

  /**
   * Still holding? Then that circle probably was one. ADR-066.
   *
   * Measured in SCREEN pixels, so the slop means the same thing at any zoom,
   * and it only ever fires once per stroke -- a snapped shape that kept
   * re-snapping would fight anyone still moving.
   */
  private watchHold(pointsBefore: number) {
    const host = this.host;
    if (this.snapped || !isDrawing(host.tool)) return;

    const pts = host.capture.points;
    const now = performance.now();
    const last = pts[pts.length - 1];
    const prev = pts[Math.max(0, pointsBefore - 1)];
    const moved = last && prev
      ? Math.hypot(last[0] - prev[0], last[1] - prev[1]) * host.view.k > HOLD_SLOP
      : false;

    if (moved) { this.lastMovedAt = now; return; }
    if (now - this.lastMovedAt < HOLD_MS) return;

    const guess = classify(pts);
    if (!guess) { this.snapped = true; return; }
    // The same stroke with different points. A new one would draw the shape
    // twice on any device watching this page.
    host.capture.reshape(snap(pts, guess.kind));
    this.snapped = true;
  }

  private up = (e: PointerEvent) => {
    if (this.gestures.up(e)) return;
    if (!this.penDown || e.pointerId !== this.activePointer) return;
    this.penDown = false;
    this.activePointer = null;
    if (this.el.hasPointerCapture(e.pointerId)) this.el.releasePointerCapture(e.pointerId);

    const host = this.host;
    if (host.tool === "eraser") return void host.endErase(this.erasedThisDrag);
    if (host.tool === "select") return void host.finishSelect();

    const stroke = host.capture.finish();
    if (stroke) host.commit(stroke);
  };

  private erase(p: Point) {
    if (this.host.eraseAt(p[0], p[1])) this.erasedThisDrag = true;
  }
}
