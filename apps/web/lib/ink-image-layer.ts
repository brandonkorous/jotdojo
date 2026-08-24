import type { ImageOnPage } from "@jotacular/domain";
import type { ViewSnapshot } from "./ink-viewport";
import type { Bounds } from "./ink-geometry";
import { imagesBounds } from "./ink-objects";
import { InkImagePlane, type ImageSource } from "./ink-image-plane";

/**
 * The photograph half of the engine. ADR-103.
 *
 * The sibling of InkTextLayer and deliberately shaped like it: the engine keeps
 * strokes and paints canvases, and neither of those is what a photo is. A photo
 * is an `<img>` the browser lays out on the object plane, and the only things
 * it shares with the ink are the camera and the selection.
 *
 * Everything here is world coordinates. `InkImagePlane` owns the elements.
 */

/** A new photo takes about half the shorter side of what is on screen: big
 *  enough to see, small enough to write beside. Somebody can resize it after. */
const FRACTION = 0.5;

/** How big a rescued photo starts, in document units, and how far apart they
 *  sit. A page of them should read as a row somebody can rearrange. */
const ORPHAN_SIZE = 320;
const ORPHAN_GAP = 24;

export type ImageLayerHost = {
  /** A placement changed and the page should hear about it. */
  onChange: (images: readonly ImageOnPage[]) => void;
  /** Something moved that the camera should be able to frame. */
  onGeometry: () => void;
};

export class InkImageLayer {
  private readonly plane: InkImagePlane;
  private readonly host: ImageLayerHost;
  private images: ImageOnPage[] = [];

  constructor(el: HTMLElement, host: ImageLayerHost, src: ImageSource) {
    this.host = host;
    this.plane = new InkImagePlane(el, src);
  }

  destroy() { this.plane.destroy(); }

  get all(): readonly ImageOnPage[] { return this.images; }

  /** Load a page. Copied, because the engine mutates placements in place when a
   *  selection is dragged -- the same reason `load` copies strokes. */
  load(images: readonly ImageOnPage[]) {
    this.images = images.map((i) => ({ ...i }));
    this.plane.render(this.images);
  }

  /** Somebody else's page. Nothing is being typed into a photo, so unlike the
   *  text layer there is no caret to protect and adopting is just loading. */
  adopt(images: readonly ImageOnPage[]) {
    this.load(images);
    this.host.onGeometry();
  }

  /** Re-read the placements already held. For after a drag or a resize, which
   *  mutate the very objects the plane is holding. */
  refresh() { this.plane.render(this.images); }

  bounds(): Bounds | null { return imagesBounds(this.images); }

  remove(ids: readonly string[]) {
    const gone = new Set(ids);
    const before = this.images.length;
    this.images = this.images.filter((i) => !gone.has(i.id));
    if (this.images.length === before) return;
    this.plane.render(this.images);
    this.publish();
  }

  /**
   * Put a photograph on the page, in the middle of what somebody is looking at.
   *
   * The middle of the VIEW, not the middle of the document: an endless canvas
   * has no middle, and a photo that landed at the origin would be somewhere
   * else entirely by the time anybody had panned twice.
   */
  place(blockId: string, natural: { w: number; h: number }, view: ViewSnapshot,
        screen: { w: number; h: number }): ImageOnPage {
    const fit = Math.min(screen.w, screen.h) * FRACTION / view.k;
    const scale = fit / Math.max(natural.w, natural.h);
    const w = Math.max(1, natural.w * scale);
    const h = Math.max(1, natural.h * scale);
    const image: ImageOnPage = {
      id: crypto.randomUUID(),
      blockId,
      x: (screen.w / 2 - view.x) / view.k - w / 2,
      y: (screen.h / 2 - view.y) / view.k - h / 2,
      w, h,
    };
    this.images = [...this.images, image];
    this.plane.render(this.images);
    this.publish();
    this.host.onGeometry();
    return image;
  }

  /**
   * Give a home to photographs that have none. ADR-103.
   *
   * Every picture taken before placements existed is a `blocks` row and nothing
   * else. They are laid out in a row above whatever else is on the page, which
   * is somewhere to start rather than somewhere to stay -- and anywhere beats
   * a photo that is stored, transcribed, searchable and invisible.
   *
   * Returns whether anything moved, so a page whose photos are all placed --
   * every page, after the first time -- costs no write.
   */
  adoptOrphans(
    known: readonly { blockId: string; width: number | null; height: number | null }[],
    at: Bounds | null,
  ): boolean {
    const placed = new Set(this.images.map((i) => i.blockId));
    const orphans = known.filter((k) => !placed.has(k.blockId));
    if (orphans.length === 0) return false;

    const side = ORPHAN_SIZE;
    let x = at ? at.x : 0;
    const y = (at ? at.y : 0) - side - ORPHAN_GAP;
    for (const orphan of orphans) {
      const ratio = orphan.width && orphan.height ? orphan.width / orphan.height : 1;
      const w = ratio >= 1 ? side : side * ratio;
      const h = ratio >= 1 ? side / ratio : side;
      this.images.push({ id: crypto.randomUUID(), blockId: orphan.blockId, x, y, w, h });
      x += w + ORPHAN_GAP;
    }
    this.plane.render(this.images);
    this.publish();
    this.host.onGeometry();
    return true;
  }

  /** Every placement, as the delta carries them. */
  private publish() { this.host.onChange(this.images); }
}
