import type { ImageOnPage, Link, LinkEnd, Stroke, TextBox } from "@jotacular/domain";
import { strokeBounds, type Bounds } from "./geometry";
import { cardBounds } from "./text-geometry";

/**
 * Where an arrow actually starts and stops. ADR-108.
 *
 * IN THIS PACKAGE, not in the canvas, and that is the whole point. ADR-078
 * records what happened the last time the editor and the renderer each kept
 * their own idea of where an object ended: they disagreed by a tenth, and a
 * lasso and an export drew different pictures of the same page. One arrow,
 * drawn the same way on a phone and in a worker, or it is two features.
 *
 * An end that names an object is resolved against the PAGE every time it is
 * drawn rather than stored. That is what makes a connector a connector: move
 * the card and the arrow comes with it, with nothing to keep in step.
 */

export type Segment = { x1: number; y1: number; x2: number; y2: number };

/** Everything an arrow can be tied to. Both an `InkDocument` and the canvas's
 *  own page satisfy it, which is what lets one function serve both. */
export type LinkPage = {
  strokes: readonly Stroke[];
  texts?: readonly TextBox[];
  images?: readonly ImageOnPage[];
};

/** Kept off the edge of a card, so an arrow touches its neighbour rather than
 *  appearing to grow out of the lettering. In document units. */
const CLEARANCE = 6;

/**
 * Where a named object is, or null once it is gone.
 *
 * Boxes, then photographs, then strokes -- the order they are drawn in, so an
 * id that somehow belongs to two things resolves to the one you can see.
 */
export function objectBounds(page: LinkPage, id: string): Bounds | null {
  const box = page.texts?.find((b) => b.id === id);
  if (box) return cardBounds(box);
  const image = page.images?.find((i) => i.id === id);
  if (image) return { x: image.x, y: image.y, w: image.w, h: image.h };
  const stroke = page.strokes.find((s) => s.id === id);
  return stroke ? strokeBounds(stroke) : null;
}

/**
 * The line to draw for this arrow, or null when it has collapsed to a point.
 *
 * Null is an ordinary answer: two cards dragged on top of each other have no
 * line between them, and drawing a zero-length arrowhead there would leave a
 * blot nobody could explain.
 */
export function segmentFor(link: Link, page: LinkPage): Segment | null {
  const a = anchor(link.from, page);
  const b = anchor(link.to, page);
  const from = clip(a, b.point);
  const to = clip(b, a.point);
  if (Math.hypot(to.x - from.x, to.y - from.y) < 1) return null;
  return { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
}

/** Where the two named ends sit right now, for an arrow being born. Both must
 *  exist, so a half-aimed arrow is never stored. */
export function endsFor(
  page: LinkPage, fromId: string, toId: string,
): { from: LinkEnd; to: LinkEnd } | null {
  const a = objectBounds(page, fromId);
  const b = objectBounds(page, toId);
  if (!a || !b) return null;
  return {
    from: { id: fromId, x: a.x + a.w / 2, y: a.y + a.h / 2 },
    to: { id: toId, x: b.x + b.w / 2, y: b.y + b.h / 2 },
  };
}

/** Everything an arrow ties, for deciding which arrows a copy may take with
 *  it -- `ink-clipboard.ts` is the caller. */
export const tiedTo = (link: Link): string[] =>
  [link.from.id, link.to.id].filter((id): id is string => id !== null);

/** Shortest distance from a point to a segment. The classic projection, with
 *  the degenerate zero-length case falling out of the clamp. */
export function distanceTo(seg: Segment, x: number, y: number): number {
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0
    ? 0
    : Math.max(0, Math.min(1, ((x - seg.x1) * dx + (y - seg.y1) * dy) / len2));
  return Math.hypot(x - (seg.x1 + t * dx), y - (seg.y1 + t * dy));
}

type Anchor = { point: { x: number; y: number }; area: Bounds | null };

/**
 * What one end is attached to.
 *
 * A tie whose object has gone falls back to the remembered point, which is why
 * the point is stored at all. An arrow to a rubbed-out card is removed by
 * `orphanedBy` server-side, so this only shows while a page is catching up.
 */
function anchor(end: LinkEnd, page: LinkPage): Anchor {
  const area = end.id === null ? null : objectBounds(page, end.id);
  if (!area) return { point: { x: end.x, y: end.y }, area: null };
  return { point: { x: area.x + area.w / 2, y: area.y + area.h / 2 }, area };
}

/**
 * Walk in from the centre of the object until the edge, plus a little air.
 *
 * Without this every arrow starts in the middle of the card it leaves, and the
 * half of it that crosses the card is invisible against the fill -- so the
 * arrow appears to begin somewhere arbitrary.
 */
function clip(self: Anchor, towards: { x: number; y: number }): { x: number; y: number } {
  if (!self.area) return self.point;
  const grown = {
    x: self.area.x - CLEARANCE, y: self.area.y - CLEARANCE,
    w: self.area.w + CLEARANCE * 2, h: self.area.h + CLEARANCE * 2,
  };
  // The other end is inside this object: there is no edge to walk out to, and
  // the centre is the least wrong answer.
  const inside = towards.x >= grown.x && towards.x <= grown.x + grown.w
    && towards.y >= grown.y && towards.y <= grown.y + grown.h;
  if (inside) return self.point;
  return edgeOf(grown, self.point, towards);
}

/**
 * Where the segment centre→towards leaves the rectangle.
 *
 * The slab method: how far along the segment each pair of edges is crossed,
 * taking the nearest crossing that is still on the segment. Cheaper and
 * steadier than testing four edges and sorting the hits.
 */
function edgeOf(
  b: Bounds, from: { x: number; y: number }, towards: { x: number; y: number },
): { x: number; y: number } {
  const dx = towards.x - from.x;
  const dy = towards.y - from.y;
  let t = 1;
  if (dx !== 0) {
    t = Math.min(t, Math.max((b.x - from.x) / dx, (b.x + b.w - from.x) / dx));
  }
  if (dy !== 0) {
    t = Math.min(t, Math.max((b.y - from.y) / dy, (b.y + b.h - from.y) / dy));
  }
  return { x: from.x + dx * t, y: from.y + dy * t };
}
