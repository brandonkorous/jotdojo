import type { TextBox } from "@jotdojo/domain";
import type { Bounds } from "./geometry";

/**
 * Where the typed text is, and what colour it has to be. ADR-065, ADR-079.
 *
 * Split from geometry.ts, whose own header says it "decides where the ink is".
 * That stopped being the whole truth the moment a page could hold notes as well
 * as strokes, and the two are measured by different rules: a stroke's box comes
 * from points that were actually drawn, and a note's comes from guessing how
 * text will wrap without a font engine to ask.
 */

/**
 * The line box, matching `.jd-text-box`'s CSS `line-height`.
 *
 * One constant, exported, because there were two and they disagreed: this file
 * used 1.25 while the browser laid text out at 1.35, so the same box was two
 * heights depending on who was asking. Nothing was drawn at its edge, so
 * nobody could see it. ADR-078.
 */
export const TEXT_LINE_HEIGHT = 1.35;

/** Roughly how many characters fit on a line, with no font engine to ask. */
const perLine = (box: TextBox) => Math.max(1, Math.floor(box.w / (box.size * 0.55)));

/** How tall the text alone wants to be, ignoring any height somebody drew. */
export function textContentHeight(box: TextBox): number {
  const cols = perLine(box);
  const lines = box.text.split("\n")
    .reduce((n, p) => n + Math.max(1, Math.ceil(p.length / cols)), 0);
  return Math.max(1, lines) * box.size * TEXT_LINE_HEIGHT;
}

/**
 * One text box's rectangle.
 *
 * `max(drawn, needed)`, which is exactly what the browser does to the textarea
 * -- `h` is a floor somebody dragged out, and text that outgrows it wins.
 * Writing the same rule in both places is the point: a card drawn here has to
 * land where the person saw it.
 *
 * The two agree exactly whenever the text fits the box that was drawn for it,
 * which is the ordinary case for a card. Past that, this falls back to
 * estimating the overflow from a character-width guess, because nothing here
 * has a font engine -- generously, since whitespace costs nothing and framing
 * short clips the last line off an export. Boxes written before ADR-078 have
 * no drawn height at all and are estimated whole.
 */
export function textBounds(box: TextBox): Bounds {
  return {
    x: box.x, y: box.y, w: box.w,
    h: Math.max(box.h ?? 0, textContentHeight(box)),
  };
}

/**
 * The breathing room between a card's text and its edge, as a multiple of the
 * text size so it holds at any zoom and any size. ADR-079.
 */
export const CARD_PAD = 0.55;

/**
 * The rectangle a card actually COVERS, which is bigger than its text.
 *
 * The padding inflates outward rather than insetting the text, so giving a box
 * a colour never moves a word. Somebody turning a note into a card watches the
 * card appear around what they wrote, instead of watching their text jump.
 *
 * A box with no fill has no card, and its bounds are its text -- which is every
 * box written before ADR-079, unchanged.
 */
export function cardBounds(box: TextBox): Bounds {
  const b = textBounds(box);
  if (!box.fill) return b;
  const pad = box.size * CARD_PAD;
  return { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
}

/**
 * Which ink stays legible on a given card colour.
 *
 * Relative luminance, not a hand-kept table, because the palette is not the
 * only thing that can end up here -- and a card whose text cannot be read is a
 * worse outcome than a card whose text is the wrong shade of right. The
 * threshold is the usual one for large-ish text on a solid ground.
 *
 * Charcoal and paper are the house neutrals rather than pure black and white:
 * ADR-072 chose them, and pure black on mint reads as a hole. ADR-079.
 */
export function inkOn(fill: string): string {
  return luminance(fill) > 0.5 ? "#111418" : "#F7F3EA";
}

function luminance(hex: string): number {
  const v = hex.replace("#", "");
  const channel = (at: number) => {
    const c = parseInt(v.slice(at, at + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  // Rec. 709 coefficients: the eye is far more sensitive to green than to blue,
  // so an average would call a saturated blue light and a saturated green dark.
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}
