import type { Stroke } from "@jotdojo/domain";
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
 * rather than redrawing the page on every sample of a miss.
 */
export function eraseNear(
  strokes: readonly Stroke[], x: number, y: number, radius = ERASE_RADIUS,
): Stroke[] | null {
  const kept = strokes.filter((stroke) =>
    !stroke.pts.some((p) => dist2(p[0], p[1], x, y) <= radius ** 2));
  return kept.length === strokes.length ? null : kept;
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
