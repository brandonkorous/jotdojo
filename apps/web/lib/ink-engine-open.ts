import type { ImageOnPage, Link, NoteImage, Stroke, TextBox } from "@jotacular/domain";
import type { InkDoc } from "./ink-engine-doc";
import type { InkLinks } from "./ink-engine-links";
import type { InkFraming } from "./ink-framing";
import type { ObjectPlane } from "./ink-object-plane";
import type { InkSurface } from "./ink-surface";
import type { InkViewport } from "./ink-viewport";

/**
 * A page arriving, and where the camera looks when it does. ADR-053, ADR-103.
 *
 * Split from ink-engine.ts when arrows took that file past its size limit for
 * the third time. The seam is the one the engine's own history keeps drawing:
 * what the page DOES about a pointer stays there, and everything about the
 * page as a WHOLE -- loading it, rescuing photographs that never had a home,
 * putting a new one down, and pointing the camera at any of it -- is one job
 * that never touches a pointer at all.
 */

export type OpenContext = {
  setStrokes: (next: Stroke[]) => void;
  strokes: () => Stroke[];
  /** Null wherever the engine is mounted with no object plane. */
  plane: () => ObjectPlane | null;
  links: () => InkLinks | null;
  doc: () => InkDoc;
  framing: () => InkFraming;
  surface: () => InkSurface;
  view: () => InkViewport;
  dropSelection: () => void;
  /** Something moved that the overlay should redraw. */
  overlay: () => void;
};

export class InkOpen {
  constructor(private readonly ctx: OpenContext) {}

  /**
   * Load a page and frame it.
   *
   * Opening a note on an endless surface must never land on empty paper miles
   * from the writing. The strokes are COPIED, because a drag mutates them in
   * place and two pages sharing one would move both.
   */
  load(
    strokes: Stroke[], texts: TextBox[] = [], images: ImageOnPage[] = [],
    links: Link[] = [],
  ) {
    this.ctx.setStrokes(strokes.map((s) => ({ ...s, pts: [...s.pts] })));
    this.ctx.plane()?.load(texts, images);
    this.ctx.links()?.load(links);
    this.ctx.dropSelection();
    // A loaded page is where undo starts from, and nothing before it is this
    // person's to take back. ADR-109.
    this.ctx.doc().reset();
    this.fit();
  }

  /** Give a home to photographs taken before placements existed. Frames the
   *  page again when it rescued any, because the content just grew. ADR-103. */
  adoptImages(known: readonly NoteImage[]) {
    const plane = this.ctx.plane();
    const at = this.ctx.framing().contentBounds(this.ctx.strokes(), plane?.bounds());
    if (plane?.images.adoptOrphans(known, at)) this.fit();
  }

  /** Put a photograph where somebody is looking. The bytes are already a
   *  `blocks` row; the page only learns where the picture goes. ADR-103. */
  placeImage(blockId: string, natural: { w: number; h: number }) {
    const r = this.ctx.surface().rect();
    this.ctx.plane()?.images.place(
      blockId, natural, this.ctx.view(), { w: r.width, h: r.height },
    );
    this.ctx.overlay();
  }

  fit() { this.ctx.framing().fitTo(this.ctx.strokes(), this.ctx.plane()?.bounds()); }

  resize(cssWidth: number, cssHeight: number) {
    this.ctx.framing().resize(cssWidth, cssHeight);
  }
}
