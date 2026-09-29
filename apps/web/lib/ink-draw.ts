import type { Link, Stroke } from "@jotacular/domain";
import type { InkSurface } from "./ink-surface";
import type { InkSelection } from "./ink-selection";
import type { StrokeCapture } from "./ink-capture";
import type { Dirty } from "./ink-frame";
import type { StrokeIndex } from "./ink-index";
import {
  paintAim, paintLasso, paintLink, paintSelection, paintStroke, paintTextRect,
} from "./ink-paint";
import type { Bounds } from "./ink-geometry";
import { paintGrips } from "./ink-paint-grip";
import type { GripOverlay } from "./ink-grip-overlay";
import { paintHighlights } from "./ink-paint-highlight";
import type { Segment } from "@jotacular/ink-render";

/**
 * Putting the page on the two canvases. ADR-030.
 *
 * Split from the engine, which is a state machine: what the page IS and how it
 * is drawn are different jobs, and only one of them cares about pointer events.
 */

/** The committed layer: every finished stroke that is on screen, and the
 *  arrows underneath them. */
export function drawPage(surface: InkSurface, scene: Scene) {
  surface.clearCommitted();
  surface.applyView();
  // Arrows first, so handwriting drawn over one stays on top -- and so an
  // arrow between two cards passes under them, which is what ink does. ADR-108.
  for (const { link, seg } of scene.links()) paintLink(surface.cctx, seg, link);
  // Highlights first, laid once so overlaps do not stack; ink on top of them,
  // so the words stay crisp. ADR-132.
  const shown = scene.index.visible(scene.strokes, surface.visibleWorld());
  paintHighlights(surface.cctx, shown.filter((s) => s.tool === "highlighter"));
  for (const stroke of shown) if (stroke.tool !== "highlighter") paintStroke(surface.cctx, stroke);
}

/** The live layer, minus the stroke under the pen: the lasso being drawn, the
 *  marquee around what it caught, or the arrow being aimed. */
export function drawOverlay(surface: InkSurface, scene: Scene) {
  surface.clearLive();
  surface.applyView();
  // The box being dragged out comes first: while it is happening there is no
  // lasso and no marquee, and it must not be hidden if there ever is.
  if (scene.pendingText) paintTextRect(surface.lctx, scene.pendingText, scene.k);
  if (scene.aim) paintAim(surface.lctx, scene.aim, scene.k);
  const path = scene.sel.path;
  const one = path ? null : scene.sel.frame;
  scene.grips?.draw(one, scene.k);
  if (path) paintLasso(surface.lctx, path, scene.k);
  else if (one && !scene.grips) paintGrips(surface.lctx, one, scene.k);
  else if (!one && scene.sel.marquee) paintSelection(surface.lctx, scene.sel.marquee, scene.k);
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
  /**
   * The arrows, resolved to lines. Resolving them is the link store's job;
   * this module never asks where an object is. ADR-108.
   *
   * A THUNK, and that is not a style choice. Resolving an end walks the page's
   * objects, and the scene is read on every frame -- including every frame of
   * a stroke. Only `drawPage` calls it, so a pen sample costs nothing.
   */
  links: () => ReadonlyArray<{ link: Link; seg: Segment }>;
  /** The arrow being aimed, which exists nowhere else until it lands. */
  aim: Segment | null;
  /** Where the handles go when there is an object plane to put them on. */
  grips?: GripOverlay;
};

/**
 * One frame, in the only order that composes.
 *
 * `drawOverlay` clears the live layer, so the stroke under the pen has to go
 * back on top of it rather than beside it.
 */
export function drawFrame(surface: InkSurface, dirty: ReadonlySet<Dirty>, scene: Scene) {
  if (dirty.has("page")) drawPage(surface, scene);
  if (!dirty.has("overlay") && !dirty.has("live")) return;
  drawOverlay(surface, scene);
  if (dirty.has("live") && scene.capture.active) {
    const live = scene.capture.preview();
    if (live.tool === "highlighter") paintHighlights(surface.lctx, [live]);
    else paintStroke(surface.lctx, live);
  }
}

/** Both layers, now. Resizing destroys the backing store, and waiting a frame
 *  to redraw it is a visible flash of blank paper. */
export function drawAll(surface: InkSurface, scene: Scene) {
  drawPage(surface, scene);
  drawOverlay(surface, scene);
}

/** Move a finished stroke onto the durable layer, so it stops being repainted
 *  from scratch every frame. False for a highlight: it has to be laid with the
 *  others or it stacks on them, so the page is repainted instead. ADR-132. */
export function commitStroke(surface: InkSurface, stroke: Stroke): boolean {
  surface.clearLive();
  if (stroke.tool === "highlighter") return false;
  surface.applyView();
  paintStroke(surface.cctx, stroke);
  return true;
}
