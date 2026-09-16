import type { Sticker } from "@jotacular/domain";
import type { Bounds } from "./geometry";
import { STICKER_ART, type StickerArt } from "./sticker-art";

/**
 * Where a sticker's picture sits inside the square it occupies. ADR-115.
 *
 * A third geometry file beside `geometry` (the ink) and `text-geometry` (the
 * notes), measured by its own rule again: a sticker's box is one number
 * somebody chose, and the artwork inside it has a shape nobody chose. `fire`
 * is 448x512, so fitting is not optional.
 *
 * IN THIS PACKAGE, so the canvas and the worker place a sticker identically.
 * ADR-078 records what the alternative cost the last time.
 */

/** The square. One number, because a sticker keeps its own proportions --
 *  ink-sticker.ts says why there is no separate width and height. */
export const stickerBounds = (s: Sticker): Bounds =>
  ({ x: s.x, y: s.y, w: s.size, h: s.size });

/**
 * The white edge, as a fraction of the sticker's size. ADR-115.
 *
 * This is the whole difference between an icon and a sticker: a die-cut edge
 * reads as something laid ON the page rather than drawn into it, which is what
 * lets a mark sit over handwriting and stay legible.
 */
export const STICKER_BORDER = 0.07;

export type StickerPlacement = {
  art: StickerArt;
  /** Document units per viewBox unit. */
  k: number;
  /** Where the artwork's own origin goes, in document units. */
  tx: number;
  ty: number;
  /** Stroke width in VIEWBOX units. Half of it is hidden under the fill, which
   *  is what `paint-order="stroke fill"` does and why this is doubled. */
  stroke: number;
};

/**
 * Fit one sticker's artwork into its box, or null if the name has no art.
 *
 * Null is survivable and deliberate: a page written by a newer client may name
 * a sticker this build has never heard of, and skipping it beats drawing a
 * hole or refusing the whole page.
 */
export function placeSticker(s: Sticker): StickerPlacement | null {
  const art = STICKER_ART[s.name];
  if (!art) return null;
  const longest = Math.max(art.w, art.h);
  // Inset, so the white edge has somewhere to go. Artwork scaled to the full
  // box would have its border clipped flat on two sides.
  const inner = s.size * (1 - STICKER_BORDER * 2);
  const k = inner / longest;
  return {
    art,
    k,
    tx: s.x + (s.size - art.w * k) / 2,
    ty: s.y + (s.size - art.h * k) / 2,
    stroke: STICKER_BORDER * 2 * longest,
  };
}
