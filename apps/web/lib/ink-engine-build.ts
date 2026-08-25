import type { Stroke } from "@jotacular/domain";
import type { Scene } from "./ink-draw";
import type { EngineOptions } from "./ink-engine-options";
import { locate, type Page } from "./ink-engine-page";
import { Eraser } from "./ink-engine-erase";
import { LiveMerge } from "./ink-engine-live";
import { SelectionEditor } from "./ink-engine-select";
import { InkFraming } from "./ink-framing";
import type { StrokeIndex } from "./ink-index";
import { ObjectPlane } from "./ink-object-plane";
import { InkPainter } from "./ink-painter";
import { InkPins } from "./ink-pins";
import { InkSurface } from "./ink-surface";
import type { InkViewport } from "./ink-viewport";

/**
 * What is wired to what, once, at mount.
 *
 * Split out of ink-engine.ts at the size limit, and the seam is real: seven
 * collaborators, each needing a different handful of the engine's private
 * state, is a paragraph about ASSEMBLY sitting in the middle of a file about
 * BEHAVIOUR. The engine below it is a state machine over strokes; this is the
 * loom, and the two change for different reasons.
 *
 * Everything the parts need from the engine arrives as a closure, so nothing
 * here depends on the order the parts are built in.
 */
export type Wiring = {
  strokes: () => Stroke[];
  setStrokes: (next: Stroke[]) => void;
  /** What to paint, read at paint time -- a snapshot would be a frame stale. */
  scene: () => Scene;
  /** The page as one set of objects, for finding a commented thing. ADR-107. */
  page: () => Page;
  zoom: () => number;
  /** Finished strokes changed. */
  repaint: () => void;
  /** The lasso, the marquee, the selection outline. */
  overlay: () => void;
  dropSelection: () => void;
};

export type Parts = {
  surface: InkSurface;
  /** Null on the marketing hero, which mounts ink alone. */
  plane: ObjectPlane | null;
  /** Null wherever comments cannot be left -- the hero, and an anonymous
   *  draft. ADR-107. */
  pins: InkPins | null;
  painter: InkPainter;
  framing: InkFraming;
  editor: SelectionEditor;
  remote: LiveMerge;
  eraser: Eraser;
};

export function assemble(
  opts: EngineOptions, view: InkViewport, index: StrokeIndex, w: Wiring,
): Parts {
  const surface = new InkSurface(opts.committed, opts.live, view);

  const plane = opts.plane
    ? new ObjectPlane(opts.plane, {
      // Both kinds travel as the SAME delta the strokes do -- one version, one
      // subscription. ADR-058 is what makes that safe, and it does not care
      // how many arrays the document has.
      onDelta: opts.onDelta,
      onGeometry: w.overlay,
      imageSrc: opts.imageSrc ?? (async () => null),
    })
    : null;

  const pins = opts.pins
    ? new InkPins(opts.pins, { locate: (id) => locate(w.page(), id), view: () => view })
    : null;

  const painter = new InkPainter(
    surface, view, w.scene, opts.grid, plane?.texts, pins ?? undefined,
  );

  return {
    surface,
    plane,
    pins,
    painter,
    framing: new InkFraming(view, surface, painter, opts.onView),
    ...editors(opts, index, w, plane),
  };
}

/**
 * The three that change what is already on the page.
 *
 * Split from the surfaces above only because `assemble` reached the length
 * limit, but the line is a fair one: everything above draws, and everything
 * here edits.
 */
function editors(
  opts: EngineOptions, index: StrokeIndex, w: Wiring, plane: ObjectPlane | null,
): Pick<Parts, "editor" | "remote" | "eraser"> {
  return {
    editor: new SelectionEditor({
      strokes: w.strokes,
      setStrokes: w.setStrokes,
      texts: () => plane?.texts ?? null,
      images: () => plane?.images ?? null,
      index,
      onDelta: opts.onDelta,
      onChange: opts.onSelectionChange,
      repaint: w.repaint,
      overlay: w.overlay,
    }),
    // What another device did. ADR-058, ADR-103.
    remote: new LiveMerge({
      strokes: w.strokes,
      setStrokes: w.setStrokes,
      plane: () => plane,
      repaint: w.repaint,
      dropSelection: w.dropSelection,
    }),
    eraser: new Eraser({
      strokes: w.strokes,
      setStrokes: w.setStrokes,
      zoom: w.zoom,
      onDelta: opts.onDelta,
      repaint: w.repaint,
    }),
  };
}
