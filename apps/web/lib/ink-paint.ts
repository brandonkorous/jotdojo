import type { Point, Stroke } from "@jotacular/domain";
import type { Bounds } from "./ink-geometry";
import type { Segment } from "@jotacular/ink-render";
import { inkFor, paperIsDark } from "./ink-night";

/** 3x on a large canvas costs more than it returns. docs/08. */
export const MAX_DPR = 2;

export const HIGHLIGHTER_ALPHA = 0.35;
export const HIGHLIGHTER_WIDTH = 18;
export const PEN_WIDTH = 2.2;
/** Pressure scales width between these multiples of the base. */
export const PRESSURE_RANGE = [0.45, 1.6] as const;
/** How close a pointer must come to a stroke to erase it, in canvas pixels. */
export const ERASE_RADIUS = 10;

/** The house `agent` blue, so a selection never reads as ink. docs/10. */
const SELECT_STROKE = "#4B5FA8";
const SELECT_FILL = "rgba(75, 95, 168, 0.10)";

/** Mint, the house primary -- design.md §11 gives it "capture cues", and a box
 *  being drawn is exactly that. Free to use it plainly since ADR-073 retired
 *  the one-per-screen seal rule. ADR-078. */
const DRAW_STROKE = "#00C2A8";
const DRAW_FILL = "rgba(0, 194, 168, 0.08)";

/** The highlighter is deliberately unmodulated -- a marker has one width. */
export function widthAt(stroke: Stroke, pressure: number): number {
  if (stroke.tool === "highlighter") return stroke.width;
  const [lo, hi] = PRESSURE_RANGE;
  return stroke.width * (lo + (hi - lo) * Math.min(1, Math.max(0, pressure)));
}

/**
 * Draw one stroke as a chain of cubic béziers fitted through its points.
 *
 * Catmull-Rom converted to bézier control points: for the segment p1→p2,
 * c1 = p1 + (p2 - p0)/6 and c2 = p2 - (p3 - p1)/6. The curve passes through
 * every captured point, which matters because those points are what the
 * person actually drew -- an approximating spline would smooth away the
 * character of their handwriting.
 *
 * Each segment is stroked separately so the width can follow pressure. One
 * path for the whole stroke would be cheaper and would give a dead, uniform
 * line.
 */
export function paintStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const pts = stroke.pts;
  if (pts.length === 0) return;

  ctx.save();
  const color = inkFor(stroke.color);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  if (stroke.tool === "highlighter") {
    // Multiply keeps overlapping passes readable instead of turning the text
    // underneath into a solid block. On charcoal it has nothing to darken, and
    // screen compounds past the words, so a dark page takes the wash plain and
    // lets the night colour be the ceiling. ADR-116.
    if (!paperIsDark()) ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = HIGHLIGHTER_ALPHA;
  }

  // A dot: someone tapped without moving.
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0]![0], pts[0]![1], widthAt(stroke, pts[0]![3]) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;

    ctx.beginPath();
    ctx.lineWidth = widthAt(stroke, (p1[3] + p2[3]) / 2);
    ctx.moveTo(p1[0], p1[1]);
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
      p2[0], p2[1],
    );
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * The lasso path itself, while it is being drawn.
 *
 * `k` is the zoom. Ink is world-space and must scale with the page, but the
 * lasso is CHROME -- a marquee that thickens as you zoom in reads as part of
 * the drawing. Dividing by k holds it at a constant size on screen.
 */
export function paintLasso(ctx: CanvasRenderingContext2D, pts: readonly Point[], k = 1) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = SELECT_STROKE;
  ctx.fillStyle = SELECT_FILL;
  ctx.lineWidth = 1.5 / k;
  // Dashed and closing back to the start, so the shape reads as an enclosure
  // being drawn rather than as a very thin pen stroke.
  ctx.setLineDash([6 / k, 4 / k]);
  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1]);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** The marquee around a settled selection, with a handle-free look. Same
 *  constant-on-screen rule as the lasso above. */
