import type { Point } from "@jotacular/domain";

/**
 * What the lasso does with a pointer. ADR-033, ADR-084.
 *
 * Split out of ink-input.ts when that file reached the 250-line limit, and the
 * seam is a real one: routing a pointer to the tool holding it is one job, and
 * telling a tap from a loop is another. This is the only tool whose gesture
 * cannot be named until the pointer LIFTS -- a lasso and a tap begin
 * identically, and both are ordinary until they turn out not to be.
 */

/** What the select tool may ask of the page while a pointer is down. */
export type SelectHost = {
  readonly sel: {
    readonly dragging: boolean;
    covers(x: number, y: number): boolean;
    beginDrag(x: number, y: number): void;
    beginLasso(p: Point): void;
    extendLasso(p: Point): void;
  };
  tapSelect(x: number, y: number): void;
  finishSelect(): void;
  dropSelection(): void;
  dragSelection(x: number, y: number): void;
  scheduleLive(): void;
};

/**
 * Close enough to be a tap rather than a loop, in SCREEN pixels. Smaller than
 * the text-box threshold: this only has to survive an unsteady hand, not tell
 * two deliberate gestures apart. ADR-084.
 */
const TAP_SLOP = 6;

const near = (a: Point, b: Point, k: number) =>
  Math.hypot(b[0] - a[0], b[1] - a[1]) * k <= TAP_SLOP;

export class LassoInput {
  /** Where the gesture began, or null when it began inside a marquee. */
  private from: Point | null = null;

  /**
   * Returns where the gesture started, for `up` to measure against. Pressing
   * INSIDE an existing marquee means "move this", not "start over" -- otherwise
   * a selection could never be dragged, only redrawn.
   */
  down(host: SelectHost, p: Point) {
    if (host.sel.covers(p[0], p[1])) {
      this.from = null;
      return void host.sel.beginDrag(p[0], p[1]);
    }
    host.dropSelection();
    this.from = p;
    host.sel.beginLasso(p);
    host.scheduleLive();
  }

  move(host: SelectHost, p: Point) {
    if (host.sel.dragging) return void host.dragSelection(p[0], p[1]);
    host.sel.extendLasso(p);
    host.scheduleLive();
  }

  /** A loop that never went anywhere is a tap, and a tap means "that one". */
  up(host: SelectHost, p: Point, k: number) {
    const from = this.from;
    this.from = null;
    if (from && near(from, p, k)) return void host.tapSelect(from[0], from[1]);
    host.finishSelect();
  }

  /** A gesture took the pointer. Whatever was being drawn round is void. */
  abort(host: SelectHost) {
    this.from = null;
    host.dropSelection();
  }
}
