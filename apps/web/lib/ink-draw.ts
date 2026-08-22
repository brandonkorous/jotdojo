import type { Stroke } from "@jotdojo/domain";
import type { InkSurface } from "./ink-surface";
import type { InkSelection } from "./ink-selection";
import { paintLasso, paintSelection, paintStroke } from "./ink-paint";

/**
 * Putting the page on the two canvases. ADR-030.
 *
 * Split from the engine, which is a state machine: what the page IS and how it
 * is drawn are different jobs, and only one of them cares about pointer events.
 */

/** The committed layer: every finished stroke. */
export function drawPage(surface: InkSurface, strokes: readonly Stroke[]) {
  surface.clearCommitted();
  for (const stroke of strokes) paintStroke(surface.cctx, stroke);
}

/** The live layer, minus the stroke under the pen: the lasso being drawn, or
 *  the marquee around what it caught. */
export function drawOverlay(surface: InkSurface, sel: InkSelection) {
  surface.clearLive();
  const path = sel.path;
  if (path) paintLasso(surface.lctx, path);
  else if (sel.marquee) paintSelection(surface.lctx, sel.marquee);
}
