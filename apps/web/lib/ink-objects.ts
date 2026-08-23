import type { Point, TextBox } from "@jotdojo/domain";
import { pointInPolygon, type Bounds } from "./ink-geometry";

/**
 * Text boxes as things on the plane. ADR-065.
 *
 * The geometry half of canvas text: where a box is, whether a lasso caught it,
 * and how big it looks. No DOM here -- `ink-plane.ts` owns the elements. This
 * file is what the engine and the selection reason about, and it is pure so it
 * can be tested without a browser.
 */

/** Rough, and rough is right: the real height comes from the DOM once the box
 *  is laid out. This is what hit-testing uses before that has happened. */
export const LINE_HEIGHT = 1.35;

export function boxBounds(box: TextBox, measured?: number): Bounds {
  const perLine = Math.max(1, Math.floor(box.w / (box.size * 0.55)));
  const lines = box.text.split("\n")
    .reduce((n, p) => n + Math.max(1, Math.ceil(p.length / perLine)), 0);
  return {
    x: box.x, y: box.y, w: box.w,
    h: measured ?? Math.max(1, lines) * box.size * LINE_HEIGHT,
  };
}

export function boxesBounds(boxes: readonly TextBox[]): Bounds | null {
  let out: Bounds | null = null;
  for (const box of boxes) {
    const b = boxBounds(box);
    if (!out) { out = { ...b }; continue; }
    const x = Math.min(out.x, b.x);
    const y = Math.min(out.y, b.y);
    out = {
      x, y,
      w: Math.max(out.x + out.w, b.x + b.w) - x,
      h: Math.max(out.y + out.h, b.y + b.h) - y,
    };
  }
  return out;
}

/**
 * A box is caught when ALL FOUR CORNERS are inside the lasso.
 *
 * The same rule strokes use (ADR-033), for the same reason: "any part inside"
 * is more forgiving and worse, because a wide box overlapping the edge of a
 * loop would come along with whatever was actually circled and the person would
 * not know why. Whole-object containment is what pen apps do, and applying one
 * rule to both kinds is what makes a mixed selection explicable.
 */
export function boxInPolygon(poly: readonly Point[], box: TextBox): boolean {
  if (poly.length < 3) return false;
  const b = boxBounds(box);
  const corners: Array<[number, number]> = [
    [b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h],
  ];
  return corners.every(([x, y]) => pointInPolygon(poly, x, y));
}

/** Whether a point lands on a box, for tapping into one to edit it. Reversed
 *  so the topmost box wins, matching what is drawn. */
export function boxAt(boxes: readonly TextBox[], x: number, y: number): TextBox | null {
  for (let i = boxes.length - 1; i >= 0; i--) {
    const box = boxes[i]!;
    const b = boxBounds(box);
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return box;
  }
  return null;
}

/** Move boxes, in place, the way dragging a selection moves strokes. */
export function translateBoxes(boxes: readonly TextBox[], dx: number, dy: number): void {
  for (const box of boxes as TextBox[]) {
    box.x += dx;
    box.y += dy;
  }
}

/**
 * A new box where somebody tapped.
 *
 * The tap is where the TEXT starts, not where the box's corner goes, so the
 * caret appears under the finger rather than down and to the right of it.
 */
export function newBox(
  x: number, y: number, style: { size: number; color: string }, width: number,
): TextBox {
  return {
    id: crypto.randomUUID(),
    x, y: y - style.size * 0.8,
    w: width,
    size: style.size,
    color: style.color,
    text: "",
  };
}

/** Boxes with nothing in them. A person who tapped, thought better of it and
 *  tapped elsewhere should not leave a trail of empty rectangles. */
export const isEmpty = (box: TextBox) => box.text.trim() === "";
