import type { Stroke } from "@jotacular/domain";
import { strokeBounds, intersects, type Bounds } from "@jotacular/ink-render";

/**
 * Which strokes are worth painting. ADR-053.
 *
 * A bounded page could repaint everything and stay honest. An endless one
 * cannot: the work per frame would grow with the size of the board rather than
 * the size of the window.
 *
 * The boxes come from `@jotacular/ink-render` rather than a second copy here, so
 * the browser and the recognition pipeline can never disagree about where a
 * stroke is.
 */
export class StrokeIndex {
  private readonly cache = new WeakMap<Stroke, Bounds | null>();

  boundsOf(stroke: Stroke): Bounds | null {
    let box = this.cache.get(stroke);
    if (box === undefined) {
      box = strokeBounds(stroke);
      this.cache.set(stroke, box);
    }
    return box;
  }

  /**
   * Forget a stroke's box after it moved or changed width.
   *
   * `InkSelection.dragTo` and `restyle` both mutate strokes IN PLACE, by
   * design -- so the object identity survives and a stale box survives with it.
   * A missed call here is a stroke that vanishes when you pan near it, which is
   * far harder to recognise than a slow repaint.
   */
  invalidate(strokes: Iterable<Stroke>) {
    for (const stroke of strokes) this.cache.delete(stroke);
  }

  /** Strokes are culled, never clipped: one that is only partly on screen is
   *  still painted whole, so nothing changes at the edges. */
  visible(strokes: readonly Stroke[], view: Bounds): readonly Stroke[] {
    return strokes.filter((stroke) => {
      const box = this.boundsOf(stroke);
      return box ? intersects(box, view) : false;
    });
  }
}
