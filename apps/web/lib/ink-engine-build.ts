import type { InkDelta, Stroke } from "@jotacular/domain";
import type { Scene } from "./ink-draw";
import type { EngineOptions } from "./ink-engine-options";
import { locate, type Page } from "./ink-engine-page";
import { InkDoc } from "./ink-engine-doc";
import { Eraser } from "./ink-engine-erase";
import { InkLinks } from "./ink-engine-links";
import { LiveMerge } from "./ink-engine-live";
import { SelectionEditor } from "./ink-engine-select";
import { InkFraming } from "./ink-framing";
import type { StrokeIndex } from "./ink-index";
import { ObjectPlane } from "./ink-object-plane";
import { InkPainter } from "./ink-painter";
import { InkPins } from "./ink-pins";
import { InkOpen } from "./ink-engine-open";
import { InkTaps } from "./ink-engine-tap";
import type { InkStyle } from "./ink-style";
import { InkSurface } from "./ink-surface";
import { clientRect, worldAt } from "./ink-screen";
import type { InkViewport } from "./ink-viewport";

/**
 * What is wired to what, once, at mount.
 *
 * Split out of ink-engine.ts at the size limit, and the seam is real: nine
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
  /** Colour and width for the tool in hand, which a new text box inherits. */
  style: () => InkStyle;
  /** How wide a NEW text box should be, which changes with the camera. */
  visibleWidth: () => number;
  /** How far a tap reaches, in document units. */
  reach: () => number;
  /** Finished strokes changed. */
  repaint: () => void;
  /** The lasso, the marquee, the selection outline. */
  overlay: () => void;
  dropSelection: () => void;
  /** What is selected, said again after something changed it wholesale. */
  onSelection: () => void;
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
  /** The arrows. Null wherever the engine is mounted with no object plane,
   *  since there would be nothing to tie one to. ADR-108. */
  links: InkLinks | null;
  /** What happened to the page, and what can be taken back. ADR-109, ADR-110. */
  doc: InkDoc;
  /** What a tap on the page means, of the four things it can mean. ADR-108. */
  taps: InkTaps;
  /** A page arriving, and where the camera looks when it does. ADR-053. */
  open: InkOpen;
};

export function assemble(
  opts: EngineOptions, view: InkViewport, index: StrokeIndex, w: Wiring,
): Parts {
  const surface = new InkSurface(opts.committed, opts.live, view);

  // Built first and filled in below. Every edit is published THROUGH the
  // document, so that one thing knows what happened and can undo it. ADR-109.
  const doc = new InkDoc(document(opts, w, () => held));
  const publish = (delta: InkDelta) => { doc.history.record(delta); opts.onDelta(delta); };

  const plane = opts.plane
    ? new ObjectPlane(opts.plane, {
      // Every kind travels as the SAME delta the strokes do -- one version, one
      // subscription. ADR-058 is what makes that safe, and it does not care
      // how many arrays the document has.
      onDelta: publish,
      onGeometry: w.overlay,
      imageSrc: opts.imageSrc ?? (async () => null),
    })
    : null;

  const links = plane
    ? new InkLinks({
      page: w.page,
      onDelta: publish,
      repaint: w.repaint,
      overlay: w.overlay,
      worldAt: (x, y) => worldAt(surface, view, x, y),
      surface: opts.live,
      onAiming: opts.onAiming,
    })
    : null;

  const pins = opts.pins
    ? new InkPins(opts.pins, { locate: (id) => locate(w.page(), id), view: () => view })
    : null;

  const painter = new InkPainter(
    surface, view, w.scene, opts.grid, plane?.texts, pins ?? undefined,
  );
  const framing = new InkFraming(view, surface, painter, opts.onView);
  const p: EditorParts = { plane, links, doc, publish, onChange: opts.onSelectionChange };
  const edits = editors(index, w, p);

  const held: Parts = {
    surface, plane, pins, painter, links, doc, framing, ...edits,
    ...reach(opts, w, p, edits.editor, { surface, framing, view }),
  };
  return held;
}

/** What the document reads and writes. Reached through a getter because the
 *  document is built before the parts it talks to. */
function document(opts: EngineOptions, w: Wiring, parts: () => Parts) {
  return {
    strokes: w.strokes,
    setStrokes: w.setStrokes,
    texts: () => parts().plane?.texts ?? null,
    images: () => parts().plane?.images ?? null,
    stickers: () => parts().plane?.stickers ?? null,
    links: () => parts().links,
    sel: () => parts().editor.sel,
    send: opts.onDelta,
    record: (delta: InkDelta) => {
      parts().doc.history.record(delta);
      opts.onDelta(delta);
    },
    repaint: w.repaint,
    overlay: w.overlay,
    dropSelection: w.dropSelection,
    onSelection: w.onSelection,
  };
}

/** The two that answer "where": where a page goes when it arrives, and what a
 *  tap landed on. Neither draws and neither edits. */
function reach(
  opts: EngineOptions, w: Wiring, p: EditorParts, editor: SelectionEditor,
  surfaces: { surface: InkSurface; framing: InkFraming; view: InkViewport },
): Pick<Parts, "open" | "taps"> {
  return {
    open: new InkOpen({
      setStrokes: w.setStrokes,
      strokes: w.strokes,
      plane: () => p.plane,
      links: () => p.links,
      doc: () => p.doc,
      framing: () => surfaces.framing,
      surface: () => surfaces.surface,
      view: () => surfaces.view,
      dropSelection: w.dropSelection,
      overlay: w.overlay,
    }),
    taps: new InkTaps({
      texts: () => p.plane?.texts ?? null,
      images: () => p.plane?.images ?? null,
      stickers: () => p.plane?.stickers ?? null,
      links: () => p.links,
      editor,
      style: w.style,
      visibleWidth: w.visibleWidth,
      reach: w.reach,
      world: (x, y) => worldAt(surfaces.surface, surfaces.view, x, y),
      rectOf: (b) => clientRect(surfaces.surface, surfaces.view, b),
      onTextPlaced: () => opts.onTextPlaced?.(),
    }),
  };
}

type EditorParts = {
  plane: ObjectPlane | null;
  links: InkLinks | null;
  doc: InkDoc;
  publish: (delta: InkDelta) => void;
  onChange: EngineOptions["onSelectionChange"];
};

/**
 * The three that change what is already on the page.
 *
 * Split from the surfaces above only because `assemble` reached the length
 * limit, but the line is a fair one: everything above draws, and everything
 * here edits.
 */
function editors(
  index: StrokeIndex, w: Wiring, p: EditorParts,
): Pick<Parts, "editor" | "remote" | "eraser"> {
  return {
    editor: new SelectionEditor({
      strokes: w.strokes,
      setStrokes: w.setStrokes,
      texts: () => p.plane?.texts ?? null,
      images: () => p.plane?.images ?? null,
      stickers: () => p.plane?.stickers ?? null,
      links: () => p.links,
      index,
      onDelta: p.publish,
      onChange: p.onChange,
      repaint: w.repaint,
      overlay: w.overlay,
    }),
    // What another device did. ADR-058, ADR-103, ADR-108.
    remote: new LiveMerge({
      strokes: w.strokes,
      setStrokes: w.setStrokes,
      plane: () => p.plane,
      links: () => p.links,
      repaint: w.repaint,
      dropSelection: w.dropSelection,
      observe: () => p.doc.observe(),
    }),
    eraser: new Eraser({
      strokes: w.strokes,
      setStrokes: w.setStrokes,
      zoom: w.zoom,
      links: () => p.links,
      onDelta: p.publish,
      repaint: w.repaint,
    }),
  };
}
