import type { Bounds } from "./geometry";

/**
 * Objects turned about their own centre. ADR-122.
 *
 * A turned object still stores its UPRIGHT rectangle and an angle; everything
 * here answers questions about the shape a person actually sees.
 */
type Pt = [number, number];

const RAD = Math.PI / 180;

/** Rotate a point about a centre, by degrees clockwise on screen (y down). */
export function spin(x: number, y: number, cx: number, cy: number, deg: number): Pt {
  const c = Math.cos(deg * RAD);
  const s = Math.sin(deg * RAD);
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
}

export const centreOf = (b: Bounds): Pt => [b.x + b.w / 2, b.y + b.h / 2];

/** The four corners as drawn, clockwise from the top-left. */
export function corners(b: Bounds, rot?: number): Pt[] {
  const flat: Pt[] = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
  if (!rot) return flat;
  const [cx, cy] = centreOf(b);
  return flat.map(([x, y]) => spin(x, y, cx, cy, rot));
}

/** The upright box round the turned shape: what framing and the index want. */
export function extent(b: Bounds, rot?: number): Bounds {
  if (!rot) return b;
  const pts = corners(b, rot);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Whether a point lands on the turned shape itself, not its extent. */
export function hits(b: Bounds, rot: number | undefined, x: number, y: number): boolean {
  const [cx, cy] = centreOf(b);
  const [ux, uy] = rot ? spin(x, y, cx, cy, -rot) : [x, y];
  return ux >= b.x && ux <= b.x + b.w && uy >= b.y && uy <= b.y + b.h;
}

/** The angle, in degrees, of a point seen from a centre; 0 is straight up. */
export const bearing = (cx: number, cy: number, x: number, y: number) =>
  Math.atan2(x - cx, cy - y) / RAD;

/** The SVG attribute that draws a thing turned about its own centre. */
export function turnAttr(b: Bounds, rot?: number): string {
  if (!rot) return "";
  const [cx, cy] = centreOf(b);
  const r = (v: number) => Math.round(v * 100) / 100;
  return ` transform="rotate(${r(rot)} ${r(cx)} ${r(cy)})"`;
}
