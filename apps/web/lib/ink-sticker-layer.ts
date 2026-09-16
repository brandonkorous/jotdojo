import type { Sticker, StickerName } from "@jotacular/domain";
import type { ViewSnapshot } from "./ink-viewport";
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

/** A new sticker, as a fraction of the shorter side of what is on screen. A
 *  sticker is a mark on something, so it starts small enough to be one. */
const FRACTION = 0.12;

/** How far each one steps when it would land on top of the last. In document
 *  units, and the same distance a paste offsets by. */
const CASCADE = 24;

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
   * Stick one on the page, in the middle of what somebody is looking at.
   *
   * The middle of the VIEW, not of the document: an endless canvas has no
   * middle, and a sticker that landed at the origin would be somewhere else
   * entirely by the time anybody had panned twice. `InkImageLayer.place` makes
   * the same call for the same reason.
   */
  place(
    name: StickerName, color: string, view: ViewSnapshot,
    screen: { w: number; h: number },
  ): Sticker {
    const size = Math.min(screen.w, screen.h) * FRACTION / view.k;
    const spot = this.free(
      (screen.w / 2 - view.x) / view.k - size / 2,
      (screen.h / 2 - view.y) / view.k - size / 2,
    );
    const sticker: Sticker = { id: crypto.randomUUID(), name, ...spot, size, color };
    this.stickers = [...this.stickers, sticker];
    this.plane.render(this.stickers);
    this.publish();
    this.host.onGeometry();
    return sticker;
  }

  /**
   * Somewhere nothing is already sitting.
   *
   * Without this, marking a page with six stickers puts all six on the same
   * square and looks like five of them failed.
   */
  private free(x: number, y: number): { x: number; y: number } {
    const taken = new Set(this.stickers.map((s) => `${Math.round(s.x)},${Math.round(s.y)}`));
    let step = 0;
    while (taken.has(`${Math.round(x + step)},${Math.round(y + step)}`) && step < CASCADE * 40) {
      step += CASCADE;
    }
    return { x: x + step, y: y + step };
  }

  /** Every sticker, as the delta carries them. */
  private publish() { this.host.onChange(this.stickers); }
}
