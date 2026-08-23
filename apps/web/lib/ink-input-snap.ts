import type { StrokeCapture } from "./ink-capture";
import { classify, snap } from "./ink-shapes";

/**
 * When a rough shape becomes a real one. ADR-066.
 *
 * Split from ink-input.ts, which routes pointer events per tool and had grown
 * to hold this as well. They are two jobs: routing is about which tool the
 * pointer belongs to, and this is about what a single stroke turns out to be.
 * The seam is that this never looks at a PointerEvent -- it watches a capture
 * that is already in flight.
 */

/**
 * Hold this long after the pen stops, and a rough shape becomes a real one.
 *
 * Long enough not to fire on the pause between two letters, short enough that
 * somebody who meant it does not think it is broken. There is no confirm step:
 * a popup would put a DECISION in the capture moment, which docs/02 forbids.
 * Lifting immediately keeps exactly what was drawn.
 */
const HOLD_MS = 420;

/** How far the pen may drift and still count as held, in SCREEN pixels. */
const HOLD_SLOP = 3;

/**
 * Watches one stroke for the pause that means "make this a shape".
 *
 * Fires AT MOST ONCE per stroke. A snapped shape that kept re-snapping would
 * fight anybody still moving, and the second snap would be measured against
 * points the first one replaced.
 */
export class HoldToSnap {
  private lastMovedAt = 0;
  private done = false;

  /** A new stroke started. */
  reset(now: number) {
    this.lastMovedAt = now;
    this.done = false;
  }

  /**
   * Called once per pointer move, with how many points the capture held before
   * this batch. Distance is measured in SCREEN pixels so the slop means the
   * same thing at any zoom.
   */
  check(capture: StrokeCapture, pointsBefore: number, k: number) {
    if (this.done) return;

    const pts = capture.points;
    const now = performance.now();
    const last = pts[pts.length - 1];
    const prev = pts[Math.max(0, pointsBefore - 1)];
    const moved = last && prev
      ? Math.hypot(last[0] - prev[0], last[1] - prev[1]) * k > HOLD_SLOP
      : false;

    if (moved) { this.lastMovedAt = now; return; }
    if (now - this.lastMovedAt < HOLD_MS) return;

    const guess = classify(pts);
    // Still done: an unrecognised squiggle is answered once and left alone,
    // rather than re-classified on every sample for the rest of the stroke.
    if (!guess) { this.done = true; return; }
    // The same stroke with different points. A new one would draw the shape
    // twice on any device watching this page.
    capture.reshape(snap(pts, guess.kind));
    this.done = true;
  }
}
