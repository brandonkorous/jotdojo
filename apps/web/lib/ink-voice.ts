/**
 * How big a voice card is. ADR-121. Pure, so a smoke script can hold it.
 *
 * Wide and short, like the thing it shows: a button, a line of sound, a time.
 */
export const VOICE_W = 320;
export const VOICE_H = 88;
/** Bars in the waveform. Enough to read as sound, few enough to be tapped. */
export const VOICE_BARS = 32;
const SCREEN_FRACTION = 0.8;

/** The same size on the glass whatever the zoom, but never wider than most of
 *  a phone. In document units. */
export function voiceSize(screen: { w: number; h: number }, k: number): { w: number; h: number } {
  const onGlass = Math.min(VOICE_W, screen.w * SCREEN_FRACTION);
  const w = onGlass / k;
  return { w, h: (w * VOICE_H) / VOICE_W };
}

/**
 * Loudness in `bars` buckets, 0..1, from one channel of decoded samples.
 * The peak of each bucket, then scaled so the loudest bar is full height:
 * a quiet recording should still look like speech rather than a flat line.
 */
export function peaks(samples: ArrayLike<number>, bars = VOICE_BARS): number[] {
  const out: number[] = [];
  const step = Math.max(1, Math.floor(samples.length / bars));
  for (let b = 0; b < bars; b++) {
    let top = 0;
    const end = Math.min(samples.length, (b + 1) * step);
    for (let i = b * step; i < end; i++) top = Math.max(top, Math.abs(samples[i]!));
    out.push(top);
  }
  const loudest = Math.max(...out, 1e-6);
  return out.map((v) => Math.max(0.06, v / loudest));
}

export const clock = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};
