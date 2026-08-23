import type { Stroke } from "@jotacular/domain";
import type { InkSurface } from "./ink-surface";
import type { InkSelection } from "./ink-selection";
import type { StrokeCapture } from "./ink-capture";
import type { Dirty } from "./ink-frame";
import type { StrokeIndex } from "./ink-index";
import { paintLasso, paintSelection, paintStroke, paintTextRect } from "./ink-paint";
import type { Bounds } from "./ink-geometry";

/**
 * Putting the page on the two canvases. ADR-030.
 *
 * Split from the engine, which is a state machine: what the page IS and how it
 * is drawn are different jobs, and only one of them cares about pointer events.
 */

/** The committed layer: every finished stroke that is on screen. */
export function drawPage(surface: InkSurface, strokes: readonly Stroke[], index: StrokeIndex) {
  surface.clearCommitted();
  surface.applyView();
  for (const stroke of index.visible(strokes, surface.visibleWorld())) {
    paintStroke(surface.cctx, stroke);
  }
}

/** The live layer, minus the stroke under the pen: the lasso being drawn, or
 *  the marquee around what it caught. */
export function drawOverlay(
  surface: InkSurface, sel: InkSelection, k = 1, pendingText: Bounds | null = null,
) {
  surface.clearLive();
  surface.applyView();
  // The box being dragged out comes first: while it is happening there is no
  // lasso and no marquee, and it must not be hidden if there ever is.
  if (pendingText) paintTextRect(surface.lctx, pendingText, k);
  const path = sel.path;
  if (path) paintLasso(surface.lctx, path, k);
  else if (sel.marquee) paintSelection(surface.lctx, sel.marquee, k);
}

/** Everything a frame might need to draw. The engine owns these; this module
 *  only reads them. */
export type Scene = {
  strokes: readonly Stroke[];
  sel: InkSelection;
  capture: StrokeCapture;
  index: StrokeIndex;
  /** The zoom, so chrome drawn over the page stays a constant size on screen. */
  k: number;
  /** A text box being dragged out, which exists nowhere else until it lands. */
  pendingText: Bounds | null;
};

/**
 * One frame, in the only order that composes.
 *
 * `drawOverlay` clears the live layer, so the stroke under the pen has to go
 * back on top of it rather than beside it.
 */
export function drawFrame(surface: InkSurface, dirty: ReadonlySet<Dirty>, scene: Scene) {
  if (dirty.has("page")) drawPage(surface, scene.strokes, scene.index);
  if (!dirty.has("overlay") && !dirty.has("live")) return;
  drawOverlay(surface, scene.sel, scene.k, scene.pendingText);
  if (dirty.has("live") && scene.capture.active) {
    paintStroke(surface.lctx, scene.capture.preview());
  }
}

/** Both layers, now. Resizing destroys the backing store, and waiting a frame
 *  to redraw it is a visible flash of blank paper. */
export function drawAll(surface: InkSurface, scene: Scene) {
  drawPage(surface, scene.strokes, scene.index);
  drawOverlay(surface, scene.sel, scene.k, scene.pendingText);
}

/** Move a finished stroke onto the durable layer, so it stops being repainted
 *  from scratch every frame. */
export function commitStroke(surface: InkSurface, stroke: Stroke) {
  surface.applyView();
  paintStroke(surface.cctx, stroke);
  surface.clearLive();
}
