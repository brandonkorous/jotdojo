import type { Bounds } from "./ink-geometry";
import type { InkLinks } from "./ink-engine-links";
import type { SelectionEditor } from "./ink-engine-select";
import type { InkImageLayer } from "./ink-image-layer";
import type { InkStickerLayer } from "./ink-sticker-layer";
import type { InkTextLayer } from "./ink-text-layer";
import type { InkStyle } from "./ink-style";

/**
 * What a tap on the page means. ADR-084, ADR-085, ADR-108.
 *
 * Split from ink-engine.ts when arrows gave a tap a fourth possible meaning
 * and the file passed its size limit again. The seam is one the engine's own
 * comments already draw: `InkInput` owns what a pointer is DOING, the engine
 * owns the camera and the frame loop, and this is the question in between --
 * of everything on this page, which thing did that land on, and what does
 * landing on it do.
 *
 * Four answers, in the order they are tried: an arrow waiting for its second
 * end, a text box that wants a caret, an object that wants picking up, and
 * bare canvas, which means nothing at all.
 */

export type TapContext = {
  texts: () => InkTextLayer | null;
  images: () => InkImageLayer | null;
  stickers: () => InkStickerLayer | null;
  /** Null wherever the engine is mounted with no object plane. */
  links: () => InkLinks | null;
  editor: SelectionEditor;
  style: () => InkStyle;
  /** How wide a NEW box should be: a fraction of what is on screen, which
   *  changes with the camera. */
  visibleWidth: () => number;
  /** How far a tap reaches, in DOCUMENT units. A screen distance divided by
   *  the zoom, so what you can rub out you can also pick up. */
  reach: () => number;
  /** Where a client point lands in the document. React has a MouseEvent, not
   *  a document point. `ink-screen.ts` is the arithmetic. ADR-084. */
  world: (clientX: number, clientY: number) => { x: number; y: number };
  /** A document rectangle as one on the glass, for a popup to anchor to. */
  rectOf: (b: Bounds) => DOMRect;
  onTextPlaced?: () => void;
};

export class InkTaps {
  constructor(private readonly ctx: TapContext) {}

  /**
   * Whether the text plane took the tap.
   *
   * The canvas draws nothing when it did, so a stray stroke never lands under
   * a box somebody is editing.
   */
  text(x: number, y: number): boolean {
    if (!this.ctx.texts()?.tapAt(x, y, this.ctx.style(), this.ctx.visibleWidth())) return false;
    this.ctx.onTextPlaced?.();
    return true;
  }

  /** A box at exactly the rectangle somebody drew. ADR-078. */
  drawText(rect: Bounds) {
    if (this.ctx.texts()?.drawAt(rect, this.ctx.style())) this.ctx.onTextPlaced?.();
  }

  /**
   * One object, by tapping it. ADR-084.
   *
   * An arrow waiting for its second end takes the tap FIRST, and takes it even
   * when the tap hit nothing: aiming at bare canvas means "never mind", which
   * costs one tap rather than a trip back to a menu. ADR-108.
   */
  select(x: number, y: number) {
    const reach = this.ctx.reach();
    const links = this.ctx.links();
    if (links?.aiming) return void links.finishAim(this.objectAt(x, y, reach));
    this.pick(x, y, reach);
  }

  /**
   * The same, from CLIENT coordinates -- what the canvas menu opens on.
   *
   * Opening the menu is NOT the second half of an arrow, so aiming is called
   * off first: a right-click meaning "finish that arrow here" is a reading
   * nobody would arrive at. ADR-108.
   */
  selectAtClient(clientX: number, clientY: number) {
    this.ctx.links()?.cancelAim();
    const p = this.ctx.world(clientX, clientY);
    this.select(p.x, p.y);
  }

  /** Its sibling, for the menu's "put a note here". */
  textAtClient(clientX: number, clientY: number) {
    const p = this.ctx.world(clientX, clientY);
    this.text(p.x, p.y);
  }

  /** Where the selection is ON SCREEN, so the menu can point at the thing it
   *  acts on rather than at the thumb that summoned it. Null when nothing is
   *  selected. ADR-084. */
  marqueeRect(): DOMRect | null {
    const b = this.ctx.editor.sel.marquee;
    return b ? this.ctx.rectOf(b) : null;
  }

  /**
   * The one object under a point, named, or null.
   *
   * Goes through the selection and then drops it, rather than reaching into
   * three arrays with a fourth copy of the "boxes, then photos, then strokes"
   * order. One answer to "what is under here" is worth a redundant drop.
   */
  private objectAt(x: number, y: number, radius: number): string | null {
    this.pick(x, y, radius);
    const id = this.ctx.editor.sel.summary.ids[0] ?? null;
    this.ctx.editor.drop();
    return id;
  }

  private pick(x: number, y: number, radius: number) {
    this.ctx.editor.pickAt(
      x, y, radius, this.ctx.texts()?.all ?? [], this.ctx.images()?.all ?? [],
      this.ctx.stickers()?.all ?? [],
    );
  }
}
