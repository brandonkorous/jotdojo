import type { InkDocument, Point, Stroke } from "@jotacular/domain";
import { cardBounds } from "./text-geometry";

/**
 * Where the ink actually is, in document units.
 *
 * The stored `canvas` cannot answer this. It is the viewport the layer was
 * created at, written once and never updated (ADR-053) -- so on an endless
 * canvas, and already today after a rotation, ink lives outside it.
 */

export type Bounds = { x: number; y: number; w: number; h: number };

/** Pressure widens a pen line; the highlighter is a fixed nib. */
const PRESSURE_RANGE = [0.45, 1.6] as const;

export function widthAt(stroke: Stroke, pressure: number): number {
  if (stroke.tool === "highlighter") return stroke.width;
  const [lo, hi] = PRESSURE_RANGE;
  return stroke.width * (lo + (hi - lo) * Math.min(1, Math.max(0, pressure)));
}

/**
 * The cubic control points for the segment pts[i] -> pts[i+1].
 *
 * Shared by the renderer and by `strokeBounds` on purpose: a box computed from
 * different control points than the ones drawn is a box that clips ink.
 */
export function control(pts: readonly Point[], i: number) {
  const p0 = pts[Math.max(0, i - 1)]!;
  const p1 = pts[i]!;
  const p2 = pts[i + 1]!;
  const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
  return {
    c1x: p1[0] + (p2[0] - p0[0]) / 6,
    c1y: p1[1] + (p2[1] - p0[1]) / 6,
    c2x: p2[0] - (p3[0] - p1[0]) / 6,
    c2y: p2[1] - (p3[1] - p1[1]) / 6,
  };
}

/**
 * One stroke's box, inflated by the ink it actually lays down.
 *
 * `stroke-linecap="round"` pushes ink half a width past every endpoint, so a
 * box drawn through the centres clips the caps at every tile seam.
 */
export function strokeBounds(stroke: Stroke): Bounds | null {
  const pts = stroke.pts;
  if (pts.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const eat = (x: number, y: number, r: number) => {
    if (x - r < minX) minX = x - r;
    if (y - r < minY) minY = y - r;
    if (x + r > maxX) maxX = x + r;
    if (y + r > maxY) maxY = y + r;
  };

  if (pts.length === 1) {
    const p = pts[0]!;
    eat(p[0], p[1], widthAt(stroke, p[3]) / 2);
  }

  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const r = widthAt(stroke, (p1[3] + p2[3]) / 2) / 2;
    const c = control(pts, i);
    eat(p1[0], p1[1], r);
    eat(p2[0], p2[1], r);
    // A cubic lies inside the convex hull of its four control points, so
    // folding these in makes the box a provable bound rather than a guess at
    // how far the Catmull-Rom conversion overshoots.
    eat(c.c1x, c.c1y, r);
    eat(c.c2x, c.c2y, r);
  }

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function union(a: Bounds, b: Bounds): Bounds {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  };
}

/** Rectangles touching counts as overlapping: a stroke exactly on a seam
 *  belongs to both tiles rather than neither. */
export function intersects(a: Bounds, b: Bounds): boolean {
  return a.x <= b.x + b.w && a.x + a.w >= b.x
    && a.y <= b.y + b.h && a.y + a.h >= b.y;
}

/**
 * The INK box, or null when nothing is drawn.
 *
 * Null rather than a degenerate 1x1: a blank page rendered and sent to a vision
 * model is a billed request that answers nothing. The caller decides.
 *
 * Strokes only, and deliberately so: this is what recognition frames, and
 * including typed text would stretch the frame over ground with no handwriting
 * on it -- more tiles, each carrying less, all of them billed. ADR-065.
 */
export function bounds(doc: InkDocument): Bounds | null {
  return strokesBounds(doc.strokes);
}

/**
 * Everything ON the page -- ink and typed text both.
 *
 * What a person means by "the content", and therefore what export, `view_note`
 * and the canvas's own fit-to-content use. A note with nothing but a typed box
 * on it has no `bounds()` at all, and would otherwise open on blank paper or
 * export as a 1x1 image.
 */
export function contentBounds(doc: InkDocument): Bounds | null {
  let box = strokesBounds(doc.strokes);
  // The CARD, not the text: a frame drawn to the words would slice the colour
  // off every edge of an exported note.
  for (const text of doc.texts ?? []) {
    const b = cardBounds(text);
    box = box ? union(box, b) : b;
  }
  return box;
}

/** The same, for a caller holding strokes rather than a document -- the
 *  browser engine, which needs to know where the ink is to frame it. */
export function strokesBounds(strokes: readonly Stroke[]): Bounds | null {
  let box: Bounds | null = null;
  for (const stroke of strokes) {
    const b = strokeBounds(stroke);
    if (b) box = box ? union(box, b) : b;
  }
  return box;
}

/**
 * The typical pen width, which is a free zoom oracle.
 *
 * The client keeps a constant pen width in DEVICE space, so what lands in the
 * document is `constant / zoom`. Ink drawn zoomed out is stored thin, and this
 * is how the renderer knows to enlarge it back to something legible.
 */
export function medianWidth(strokes: readonly Stroke[]): number {
  const widths = strokes
    .filter((s) => s.pts.length > 0)
    .map((s) => s.width)
    .sort((a, b) => a - b);
  return widths.length === 0 ? 0 : widths[Math.floor(widths.length / 2)]!;
}
