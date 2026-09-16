import type { ImageOnPage, Point, Sticker } from "@jotacular/domain";
import { stickerBounds } from "@jotacular/ink-render";
import { pointInPolygon, type Bounds } from "./ink-geometry";

/**
 * The objects that are simply a rectangle: photographs and stickers.
 * ADR-103, ADR-115.
 *
 * Split from ink-objects.ts when stickers became the second kind measured this
 * way, and the seam is real rather than a line count. A text box is
 * complicated -- a card round it, a height somebody may or may not have drawn,
 * a wrap no font engine is here to confirm -- and needs six functions that know
 * about all of it. A photo and a sticker are four numbers, and every question
 * asked of either is the same question about a rectangle.
 *
 * Pure, so it can be tested without a browser.
 */

/** The smallest box holding all of them, or null for none of them. */
export function unionOf(boxes: readonly Bounds[]): Bounds | null {
  let out: Bounds | null = null;
  for (const b of boxes) {
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
 * Caught when ALL FOUR CORNERS are inside the lasso.
 *
 * The rule strokes and boxes already use (ADR-033). "Any part inside" is more
 * forgiving and worse: a wide object overlapping the edge of a loop would come
 * along with whatever was actually circled, for no visible reason.
 */
export function rectInPolygon(poly: readonly Point[], b: Bounds): boolean {
  if (poly.length < 3) return false;
  return ([
    [b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h],
  ] as Array<[number, number]>).every(([x, y]) => pointInPolygon(poly, x, y));
}

/** Reversed, so the topmost wins -- matching what is drawn. */
export function rectAt<T>(
  items: readonly T[], area: (item: T) => Bounds, x: number, y: number,
): T | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]!;
    const b = area(item);
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return item;
  }
  return null;
}

/** Move them, in place, the way dragging a selection moves everything else. */
export function translateRects(items: readonly { x: number; y: number }[], dx: number, dy: number) {
  for (const item of items as { x: number; y: number }[]) {
    item.x += dx;
    item.y += dy;
  }
}

/**
 * A photograph's rectangle. ADR-103.
 *
 * It IS the placement -- no card, no derived height, nothing to keep in step.
 */
export const imageArea = (image: ImageOnPage): Bounds =>
  ({ x: image.x, y: image.y, w: image.w, h: image.h });

export const imagesBounds = (images: readonly ImageOnPage[]): Bounds | null =>
  unionOf(images.map(imageArea));

export const imageInPolygon = (poly: readonly Point[], image: ImageOnPage): boolean =>
  rectInPolygon(poly, imageArea(image));

export const imageAt = (images: readonly ImageOnPage[], x: number, y: number) =>
  rectAt(images, imageArea, x, y);

export const translateImages = (images: readonly ImageOnPage[], dx: number, dy: number) =>
  translateRects(images, dx, dy);

/**
 * A sticker's square -- from `@jotacular/ink-render`, never a copy. ADR-115.
 *
 * The same rule `boxBounds` follows and for the same reason: ADR-078 records
 * what it cost the last time the editor and the renderer each kept their own
 * idea of where an object ended.
 */
export const stickerArea = (sticker: Sticker): Bounds => stickerBounds(sticker);

export const stickersBounds = (stickers: readonly Sticker[]): Bounds | null =>
  unionOf(stickers.map(stickerArea));

export const stickerInPolygon = (poly: readonly Point[], sticker: Sticker): boolean =>
  rectInPolygon(poly, stickerArea(sticker));

export const stickerAt = (stickers: readonly Sticker[], x: number, y: number) =>
  rectAt(stickers, stickerArea, x, y);

export const translateStickers = (stickers: readonly Sticker[], dx: number, dy: number) =>
  translateRects(stickers, dx, dy);
