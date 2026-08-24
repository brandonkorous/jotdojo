import type { ImageOnPage, Stroke, TextBox } from "@jotacular/domain";
import type { InkSelection } from "./ink-selection";
import { MIN_SIZE } from "./ink-plane";
import { classify, snap } from "./ink-shapes";

/**
 * How big a caught thing is, and what shape it turned out to be. ADR-066,
 * ADR-084, ADR-103.
 *
 * Split from ink-engine-select.ts when photographs became a third kind and that
 * file reached the 250-line limit. The seam is real: everything there is about
 * WHICH objects are held and where they are, and everything here changes the
 * geometry of the ones already caught.
 *
 * Both functions MUTATE IN PLACE, which is not an accident -- the plane, the
 * selection and the page all hold the same objects, and copying would leave two
 * of the three showing the old size.
 */

/** One step of bigger or smaller, geometric so repeats feel even. */
const STEP = 1.25;
const MIN_WIDTH = 0.5;
const MAX_WIDTH = 64;
/** Above this a note stops being a note and becomes a poster. */
const MAX_TEXT = 160;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Bigger or smaller, one step. ADR-084.
 *
 * Steps rather than a slider, because a menu is a poor host for a drag and the
 * selection bar already owns the continuous control. Geometric, so three
 * presses of "bigger" feel like three of the same size rather than three
 * diminishing ones.
 *
 * Every kind at once: a stroke's width, a note's text size and a photograph's
 * rectangle are the same question asked of three things, and a mixed selection
 * would otherwise need a rule for which parts to ignore.
 */
export function resizeSelection(sel: InkSelection, bigger: boolean): boolean {
  if (sel.count === 0) return false;
  const f = bigger ? STEP : 1 / STEP;

  for (const stroke of sel.selected as Stroke[]) {
    stroke.width = clamp(stroke.width * f, MIN_WIDTH, MAX_WIDTH);
  }
  for (const box of sel.selectedTexts as TextBox[]) {
    // Floored at MIN_SIZE, and not for tidiness: iOS Safari zooms the page when
    // a field's COMPUTED font-size is under 16px. The plane already clamps what
    // it renders, so a smaller stored size would make the export disagree with
    // the screen rather than make anything smaller.
    box.size = clamp(box.size * f, MIN_SIZE, MAX_TEXT);
  }
  // A photograph scales about its own centre, so a row of them does not walk
  // off down the page as somebody presses "bigger" three times.
  for (const pic of sel.selectedImages as ImageOnPage[]) {
    const w = pic.w * f;
    const h = pic.h * f;
    pic.x += (pic.w - w) / 2;
    pic.y += (pic.h - h) / 2;
    pic.w = w;
    pic.h = h;
  }
  return true;
}

/**
 * Make the rough thing the shape it was going for. ADR-066, ADR-084.
 *
 * Hold-to-snap only offers in the moment: keep the pen down a beat and the
 * circle becomes one, lift and you keep exactly what you drew. That is the
 * right default and it is a one-time offer, which is a strange property for
 * something a person may only notice they wanted afterwards.
 *
 * This is the same classifier and the same snap, asked for deliberately instead
 * of guessed at. Nothing here lowers the confidence floor -- if the classifier
 * will not name the shape, the menu does not offer to tidy it.
 */
export function tidySelection(sel: InkSelection): boolean {
  const stroke = sel.selected[0];
  if (!stroke || sel.count !== 1) return false;
  const guess = classify(stroke.pts);
  if (!guess) return false;
  stroke.pts = snap(stroke.pts, guess.kind);
  return true;
}
