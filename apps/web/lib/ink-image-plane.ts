import type { ImageOnPage, MediaClip } from "@jotacular/domain";
import { makePrint, showPicture, writeOn, type Print } from "./ink-print";
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
  private readonly nodes = new Map<string, Print>();
  /** The date and caption per block, when a clip source can say. ADR-127. */
  private readonly meta = new Map<string, MediaClip>();
  /** One signed URL per block, however many placements point at it. */
  private readonly urls = new Map<string, string>();
  private readonly asking = new Set<string>();

  /** A recording's placement is drawn as a voice card instead. ADR-121. */
  private readonly voices: VoiceCards | null;
  private readonly clips: ClipSource | null;

  constructor(el: HTMLElement, src: ImageSource, clips?: ClipSource) {
    this.el = el;
    this.src = src;
    this.clips = clips ?? null;
    this.voices = clips ? new VoiceCards(el, clips) : null;
  }

  destroy() {
    for (const print of this.nodes.values()) print.frame.remove();
    this.nodes.clear();
    this.voices?.destroy();
  }

  render(images: readonly ImageOnPage[]) {
    const pics = images.filter((i) => i.media !== "audio");
    const live = new Set(pics.map((i) => i.id));
    for (const [id, print] of this.nodes) {
      if (live.has(id)) continue;
      print.frame.remove();
      this.nodes.delete(id);
    }
    for (const image of pics) this.one(image);
    this.voices?.keep(new Set(images.filter((i) => i.media === "audio").map((i) => i.id)));
    for (const v of images) if (v.media === "audio") this.voices?.render(v);
  }

  private one(image: ImageOnPage) {
    let print = this.nodes.get(image.id);
    if (!print) {
      print = makePrint(image.blockId);
      this.el.append(print.frame);
      this.nodes.set(image.id, print);
    }
    const s = print.frame.style;
    s.left = `${image.x}px`;
    s.top = `${image.y}px`;
    s.width = `${image.w}px`;
    s.height = `${image.h}px`;
    // The polaroid frame is sized from the shorter side. ADR-120.
    s.setProperty("--jd-print", `${Math.min(image.w, image.h)}px`);
    applyTurn(print.frame, image.rot);

    const url = this.urls.get(image.blockId);
    const clip = this.meta.get(image.blockId);
    if (clip) writeOn(print, clip);
    if (url) return showPicture(print, url);
    this.ask(image.blockId);
  }

  /**
   * One request per block, ever: `render` runs on every drag frame. With a
   * clip source the same round trip brings the date for the print's foot.
   */
  private ask(blockId: string) {
    if (this.asking.has(blockId)) return;
    this.asking.add(blockId);
    const got = (url: string | null, clip?: MediaClip) => {
      if (!url) return;
      this.urls.set(blockId, url);
      if (clip) this.meta.set(blockId, clip);
      for (const print of this.nodes.values()) {
        if (print.frame.dataset.block !== blockId) continue;
        showPicture(print, url);
        if (clip) writeOn(print, clip);
      }
    };
    if (this.clips) void this.clips(blockId).then((c) => got(c?.url ?? null, c ?? undefined));
    else void this.src(blockId).then((url) => got(url));
  }
}
