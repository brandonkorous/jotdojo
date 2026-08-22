import type { InkDocument } from "@jotdojo/domain";
import { bounds, intersects, strokeBounds, type Bounds } from "./geometry";
import { scaleFor } from "./svg";

/**
 * Cut the ink into pieces a model can actually read.
 *
 * A model reading a whole surface at once skims the middle, and the overlap
 * means a line of handwriting on a seam is whole in at least one piece.
 *
 * TWO DIMENSIONS, because a whiteboard spreads sideways. Full-width bands over
 * an 8000-unit-wide board get shrunk by the longest-edge cap until nothing is
 * legible -- the same failure as clipping, through a different door. When the
 * content is one tile wide this produces exactly one column, which is the old
 * banding behaviour and costs nothing extra.
 */

export type Tile = {
  /** Rect in DOCUMENT coordinates. Hand straight to `toSvg` as `bounds`. */
  rect: Bounds;
  /** The strokes that touch this rect, drawn whole and NOT copied. */
  doc: InkDocument;
  row: number;
  col: number;
  /** Reading order among the non-empty tiles. */
  index: number;
  of: number;
};

export type TileOptions = {
  /** Tile size in RENDERED PIXELS -- the model's frame, not document units.
   *  On an endless canvas 700 units is four pages of writing when drawn zoomed
   *  out and two letters when drawn zoomed in. Only pixels mean anything. */
  tilePx?: { w: number; h: number };
  overlapPx?: number;
  maxEdge?: number;
  maxUpscale?: number;
  bounds?: Bounds;
};

const TILE_PX = { w: 1600, h: 700 };
const OVERLAP_PX = 80;

export function tiles(doc: InkDocument, options: TileOptions = {}): Tile[] {
  const box = options.bounds ?? bounds(doc);
  if (!box) return [];

  // One scale for the whole page, not per tile: the same handwriting arriving
  // at different magnifications across images reads as different hands.
  const scale = scaleFor(doc, box, {
    mode: "recognition", maxEdge: options.maxEdge, maxUpscale: options.maxUpscale,
  });

  const px = options.tilePx ?? TILE_PX;
  const tileW = px.w / scale;
  const tileH = px.h / scale;
  // Never let the overlap swallow the step -- that is an infinite loop, not a
  // generous seam.
  const overlap = Math.min(options.overlapPx ?? OVERLAP_PX, Math.min(px.w, px.h) / 2) / scale;
  const stepX = Math.max(tileW - overlap, 1);
  const stepY = Math.max(tileH - overlap, 1);

  const cols = box.w <= tileW ? 1 : Math.ceil((box.w - overlap) / stepX);
  const rows = box.h <= tileH ? 1 : Math.ceil((box.h - overlap) / stepY);

  // One box per stroke, once. Membership is then an interval overlap per tile
  // rather than a walk over every point.
  const boxes = doc.strokes.map(strokeBounds);

  const out: Tile[] = [];
  const seen = new Set<string>();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // The last row and column are pulled back flush with the content edge
      // instead of hanging off it, so every tile is a full frame and none is a
      // sliver whose viewBox crops the strokes it was meant to show.
      const rect: Bounds = {
        x: cols === 1 ? box.x : Math.min(box.x + col * stepX, box.x + box.w - tileW),
        y: rows === 1 ? box.y : Math.min(box.y + row * stepY, box.y + box.h - tileH),
        w: cols === 1 ? box.w : tileW,
        h: rows === 1 ? box.h : tileH,
      };

      const key = `${Math.round(rect.x)},${Math.round(rect.y)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Rectangle overlap, NOT "some point falls inside". A two-point divider
      // spanning the whole board has no sample in the middle tile and is
      // invisible to a point test -- and a zoomed-out board is full of them.
      const strokes = doc.strokes.filter((_, i) => {
        const b = boxes[i];
        return b ? intersects(b, rect) : false;
      });
      if (strokes.length === 0) continue;

      out.push({ rect, doc: { ...doc, strokes }, row, col, index: 0, of: 0 });
    }
  }

  return out.map((tile, index) => ({ ...tile, index, of: out.length }));
}
