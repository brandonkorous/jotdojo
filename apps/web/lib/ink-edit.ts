import type { Stroke } from "@jotacular/domain";
import { dist2 } from "./ink-geometry";
import { ERASE_RADIUS } from "./ink-paint";

/**
 * Operations that produce a new stroke set. Pure, so the engine stays a state
 * machine and these stay testable without a canvas. ADR-030.
 */

/**
 * Stroke-wise erase, not pixel-wise: a raster page could never be re-recognised
 * by a better model, because there would be no strokes left to read. docs/08.
 *
 * Returns null when nothing was within reach, so callers can skip a repaint
 * rather than redrawing the page on every sample of a miss. When something did
 * go, it names WHICH strokes went: that is what lets the erase be sent as
 * "remove these" instead of "here is the whole page instead", and it is the
 * difference between erasing a word and erasing what another device just drew.
 * ADR-058.
 */
export function eraseNear(
  strokes: readonly Stroke[], x: number, y: number, radius = ERASE_RADIUS,
): { kept: Stroke[]; removed: Stroke[] } | null {
  const kept: Stroke[] = [];
  const removed: Stroke[] = [];
  for (const stroke of strokes) {
    const hit = stroke.pts.some((p) => dist2(p[0], p[1], x, y) <= radius ** 2);
    (hit ? removed : kept).push(stroke);
  }
  return removed.length === 0 ? null : { kept, removed };
}

/**
 * The topmost stroke under a point, or null. ADR-084.
 *
 * Last match wins, because strokes are painted in array order and the one a
 * person can see is the one drawn most recently. `eraseNear` deliberately takes
 * everything within reach -- rubbing out is a sweep -- while picking one thing
 * up has to choose, and choosing the buried stroke is never right.
 */
export function topmostAt(
  strokes: readonly Stroke[], x: number, y: number, radius = ERASE_RADIUS,
): Stroke | null {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const stroke = strokes[i]!;
    if (stroke.pts.some((p) => dist2(p[0], p[1], x, y) <= radius ** 2)) return stroke;
  }
  return null;
}

/** Remove an exact set, by identity. Used by lasso delete. ADR-033. */
export function without(strokes: readonly Stroke[], doomed: ReadonlySet<Stroke>): Stroke[] {
  return strokes.filter((s) => !doomed.has(s));
}

/**
 * Recolour or resize an existing set, in place. ADR-045.
 *
 * In place, and deliberately: the selection holds references to these exact
 * objects, and replacing them would leave the marquee pointing at strokes that
 * are no longer on the page. Dragging already works this way.
 *
 * Returns false when nothing changed, so a caller can skip the repaint and the
 * resend that goes with it.
 */
export function restyle(
  chosen: Iterable<Stroke>, patch: { color?: string; width?: number },
): boolean {
  let touched = false;
  for (const stroke of chosen) {
    if (patch.color !== undefined && stroke.color !== patch.color) {
      stroke.color = patch.color;
      touched = true;
    }
    // A marker has one width (docs/08), so resizing skips it rather than
    // turning somebody's highlight into a thin coloured line.
    if (patch.width !== undefined && stroke.tool !== "highlighter"
        && stroke.width !== patch.width) {
      stroke.width = patch.width;
      touched = true;
    }
  }
  return touched;
}
