import type { ImageOnPage } from "@jotacular/domain";
import { VoiceCards, type ClipSource } from "./ink-voice-card";
import { applyTurn } from "./ink-turned";

/**
 * The `<img>` elements on the object plane. ADR-103.
 *
 * The picture half of what ink-plane.ts does for typed text, and it sits on the
 * SAME transformed layer, so a photo pans and scales with the handwriting for
 * free -- and never through a `<canvas>` ancestor, which would scale a bitmap
 * and blur the ink. ADR-065 established that layer; this only adds to it.
 *
 * Nothing here takes a pointer. A photo is selected by lassoing or tapping it
 * on the ink surface underneath, exactly as a stroke is, so there is no second
 * hit-testing path to disagree with the first.
 */

/** Where the bytes are. Async, because the URL is time-limited and signed on
 *  demand -- see `photoUrlAction`. */
export type ImageSource = (blockId: string) => Promise<string | null>;

export class InkImagePlane {
  private readonly el: HTMLElement;
  private readonly src: ImageSource;
  private readonly nodes = new Map<string, HTMLImageElement>();
  /** One signed URL per block, however many placements point at it. */
  private readonly urls = new Map<string, string>();
  private readonly asking = new Set<string>();

  /** A recording's placement is drawn as a voice card instead. ADR-121. */
  private readonly voices: VoiceCards | null;

  constructor(el: HTMLElement, src: ImageSource, clips?: ClipSource) {
    this.el = el;
    this.src = src;
    this.voices = clips ? new VoiceCards(el, clips) : null;
  }

  destroy() {
    for (const node of this.nodes.values()) node.remove();
    this.nodes.clear();
    this.voices?.destroy();
  }

  render(images: readonly ImageOnPage[]) {
    const pics = images.filter((i) => i.media !== "audio");
    const live = new Set(pics.map((i) => i.id));
    for (const [id, node] of this.nodes) {
      if (live.has(id)) continue;
      node.remove();
      this.nodes.delete(id);
    }
    for (const image of pics) this.one(image);
    this.voices?.keep(new Set(images.filter((i) => i.media === "audio").map((i) => i.id)));
    for (const v of images) if (v.media === "audio") this.voices?.render(v);
  }

  private one(image: ImageOnPage) {
    let node = this.nodes.get(image.id);
    if (!node) {
      node = document.createElement("img");
      node.className = "jd-plane-image";
      // The vision transcript is the honest alt text and it lives on the block,
      // not the placement -- so a photo says nothing here rather than repeating
      // a filename at a screen reader. It is set once the caption is known.
      node.alt = "";
      node.draggable = false;
      node.dataset.block = image.blockId;
      // A picture whose bytes will not load shows NOTHING rather than a framed
      // empty rectangle. The placement stays -- the page is not ours to edit
      // because a URL expired -- but it stops claiming there is a photo there.
      node.onerror = () => { node!.dataset.broken = "true"; };
      node.onload = () => { delete node!.dataset.broken; };
      this.el.append(node);
      this.nodes.set(image.id, node);
    }
    node.style.left = `${image.x}px`;
    node.style.top = `${image.y}px`;
    node.style.width = `${image.w}px`;
    node.style.height = `${image.h}px`;
    // The polaroid frame is sized from the shorter side. ADR-120.
    node.style.setProperty("--jd-print", `${Math.min(image.w, image.h)}px`);
    applyTurn(node, image.rot);

    const url = this.urls.get(image.blockId);
    if (url) { if (node.src !== url) node.src = url; return; }
    this.ask(image.blockId);
  }

  /**
   * One request per block, ever.
   *
   * `render` runs on every drag frame, and a signed-URL request per frame would
   * be a request per pixel of movement.
   */
  private ask(blockId: string) {
    if (this.asking.has(blockId)) return;
    this.asking.add(blockId);
    void this.src(blockId).then((url) => {
      if (!url) return;
      this.urls.set(blockId, url);
      for (const node of this.nodes.values()) {
        if (node.dataset.block === blockId) node.src = url;
      }
    });
  }
}
