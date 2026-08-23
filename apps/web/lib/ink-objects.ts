import type { Point, TextBox } from "@jotdojo/domain";
import { cardBounds, textBounds } from "@jotdojo/ink-render";
import { pointInPolygon, type Bounds } from "./ink-geometry";

/**
 * Text boxes as things on the plane. ADR-065.
 *
 * The geometry half of canvas text: where a box is, whether a lasso caught it,
 * and how big it looks. No DOM here -- `ink-plane.ts` owns the elements. This
 * file is what the engine and the selection reason about, and it is pure so it
 * can be tested without a browser.
 */

/**
 * One box's rectangle -- from `@jotdojo/ink-render`, never a copy.
 *
 * There WAS a copy here, and it multiplied by 1.35 where the renderer used
 * 1.25, so a lasso and an export disagreed about where a box ended. Invisible
 * while a box had no edges drawn; a wrong-sized card the moment one did.
 * ink-index.ts states the rule this broke. ADR-078.
 */
export const boxBounds = (box: TextBox): Bounds => textBounds(box);

/**
 * What a box OCCUPIES: its card when it has one, its text when it does not.
 *
 * This is the rectangle every interaction should use. Tapping the coloured
 * margin of a card has to open it -- a card whose corner is not part of it is
 * an infuriating object -- and a lasso drawn round a card has to enclose the
 * colour a person can see, not an invisible inner rectangle. ADR-079.
 */
export const boxArea = (box: TextBox): Bounds => cardBounds(box);

export function boxesBounds(boxes: readonly TextBox[]): Bounds | null {
  let out: Bounds | null = null;
  for (const box of boxes) {
    const b = boxArea(box);
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
  const b = boxArea(box);
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
    const b = boxArea(box);
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
  height?: number,
): TextBox {
  return {
    id: crypto.randomUUID(),
    x, y: y - style.size * 0.8,
    w: width,
    // Only a dragged box gets a height. A tapped one has no opinion about how
    // tall it is, which is what keeps a tap a tap. ADR-078.
    ...(height === undefined ? {} : { h: height }),
    size: style.size,
    color: style.color,
    text: "",
  };
}

/** A box drawn corner to corner, rather than tapped. The rectangle IS the box,
 *  so unlike `newBox` the y is where the pointer went down. */
export function drawnBox(
  rect: Bounds, style: { size: number; color: string },
): TextBox {
  return {
    id: crypto.randomUUID(),
    x: rect.x, y: rect.y, w: rect.w, h: rect.h,
    size: style.size, color: style.color, text: "",
  };
}

/** Boxes with nothing in them. A person who tapped, thought better of it and
 *  tapped elsewhere should not leave a trail of empty rectangles. */
export const isEmpty = (box: TextBox) => box.text.trim() === "";
