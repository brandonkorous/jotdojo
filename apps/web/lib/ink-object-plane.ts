import type { ImageOnPage, InkDelta, TextBox } from "@jotacular/domain";
import type { Bounds } from "./ink-geometry";
import { InkTextLayer } from "./ink-text-layer";
import { InkImageLayer } from "./ink-image-layer";
import type { ImageSource } from "./ink-image-plane";

/**
 * Everything on the object plane: typed text, and photographs. ADR-065, ADR-103.
 *
 * One owner rather than two fields on the engine, and that is not tidying. The
 * engine had a `texts?.` beside every `texts?.` -- load, destroy, bounds,
 * refresh, remove -- and adding a second layer would have doubled every one of
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

  constructor(el: HTMLElement, hooks: PlaneHooks) {
    // Both kinds travel as the SAME delta the strokes do -- one version, one
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
  }

  destroy() {
    this.texts.destroy();
    this.images.destroy();
  }

  load(texts: readonly TextBox[], images: readonly ImageOnPage[]) {
    this.texts.load(texts);
    this.images.load(images);
  }

  /** Everything the camera has to fit, of both kinds. */
  bounds(): Bounds | null {
    const a = this.texts.bounds();
    const b = this.images.bounds();
    if (!a) return b;
    if (!b) return a;
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    return {
      x, y,
      w: Math.max(a.x + a.w, b.x + b.w) - x,
      h: Math.max(a.y + a.h, b.y + b.h) - y,
    };
  }
}
