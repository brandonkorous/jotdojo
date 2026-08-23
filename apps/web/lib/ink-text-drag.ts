import type { Point } from "@jotdojo/domain";
import type { Bounds } from "./ink-geometry";

/**
 * Dragging a text box out, corner to corner. ADR-078.
 *
 * A separate gesture from the tap that places one, and deliberately the SECOND
 * way rather than the replacement. docs/02 calls sub-second capture
 * non-negotiable and the risk register calls slow capture fatal; a surface that
 * made you draw a rectangle before you could type would have added an
 * interaction to the one path the product exists to protect. So: tap and get a
 * sensible box, drag and get the box you drew.
 *
 * The threshold is the whole design. Below it the drag never happened and the
 * gesture decays into a tap, which means a slightly unsteady finger costs
 * nothing -- the same bargain hold-to-snap makes about ignoring a suggestion.
 */

/**
 * How far, in SCREEN pixels, before a tap becomes a drag.
 *
 * Screen rather than document, so it means the same thing at every zoom. Both
 * dimensions have to clear it: a horizontal swipe with no height is somebody
 * missing, not somebody drawing a box.
 */
const DRAG_MIN = 14;

export type TextDragEnd =
  | { kind: "drawn"; rect: Bounds }
  | { kind: "tap"; x: number; y: number };

export class TextDrag {
  private from: Point | null = null;

  begin(p: Point) { this.from = p; }

  get active() { return this.from !== null; }

  /** The rectangle so far, or null while it is still a tap. */
  move(p: Point, k: number): Bounds | null {
    if (!this.from) return null;
    const rect = between(this.from, p);
    return large(rect, k) ? rect : null;
  }

  /** What the gesture turned out to be. Null when it never started. */
  end(p: Point, k: number): TextDragEnd | null {
    const from = this.from;
    this.from = null;
    if (!from) return null;
    const rect = between(from, p);
    if (large(rect, k)) return { kind: "drawn", rect };
    // The tap lands where the finger went DOWN, not where it came up. A box
    // that appeared a few pixels from the tap would read as a misfire.
    return { kind: "tap", x: from[0], y: from[1] };
  }

  cancel() { this.from = null; }
}

/** Corner to corner, in either direction -- dragging up and left is a normal
 *  way to draw a box and must not produce a negative width. */
function between(a: Point, b: Point): Bounds {
  return {
    x: Math.min(a[0], b[0]),
    y: Math.min(a[1], b[1]),
    w: Math.abs(b[0] - a[0]),
    h: Math.abs(b[1] - a[1]),
  };
}

const large = (r: Bounds, k: number) => r.w * k >= DRAG_MIN && r.h * k >= DRAG_MIN;
