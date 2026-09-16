import type { ImageOnPage, InkDelta, Sticker, TextBox } from "@jotacular/domain";
import type { Bounds } from "./ink-geometry";
import { unionOf } from "./ink-rects";
import { InkTextLayer } from "./ink-text-layer";
import { InkImageLayer } from "./ink-image-layer";
import { InkStickerLayer } from "./ink-sticker-layer";
import type { ImageSource } from "./ink-image-plane";

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
};

export class ObjectPlane {
  readonly texts: InkTextLayer;
  readonly images: InkImageLayer;
  readonly stickers: InkStickerLayer;

  constructor(el: HTMLElement, hooks: PlaneHooks) {
    // Every kind travels as the SAME delta the strokes do -- one version, one
    // subscription. ADR-058 is what makes that safe, and it does not care how
    // many arrays the document has.
    this.texts = new InkTextLayer(el, {
      onChange: (boxes) => hooks.onDelta({ remove: [], upsert: [], texts: [...boxes] }),
      onGeometry: hooks.onGeometry,
    });
    this.images = new InkImageLayer(el, {
      onChange: (images) => hooks.onDelta({ remove: [], upsert: [], images: [...images] }),
      onGeometry: hooks.onGeometry,
    }, hooks.imageSrc);
    this.stickers = new InkStickerLayer(el, {
      onChange: (stickers) => hooks.onDelta({ remove: [], upsert: [], stickers: [...stickers] }),
      onGeometry: hooks.onGeometry,
    });
  }

  destroy() {
    this.texts.destroy();
    this.images.destroy();
    this.stickers.destroy();
  }

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
