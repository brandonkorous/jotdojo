import type { ImageOnPage, InkDelta, Sticker, Stroke, TextBox } from "@jotacular/domain";
import type { Bounds } from "./ink-geometry";
import { unionOf } from "./ink-rects";
import { InkTextLayer } from "./ink-text-layer";
import { InkImageLayer } from "./ink-image-layer";
import { InkStickerLayer } from "./ink-sticker-layer";
import { GripOverlay } from "./ink-grip-overlay";
import { Stacker } from "./ink-stacker";
import type { InkSurface } from "./ink-surface";
import type { StrokeIndex } from "./ink-index";
import type { ImageSource } from "./ink-image-plane";
import type { ClipSource } from "./ink-voice-card";
import type { StrokesIn } from "./ink-note-art";

/**
 * Everything on the object plane: typed text, photographs, stickers.
 * ADR-065, ADR-103, ADR-115.
 *
 * One owner rather than three fields on the engine, and that is not tidying.
 * The engine had a `texts?.` beside every `texts?.` -- load, destroy, bounds,
 * refresh, remove -- and each new layer would have multiplied every one of
 * them, which is how the third kind of object gets forgotten in one of the six.
 *
 * The plane is the DOM half of the page. The engine keeps strokes and paints
 * canvases; nothing here is either.
 */
export type PlaneHooks = {
  onDelta: (delta: InkDelta) => void;
  /** Something moved that the camera should be able to frame. */
  onGeometry: () => void;
  /** Where a photograph's bytes are. Signed on demand. */
  imageSrc: ImageSource;
  /** Where a recording's sound is, for voice cards. Absent on the hero. */
  clipSrc?: ClipSource;
  /** What was drawn in a note, for its sheet. ADR-134. */
  strokesIn?: StrokesIn;
  /** The layer number just above everything. ADR-136. */
  nextZ?: () => number;
};

export class ObjectPlane {
  readonly texts: InkTextLayer;
  readonly images: InkImageLayer;
  readonly stickers: InkStickerLayer;
  readonly grips: GripOverlay;
  /** The page's one order, on screen. ADR-136. */
  readonly stack: Stacker;

  constructor(el: HTMLElement, hooks: PlaneHooks) {
    // Every kind travels as the SAME delta the strokes do -- one version, one
    // subscription. ADR-058 is what makes that safe, and it does not care how
    // many arrays the document has.
    this.texts = new InkTextLayer(el, {
      onChange: (boxes) => hooks.onDelta({ remove: [], upsert: [], texts: [...boxes] }),
      onGeometry: hooks.onGeometry,
      strokesIn: hooks.strokesIn,
      nextZ: hooks.nextZ,
    });
    this.images = new InkImageLayer(el, {
      onChange: (images) => hooks.onDelta({ remove: [], upsert: [], images: [...images] }),
      onGeometry: hooks.onGeometry,
      nextZ: hooks.nextZ,
    }, hooks.imageSrc, hooks.clipSrc);
    this.grips = new GripOverlay(el);
    this.stack = new Stacker(el, {
      texts: () => this.texts.all, images: () => this.images.all, stickers: () => this.stickers.all,
      els: (kind, id) => (kind === "text" ? this.texts.els(id)
        : kind === "image" ? this.images.els(id) : kind === "sticker" ? this.stickers.els(id) : []),
    });
    this.stickers = new InkStickerLayer(el, {
      onChange: (stickers) => hooks.onDelta({ remove: [], upsert: [], stickers: [...stickers] }),
      onGeometry: hooks.onGeometry,
      nextZ: hooks.nextZ,
    });
  }

  destroy() {
    this.texts.destroy();
    this.images.destroy();
    this.stickers.destroy();
    this.grips.destroy();
    this.stack.destroy();
  }

  /** The page was repainted. Notes redraw their sheets when the strokes did;
   *  the order is kept on screen either way. ADR-134, ADR-136. */
  onPage(strokes: readonly Stroke[], strokesChanged: boolean, surface: InkSurface, index: StrokeIndex) {
    if (strokesChanged) this.texts.refresh();
    this.stack.update(strokes, surface, index);
  }

  /** A finished stroke the plane draws rather than the canvas: one that began
   *  in a note, or any drawn while something is on the plane below it. */
  claims(stroke: Stroke): boolean {
    return this.texts.attach(stroke) || this.stack.hasObjects;
  }

  onCanvas(stroke: Stroke): boolean { return this.stack.onCanvas(stroke); }

  load(
    texts: readonly TextBox[], images: readonly ImageOnPage[],
    stickers: readonly Sticker[] = [],
  ) {
    this.texts.load(texts);
    this.images.load(images);
    this.stickers.load(stickers);
  }

  /** Everything the camera has to fit, of every kind. */
  bounds(): Bounds | null {
    return unionOf(
      [this.texts.bounds(), this.images.bounds(), this.stickers.bounds()]
        .filter((b): b is Bounds => b !== null),
    );
  }
}
