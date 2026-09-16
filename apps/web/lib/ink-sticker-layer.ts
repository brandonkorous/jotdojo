import type { Sticker, StickerName } from "@jotacular/domain";
import type { Bounds } from "./ink-geometry";
import { stickersBounds } from "./ink-rects";
import { InkStickerPlane } from "./ink-sticker-plane";

/**
 * The sticker half of the engine. ADR-115.
 *
 * The sibling of InkTextLayer and InkImageLayer, and deliberately shaped like
 * them: the engine keeps strokes and paints canvases, and a sticker is neither.
 * It is an `<svg>` the browser lays out on the object plane, and the only
 * things it shares with the ink are the camera and the selection.
 *
 * Simpler than the photograph layer by everything a photograph needs: no
 * signed URL, no block behind it, nothing to rescue. Everything here is world
 * coordinates, and `InkStickerPlane` owns the elements.
 */

/**
 * A new sticker, as a fraction of the shorter side of what is on screen.
 *
 * A mark on something, so it starts small enough to be one. Divided by the
 * zoom, which makes the on-screen size CONSTANT at every zoom -- and that is
 * what lets the ghost that follows the pointer be a plain fixed-size element
 * with no camera arithmetic in it at all. ADR-115.
 */
export const STICKER_FRACTION = 0.12;

/** How big a new sticker is on the glass, in screen pixels. The ghost and the
 *  thing it becomes are the same size by construction. */
export const stickerScreenSize = (screen: { w: number; h: number }) =>
  Math.min(screen.w, screen.h) * STICKER_FRACTION;

/** Which sticker is loaded and in what colour. Carried from the tray to the
 *  tap that puts it down. ADR-115. */
export type ArmedSticker = { name: StickerName; color: string };

/**
 * Where a sticker's TOP-LEFT goes so that its centre lands on the tap.
 *
 * The whole of click-to-place, and its own function because it is the one line
 * that was wrong when this shipped: a sticker stored by its corner and placed at
 * the raw point sits down and to the right of what somebody aimed at. ADR-115.
 */
export const stickerCorner = (
  at: { x: number; y: number }, size: number,
): { x: number; y: number } => ({ x: at.x - size / 2, y: at.y - size / 2 });

export type StickerLayerHost = {
  /** A sticker changed and the page should hear about it. */
  onChange: (stickers: readonly Sticker[]) => void;
  /** Something moved that the camera should be able to frame. */
  onGeometry: () => void;
};

export class InkStickerLayer {
  private readonly plane: InkStickerPlane;
  private readonly host: StickerLayerHost;
  private stickers: Sticker[] = [];

  constructor(el: HTMLElement, host: StickerLayerHost) {
    this.host = host;
    this.plane = new InkStickerPlane(el);
  }

  destroy() { this.plane.destroy(); }

  get all(): readonly Sticker[] { return this.stickers; }

  /** Load a page. Copied, because the engine mutates stickers in place when a
   *  selection is dragged -- the same reason `load` copies strokes. */
  load(stickers: readonly Sticker[]) {
    this.stickers = stickers.map((s) => ({ ...s }));
    this.plane.render(this.stickers);
  }

  /** Somebody else's page. Nothing is being typed into a sticker, so unlike
   *  the text layer there is no caret to protect and adopting is just loading. */
  adopt(stickers: readonly Sticker[]) {
    this.load(stickers);
    this.host.onGeometry();
  }

  /** Re-read the stickers already held. For after a drag or a resize, which
   *  mutate the very objects the plane is holding. */
  refresh() { this.plane.render(this.stickers); }

  bounds(): Bounds | null { return stickersBounds(this.stickers); }

  remove(ids: readonly string[]) {
    const gone = new Set(ids);
    const before = this.stickers.length;
    this.stickers = this.stickers.filter((s) => !gone.has(s.id));
    if (this.stickers.length === before) return;
    this.plane.render(this.stickers);
    this.publish();
  }

  /**
   * Stick one on the page, CENTRED ON THE POINT somebody clicked. ADR-115.
   *
   * Not the middle of the view, which is where this landed them until the
   * first person tried it. A sticker is a mark on something, and one that
   * always arrived in the centre had to be dragged onto the thing it was about
   * every single time -- which is doing the job twice.
   *
   * `size` is decided by the caller, from the same screen fraction the ghost
   * that followed the pointer was drawn at, so the sticker lands exactly as
   * big as the thing under the cursor promised.
   */
  place(
    name: StickerName, color: string, at: { x: number; y: number }, size: number,
  ): Sticker {
    const sticker: Sticker = {
      id: crypto.randomUUID(), name, ...stickerCorner(at, size), size, color,
    };
    this.stickers = [...this.stickers, sticker];
    this.plane.render(this.stickers);
    this.publish();
    this.host.onGeometry();
    return sticker;
  }

  /** Every sticker, as the delta carries them. */
  private publish() { this.host.onChange(this.stickers); }
}
