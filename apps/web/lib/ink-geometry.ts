import type { Point, Stroke } from "@jotacular/domain";

/** Squared distance. Comparisons never need the square root. */
export const dist2 = (ax: number, ay: number, bx: number, by: number) =>
  (ax - bx) ** 2 + (ay - by) ** 2;

export type Bounds = { x: number; y: number; w: number; h: number };

/** Axis-aligned bounds of a set of strokes, or null when there are none. */
export function strokeBounds(strokes: Stroke[]): Bounds | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const stroke of strokes) {
    for (const p of stroke.pts) {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
  }
  if (minX === Infinity) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export const inBounds = (b: Bounds, x: number, y: number) =>
  x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

/**
 * Ray casting: count crossings of a ray running +x from the point. Odd is
 * inside. Handles concave polygons, which a lasso almost always is.
 */
export function pointInPolygon(poly: readonly Point[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]![0], yi = poly[i]![1];
    const xj = poly[j]![0], yj = poly[j]![1];
    // The `yi > y !== yj > y` test also excludes horizontal edges, which would
    // otherwise divide by zero below.
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * A stroke is selected only when it lies ENTIRELY inside the lasso.
 *
 * "Any point inside" is more forgiving and worse: one long underline passing
 * through the loop would come along with the words above it, and the person
 * would not know why. Whole-stroke containment is what pen apps do. ADR-033.
 */
export function strokeInPolygon(poly: readonly Point[], stroke: Stroke): boolean {
  if (stroke.pts.length === 0) return false;
  return stroke.pts.every((p) => pointInPolygon(poly, p[0], p[1]));
}

/**
 * Move a stroke, preserving everything that is not position.
 *
 * Timestamps, pressure and tilt are what a better model reads later, so a move
 * copies them across untouched rather than rebuilding the points. docs/08.
 */
export function translateStroke(stroke: Stroke, dx: number, dy: number): Stroke {
  return {
    ...stroke,
    pts: stroke.pts.map((p) => [p[0] + dx, p[1] + dy, p[2], p[3], p[4], p[5]] as Point),
  };
}