export function paintSelection(ctx: CanvasRenderingContext2D, b: Bounds, k = 1) {
  const pad = 6 / k;
  ctx.save();
  ctx.strokeStyle = SELECT_STROKE;
  ctx.fillStyle = SELECT_FILL;
  ctx.lineWidth = 1.5 / k;
  ctx.setLineDash([4 / k, 3 / k]);
  ctx.beginPath();
  ctx.rect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * The box being dragged out, before it is a box. ADR-078.
 *
 * Solid rather than dashed, and mint rather than the selection's blue: this is
 * something being MADE, not something being chosen, and the two gestures look
 * enough alike on a trackpad that the colours have to disagree.
 *
 * Flat, with no gradient and no glow -- design.md §12 bans those outright. The
 * elevation ADR-077 restored belongs to a card that has landed, not to a
 * rectangle that does not exist yet.
 */
export function paintTextRect(ctx: CanvasRenderingContext2D, b: Bounds, k = 1) {
  ctx.save();
  ctx.strokeStyle = DRAW_STROKE;
  ctx.fillStyle = DRAW_FILL;
  ctx.lineWidth = 1.5 / k;
  ctx.beginPath();
  ctx.rect(b.x, b.y, b.w, b.h);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** How long an arrowhead is, as a multiple of the line's width, and how wide
 *  it opens. Tuned against a 2.2pt pen so an arrow reads at a glance. */
const HEAD_LENGTH = 5.5;
const HEAD_SPREAD = 0.42;

/**
 * One arrow, in world space. ADR-108.
 *
 * Drawn on the COMMITTED layer with the strokes, which puts it behind the
 * object plane -- so an arrow between two cards passes under them rather than
 * over the words. That is what a line drawn on paper does.
 */
export function paintLink(
  ctx: CanvasRenderingContext2D, seg: Segment, style: LinkStyle,
) {
  ctx.save();
  const color = inkFor(style.color);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = style.width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(seg.x1, seg.y1);
  ctx.lineTo(seg.x2, seg.y2);
  ctx.stroke();

  if (style.head !== "none") head(ctx, seg.x2, seg.y2, seg.x1, seg.y1, style.width);
  if (style.head === "both") head(ctx, seg.x1, seg.y1, seg.x2, seg.y2, style.width);
  ctx.restore();
}

export type LinkStyle = { color: string; width: number; head: "end" | "both" | "none" };

/** A filled triangle at (x, y), pointing away from (fromX, fromY). */
function head(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, fromX: number, fromY: number, width: number,
) {
  const angle = Math.atan2(y - fromY, x - fromX);
  const length = width * HEAD_LENGTH;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - length * Math.cos(angle - HEAD_SPREAD), y - length * Math.sin(angle - HEAD_SPREAD));
  ctx.lineTo(x - length * Math.cos(angle + HEAD_SPREAD), y - length * Math.sin(angle + HEAD_SPREAD));
  ctx.closePath();
  ctx.fill();
}

/**
 * The arrow being aimed, before it has a second end. ADR-108.
 *
 * Mint and solid, the colours ADR-078 gave to something being MADE, so it
 * cannot be mistaken for an arrow that already exists or for a selection.
 */
export function paintAim(ctx: CanvasRenderingContext2D, seg: Segment, k = 1) {
  ctx.save();
  ctx.strokeStyle = DRAW_STROKE;
  ctx.fillStyle = DRAW_STROKE;
  ctx.lineWidth = 2 / k;
  ctx.setLineDash([7 / k, 5 / k]);
  ctx.beginPath();
  ctx.moveTo(seg.x1, seg.y1);
  ctx.lineTo(seg.x2, seg.y2);
  ctx.stroke();
  ctx.setLineDash([]);
  head(ctx, seg.x2, seg.y2, seg.x1, seg.y1, 2 / k);
  ctx.restore();
}
