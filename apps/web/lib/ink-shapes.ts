import type { Point } from "@jotacular/domain";

/**
 * Was that meant to be a circle? ADR-066.
 *
 * Pure geometry, and deliberately CONSERVATIVE. A snap nobody asked for is
 * worse than a snap that did not happen: the first silently replaces what
 * somebody drew, the second leaves it exactly as they left it. Every threshold
 * below is set so that the answer to "is this ambiguous?" is `null`.
 *
 * There is no confirm step anywhere in this file's story. A popup with a green
 * check inserts a DECISION into the capture moment, and docs/02 calls
 * sub-second capture non-negotiable while the risk register calls slow capture
 * fatal. The rule instead: ignoring a suggestion must be free. Lift the pen and
 * you keep what you drew.
 */

export type ShapeKind = "line" | "circle" | "rectangle" | "triangle";

export type Guess = { kind: ShapeKind; confidence: number };

/** Below this, we do not offer. Tuned toward silence. */
const FLOOR = 0.72;
/** A stroke shorter than this in document units is a tick or a dot. */
const MIN_SPAN = 24;
/** How close the ends must be, as a fraction of path length, to count closed. */
const CLOSED = 0.18;

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function pathLength(pts: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1]!, pts[i]!);
  return total;
}

function box(pts: readonly Point[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/**
 * What this stroke probably was, or null.
 *
 * Null is the common answer and the correct one. Handwriting is mostly not
 * shapes, and a recogniser that fires on the letter O would make writing
 * impossible.
 */
export function classify(pts: readonly Point[]): Guess | null {
  if (pts.length < 8) return null;
  const b = box(pts);
  if (Math.max(b.w, b.h) < MIN_SPAN) return null;

  const length = pathLength(pts);
  if (length <= 0) return null;

  const ends = dist(pts[0]!, pts[pts.length - 1]!);
  const closed = ends / length < CLOSED;

  const guess = closed ? closedShape(pts, b) : openShape(pts, length, ends);
  return guess && guess.confidence >= FLOOR ? guess : null;
}

/** A straight line: the path barely exceeds the distance between its ends. */
function openShape(pts: readonly Point[], length: number, ends: number): Guess | null {
  const straightness = ends / length;
  if (straightness < 0.94) return null;
  // 0.94 -> 0.72, 1.0 -> 1.0. A hand-drawn line is never exactly 1.
  return { kind: "line", confidence: clamp((straightness - 0.94) / 0.06 * 0.28 + 0.72) };
}

function closedShape(pts: readonly Point[], b: ReturnType<typeof box>): Guess | null {
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const radii = pts.map((p) => Math.hypot(p[0] - cx, p[1] - cy));
  const mean = radii.reduce((n, r) => n + r, 0) / radii.length;
  if (mean <= 0) return null;

  // A circle's points are all the same distance from the middle. Everything
  // else -- a square, a triangle, a scribbled loop -- is not.
  const spread = Math.sqrt(radii.reduce((n, r) => n + (r - mean) ** 2, 0) / radii.length) / mean;
  const square = Math.min(b.w, b.h) / Math.max(b.w, b.h);

  if (spread < 0.13 && square > 0.65) {
    return { kind: "circle", confidence: clamp(1 - spread / 0.13 * 0.28) };
  }

  // Corners: where the direction of travel turns sharply. Three is a triangle,
  // four a rectangle, and anything else is somebody's handwriting.
  const turns = corners(pts);
  const fill = area(pts) / Math.max(1, b.w * b.h);
  if (turns === 4 && fill > 0.62) return { kind: "rectangle", confidence: clamp(0.6 + fill * 0.35) };
  if (turns === 3 && fill > 0.34 && fill < 0.62) {
    return { kind: "triangle", confidence: clamp(0.55 + fill * 0.6) };
  }
  return null;
}

/** Direction changes above a threshold, measured over a window so a wobble in
 *  a hand-drawn edge does not read as a corner. */
function corners(pts: readonly Point[]): number {
  const step = Math.max(2, Math.floor(pts.length / 24));
  let count = 0;
  let sinceLast = Infinity;
  for (let i = step; i < pts.length - step; i += 1) {
    const a = angle(pts[i - step]!, pts[i]!);
    const c = angle(pts[i]!, pts[i + step]!);
    let turn = Math.abs(c - a);
    if (turn > Math.PI) turn = 2 * Math.PI - turn;
    if (turn > 1.0 && sinceLast > step * 2) { count++; sinceLast = 0; }
    sinceLast += 1;
  }
  // The join between the last point and the first is a corner too, and the
  // loop above cannot see it.
  return count + 1;
}

const angle = (a: Point, b: Point) => Math.atan2(b[1] - a[1], b[0] - a[0]);

/** The shoelace formula. Tells a filled outline from a scribble that happens
 *  to end where it started. */
function area(pts: readonly Point[]): number {
  let sum = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    sum += pts[j]![0] * pts[i]![1] - pts[i]![0] * pts[j]![1];
  }
  return Math.abs(sum) / 2;
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));

/**
 * The ideal version of what they drew, in the same box.
 *
 * Pressure, tilt and timing are carried across from the original stroke rather
 * than invented: they are what a better recogniser reads later, and a snapped
 * shape with fabricated pressure is a stroke that claims to have been drawn.
 */
export function snap(pts: readonly Point[], kind: ShapeKind): Point[] {
  const b = box(pts);
  const like = pts[0]!;
  const at = (x: number, y: number, t: number): Point => [x, y, t, like[3], like[4], like[5]];

  if (kind === "line") {
    const last = pts[pts.length - 1]!;
    return [at(like[0], like[1], like[2]), at(last[0], last[1], last[2])];
  }
  if (kind === "circle") {
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    const r = Math.max(b.w, b.h) / 2;
    const steps = 48;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const a = (i / steps) * Math.PI * 2;
      return at(cx + Math.cos(a) * r, cy + Math.sin(a) * r, like[2] + i);
    });
  }
  if (kind === "rectangle") {
    const corners: Array<[number, number]> = [
      [b.minX, b.minY], [b.maxX, b.minY], [b.maxX, b.maxY], [b.minX, b.maxY], [b.minX, b.minY],
    ];
    return edges(corners, at, like[2]);
  }
  const corners: Array<[number, number]> = [
    [(b.minX + b.maxX) / 2, b.minY], [b.maxX, b.maxY], [b.minX, b.maxY],
    [(b.minX + b.maxX) / 2, b.minY],
  ];
  return edges(corners, at, like[2]);
}

/** Points along each edge, so the curve fitter has something to follow and the
 *  corners stay sharp rather than being rounded off by Catmull-Rom. */
function edges(
  corners: Array<[number, number]>,
  at: (x: number, y: number, t: number) => Point,
  t0: number,
): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < corners.length - 1; i++) {
    const [x0, y0] = corners[i]!;
    const [x1, y1] = corners[i + 1]!;
    for (let s = 0; s < 8; s++) {
      out.push(at(x0 + (x1 - x0) * s / 8, y0 + (y1 - y0) * s / 8, t0 + out.length));
    }
  }
  const last = corners[corners.length - 1]!;
  out.push(at(last[0], last[1], t0 + out.length));
  return out;
}
