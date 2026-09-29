import type { Stroke } from "@jotacular/domain";
import { HIGHLIGHTER_ALPHA, paintStroke } from "./ink-paint";
import { paperIsDark } from "./ink-night";

/**
 * Every highlight on a layer, laid down ONCE. ADR-132.
 *
 * Each stroke is drawn solid on a scratch canvas, and the scratch is then put
 * on the page at the marker's alpha. Overlaps -- a pass over the same words,
 * or a stroke's own segments meeting -- are one coat, not three.
 */
let scratch: HTMLCanvasElement | null = null;

export function paintHighlights(ctx: CanvasRenderingContext2D, strokes: readonly Stroke[]) {
  if (strokes.length === 0) return;
  const { width, height } = ctx.canvas;
  scratch ??= document.createElement("canvas");
  if (scratch.width !== width || scratch.height !== height) {
    scratch.width = width;
    scratch.height = height;
  }
  const s = scratch.getContext("2d")!;
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.clearRect(0, 0, width, height);
  s.setTransform(ctx.getTransform());
  for (const stroke of strokes) paintStroke(s, stroke, true);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = HIGHLIGHTER_ALPHA;
  // Multiply keeps the words underneath readable; a dark page has nothing to
  // darken, so it takes the wash plain. ADR-116.
  if (!paperIsDark()) ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(scratch, 0, 0);
  ctx.restore();
}
