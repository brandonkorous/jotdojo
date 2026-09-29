import type { ImageOnPage, Sticker, Stroke, TextBox } from "@jotacular/domain";
import { CARD_PAD, cardBounds } from "@jotacular/ink-render";
import type { Bounds } from "./ink-geometry";
import { imageArea, stickerArea } from "./ink-rects";
import { bearing, centreOf, corners, spin } from "./ink-turned";

/**
 * The two handles on ONE held object: a corner that resizes it and a knob
 * above it that turns it. ADR-122. Pure; the selection owns the lifecycle.
 */
export type Grip = "resize" | "turn";
export type Gripped =
  | { kind: "box"; obj: TextBox }
  | { kind: "pic"; obj: ImageOnPage }
  | { kind: "mark"; obj: Sticker };

/** How far above the top edge the turn knob sits, and how near a pointer has
 *  to be to take a handle. Both in SCREEN pixels. */
export const KNOB_GAP = 28;
export const GRIP_REACH = 14;
/** Turning within this many degrees of a right angle lands on it. */
const SNAP = 4;
const MIN_W = 24;
const MIN_STICKER = 12;

/** What the handles are drawn round: a box, turned by an angle. */
export type Frame = { b: Bounds; rot: number };

export const frameOf = (g: Gripped): Frame => ({ b: areaOf(g), rot: g.obj.rot ?? 0 });

export function areaOf(g: Gripped): Bounds {
  if (g.kind === "box") return cardBounds(g.obj);
  return g.kind === "pic" ? imageArea(g.obj) : stickerArea(g.obj);
}

/** Where the outline and the two handles are drawn, in document units. */
export function gripPoints({ b, rot }: Frame, k: number) {
  const [cx, cy] = centreOf(b);
  const outline = corners(b, rot);
  const top = spin(cx, b.y, cx, cy, rot);
  const knob = spin(cx, b.y - KNOB_GAP / k, cx, cy, rot);
  return { outline, resize: outline[2]!, top, knob };
}

/** Which handle a pointer is on, if any. */
export function gripAt(f: Frame, x: number, y: number, k: number): Grip | null {
  const p = gripPoints(f, k);
  const reach = GRIP_REACH / k;
  if (Math.hypot(x - p.knob[0], y - p.knob[1]) <= reach) return "turn";
  if (Math.hypot(x - p.resize[0], y - p.resize[1]) <= reach) return "resize";
  return null;
}

/** Turn so the knob points at the pointer, landing on right angles. */
export function turnTo(g: Gripped, x: number, y: number) {
  const [cx, cy] = centreOf(areaOf(g));
  const deg = snapTurn(bearing(cx, cy, x, y));
  if (deg === 0) delete g.obj.rot;
  else g.obj.rot = deg;
}

/** Land on right angles, then wrap into (-180, 180], to a tenth. */
export function snapTurn(deg: number): number {
  const right = Math.round(deg / 90) * 90;
  let d = Math.abs(deg - right) <= SNAP ? right : deg;
  d = ((d % 360) + 540) % 360 - 180;
  return Math.abs(d) < 0.5 ? 0 : Math.round(d * 10) / 10;
}

/**
 * Drag the far corner; the near one stays put on the page. The pointer is
 * read in the object's own turned axes, so a turned card grows along itself.
 */
export function resizeTo(g: Gripped, x: number, y: number) {
  const b = areaOf(g);
  const rot = g.obj.rot ?? 0;
  const [tlx, tly] = corners(b, rot)[0]!;
  const [lx, ly] = spin(x, y, tlx, tly, -rot);
  const size = sized(g, b, Math.max(MIN_W, lx - tlx), Math.max(MIN_W, ly - tly));
  // The new centre, from the fixed corner along the turned axes.
  const [ncx, ncy] = spin(tlx + size.w / 2, tly + size.h / 2, tlx, tly, rot);
  place(g, { x: ncx - size.w / 2, y: ncy - size.h / 2, w: size.w, h: size.h });
}

/** A photo and a voice card keep their shape; a sticker is one number. */
function sized(g: Gripped, b: Bounds, w: number, h: number) {
  if (g.kind === "box") return { w, h };
  const f = Math.max(w / b.w, h / b.h);
  const s = { w: b.w * f, h: b.h * f };
  return g.kind === "mark" ? { w: Math.max(MIN_STICKER, s.w), h: Math.max(MIN_STICKER, s.w) } : s;
}

/** Write an outer rectangle back onto the object, inside its card if it has one. */
function place(g: Gripped, r: Bounds) {
  if (g.kind === "mark") return void Object.assign(g.obj, { x: r.x, y: r.y, size: r.w });
  if (g.kind === "pic") return void Object.assign(g.obj, r);
  const pad = g.obj.size * CARD_PAD;
  Object.assign(g.obj, {
    x: r.x + pad, y: r.y + pad,
    w: Math.max(g.obj.size, r.w - pad * 2), h: Math.max(g.obj.size, r.h - pad * 2),
  });
}

/**
 * Take a note's drawing from one frame to another: each point keeps its place
 * as a fraction of the note, in the note's own turned axes. So a note made
 * wider stretches its sketch, and a turned one turns it. ADR-134.
 */
export function carry(strokes: readonly Stroke[], from: Frame, to: Frame) {
  const [fx, fy] = centreOf(from.b);
  const [tx, ty] = centreOf(to.b);
  const sx = to.b.w / Math.max(1e-6, from.b.w);
  const sy = to.b.h / Math.max(1e-6, from.b.h);
  for (const stroke of strokes as Stroke[]) {
    for (const p of stroke.pts) {
      const [ux, uy] = spin(p[0], p[1], fx, fy, -from.rot);
      const [x, y] = spin(tx + (ux - fx) * sx, ty + (uy - fy) * sy, tx, ty, to.rot);
      p[0] = x;
      p[1] = y;
    }
    stroke.width = Math.max(0.5, stroke.width * Math.sqrt(sx * sy));
  }
}
