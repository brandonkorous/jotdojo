import type { ImageOnPage, MediaClip } from "@jotacular/domain";
import { VOICE_BARS, VOICE_H, clock, peaks } from "./ink-voice";
import { applyTurn } from "./ink-turned";

/** Where a recording's sound and words are. Signed on demand. ADR-121. */
export type ClipSource = (blockId: string) => Promise<MediaClip | null>;

/** Longer than this is not decoded for its waveform: the bars are a picture
 *  of speech, and a meeting is not worth a hundred megabytes of samples. */
const DECODE_CEILING_MS = 10 * 60_000;
const WORDS_RETRY_MS = [5_000, 15_000, 45_000];
const PLAY = "M8 5v14l11-7z";
const PAUSE = "M7 5h4v14H7zM13 5h4v14h-4z";

type Card = { el: HTMLElement; bars: HTMLElement[]; time: HTMLElement; words: HTMLElement;
  icon: SVGPathElement; audio: HTMLAudioElement | null; blockId: string; ms: number | null };

/**
 * The voice cards on the object plane: a play button, a line of sound, a
 * time and the first words. Only the button takes a pointer; the card itself
 * is lassoed and dragged on the ink surface underneath, as a photo is.
 */
export class VoiceCards {
  private readonly cards = new Map<string, Card>();
  private readonly clips = new Map<string, Promise<MediaClip | null>>();

  constructor(private readonly el: HTMLElement, private readonly src: ClipSource) {}

  destroy() {
    for (const id of [...this.cards.keys()]) this.drop(id);
  }

  /** Remove any card whose placement is gone. */
  keep(live: ReadonlySet<string>) {
    for (const id of [...this.cards.keys()]) if (!live.has(id)) this.drop(id);
  }

  render(v: ImageOnPage) {
    const card = this.cards.get(v.id) ?? this.make(v);
    const s = card.el.style;
    s.left = `${v.x}px`;
    s.top = `${v.y}px`;
    s.width = `${v.w}px`;
    s.height = `${v.h}px`;
    s.setProperty("--jd-u", `${v.h / VOICE_H}px`);
    applyTurn(card.el, v.rot);
  }

  private drop(id: string) {
    const card = this.cards.get(id);
    card?.audio?.pause();
    card?.el.remove();
    this.cards.delete(id);
  }

  private make(v: ImageOnPage): Card {
    const el = document.createElement("div");
    el.className = "jd-plane-voice";
    el.dataset.block = v.blockId;
    el.innerHTML = `<button type="button" class="jd-voice-play" aria-label="Play voice note">`
      + `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${PLAY}"/></svg></button>`
      + `<div class="jd-voice-wave" aria-hidden="true">${"<span></span>".repeat(VOICE_BARS)}</div>`
      + `<span class="jd-voice-time"></span><p class="jd-voice-words"></p>`;
    this.el.append(el);
    const card: Card = {
      el, blockId: v.blockId, audio: null, ms: null,
      bars: [...el.querySelectorAll<HTMLElement>(".jd-voice-wave span")],
      time: el.querySelector(".jd-voice-time")!,
      words: el.querySelector(".jd-voice-words")!,
      icon: el.querySelector("path")!,
    };
    for (const bar of card.bars) bar.style.height = "8%";
    el.querySelector("button")!.addEventListener("pointerdown", (e) => e.stopPropagation());
    el.querySelector("button")!.addEventListener("click", () => void this.toggle(card));
    this.cards.set(v.id, card);
    void this.fill(card, 0);
    return card;
  }

  private clip(blockId: string, fresh = false) {
    if (fresh || !this.clips.has(blockId)) this.clips.set(blockId, this.src(blockId));
    return this.clips.get(blockId)!;
  }

  /** The time and the words, and the bars once the sound is decoded. The
   *  words come later than the sound, so a pending card asks again. */
  private async fill(card: Card, attempt: number) {
    const clip = await this.clip(card.blockId, attempt > 0);
    if (!clip || !card.el.isConnected) return;
    card.ms = clip.durationMs;
    card.time.textContent = clip.durationMs ? clock(clip.durationMs) : "";
    card.words.textContent = clip.transcript?.trim() || (clip.pending ? "Writing it down…" : "");
    if (attempt === 0) void this.wave(card, clip);
    const wait = WORDS_RETRY_MS[attempt];
    if (clip.pending && wait) setTimeout(() => void this.fill(card, attempt + 1), wait);
    // Out of patience: a promise the card cannot keep is worse than silence.
    else if (clip.pending) card.words.textContent = "";
  }

  private async wave(card: Card, clip: MediaClip) {
    if (!clip.durationMs || clip.durationMs > DECODE_CEILING_MS) return;
    try {
      const bytes = await (await fetch(clip.url)).arrayBuffer();
      const ctx = new AudioContext();
      const audio = await ctx.decodeAudioData(bytes);
      void ctx.close();
      peaks(audio.getChannelData(0)).forEach((p, i) => {
        card.bars[i]!.style.height = `${Math.round(p * 100)}%`;
      });
    } catch {
      // Storage that will not share its bytes with the page leaves the bars
      // flat: a line of sound, not an invented one.
    }
  }

  private async toggle(card: Card) {
    if (card.audio && !card.audio.paused) return void card.audio.pause();
    if (!card.audio) {
      const clip = await this.clip(card.blockId, true);
      if (!clip) return;
      card.audio = this.player(card, clip.url);
    }
    await card.audio.play().catch(() => undefined);
  }

  private player(card: Card, url: string): HTMLAudioElement {
    const audio = new Audio(url);
    const show = (playing: boolean) => {
      card.icon.setAttribute("d", playing ? PAUSE : PLAY);
      card.el.dataset.playing = String(playing);
    };
    audio.addEventListener("play", () => show(true));
    audio.addEventListener("pause", () => show(false));
    audio.addEventListener("ended", () => { show(false); this.progress(card, 0); });
    audio.addEventListener("timeupdate", () => {
      // A browser's own recording often reports its length as Infinity, so
      // the length the server measured is the fallback.
      const d = Number.isFinite(audio.duration) ? audio.duration : (card.ms ?? 0) / 1000;
      if (d > 0) this.progress(card, Math.min(1, audio.currentTime / d));
    });
    return audio;
  }

  private progress(card: Card, f: number) {
    const on = Math.round(f * card.bars.length);
    card.bars.forEach((bar, i) => { bar.dataset.on = String(i < on); });
  }
}
