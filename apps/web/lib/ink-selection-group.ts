import type { Point } from "@jotacular/domain";
import { cardBounds } from "@jotacular/ink-render";
import type { Bounds } from "./ink-geometry";
import type { Held } from "./ink-selection-held";
import { MIN_SIZE } from "./ink-plane";
import { centreOf, spin } from "./ink-turned";

/**
 * Resizing and turning EVERYTHING held, as one object. ADR-126.
 *
 * Always from a snapshot taken when the handle was pressed, never from the
 * last frame: applying a scale to an already-scaled page drifts, and a turn
 * applied to a turned one compounds.
 */
type Rect = { x: number; y: number; w: number; h: number; rot?: number };
export type GroupSnap = {
  b: Bounds;
  strokes: { pts: Point[]; width: number }[];
  boxes: (Rect & { size: number; card: Bounds })[];
  pics: Rect[];
  marks: { x: number; y: number; size: number; rot?: number }[];
};

const copy = <T extends object>(o: T): T => ({ ...o });

export function snapshot(held: Held, b: Bounds): GroupSnap {
  return {
    b: { ...b },
    strokes: held.strokes.map((s) => ({ pts: s.pts.map((p) => [...p] as Point), width: s.width })),
    boxes: held.boxes.map((t) => ({
      x: t.x, y: t.y, w: t.w, h: t.h ?? cardBounds(t).h, rot: t.rot, size: t.size, card: cardBounds(t),
    })),
    pics: held.pics.map((p) => copy({ x: p.x, y: p.y, w: p.w, h: p.h, rot: p.rot })),
    marks: held.marks.map((m) => copy({ x: m.x, y: m.y, size: m.size, rot: m.rot })),
  };
}

/** Grow or shrink by `f`, about the group's top-left corner. */
export function scaleGroup(snap: GroupSnap, held: Held, f: number) {
  const { x: ax, y: ay } = snap.b;
  const sx = (x: number) => ax + (x - ax) * f;
  const sy = (y: number) => ay + (y - ay) * f;
  snap.strokes.forEach((s, i) => {
    const live = held.strokes[i]!;
    live.width = Math.max(0.5, s.width * f);
    s.pts.forEach((p, j) => { live.pts[j]![0] = sx(p[0]); live.pts[j]![1] = sy(p[1]); });
  });
  snap.boxes.forEach((t, i) => Object.assign(held.boxes[i]!, {
    x: sx(t.x), y: sy(t.y), w: t.w * f, h: t.h * f, size: Math.max(MIN_SIZE, t.size * f),
  }));
  snap.pics.forEach((p, i) => Object.assign(held.pics[i]!, { x: sx(p.x), y: sy(p.y), w: p.w * f, h: p.h * f }));
  snap.marks.forEach((m, i) => Object.assign(held.marks[i]!, { x: sx(m.x), y: sy(m.y), size: m.size * f }));
}

/** Turn by `deg` about the group's centre. Objects turn about it too, so
 *  their own angle grows by the same amount. */
export function turnGroup(snap: GroupSnap, held: Held, deg: number) {
  const [cx, cy] = centreOf(snap.b);
  snap.strokes.forEach((s, i) => s.pts.forEach((p, j) => {
    const [x, y] = spin(p[0], p[1], cx, cy, deg);
    held.strokes[i]!.pts[j]![0] = x;
    held.strokes[i]!.pts[j]![1] = y;
  }));
  const moveCentre = (b: Bounds) => {
    const [ox, oy] = centreOf(b);
    const [nx, ny] = spin(ox, oy, cx, cy, deg);
    return [nx - ox, ny - oy] as const;
  };
  snap.boxes.forEach((t, i) => {
    const [dx, dy] = moveCentre(t.card);
    Object.assign(held.boxes[i]!, { x: t.x + dx, y: t.y + dy, rot: turned(t.rot, deg) });
  });
  snap.pics.forEach((p, i) => {
    const [dx, dy] = moveCentre(p);
    Object.assign(held.pics[i]!, { x: p.x + dx, y: p.y + dy, rot: turned(p.rot, deg) });
  });
  snap.marks.forEach((m, i) => {
    const [dx, dy] = moveCentre({ x: m.x, y: m.y, w: m.size, h: m.size });
    Object.assign(held.marks[i]!, { x: m.x + dx, y: m.y + dy, rot: turned(m.rot, deg) });
  });
}

/** An angle plus a turn, wrapped; upright is stored as absent. */
function turned(rot: number | undefined, deg: number): number | undefined {
  let d = ((rot ?? 0) + deg) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  d = Math.round(d * 10) / 10;
  return Math.abs(d) < 0.5 ? undefined : d;
}

/** A handle being dragged on a group: what it looked like when pressed, and
 *  the frame to draw while it moves. */
export class GroupGrip {
  frame: { b: Bounds; rot: number };

  constructor(private readonly snap: GroupSnap) {
    this.frame = { b: { ...snap.b }, rot: 0 };
  }

  resize(held: Held, x: number, y: number) {
    const b = this.snap.b;
    const fx = b.w > 1 ? (x - b.x) / b.w : 0;
    const fy = b.h > 1 ? (y - b.y) / b.h : 0;
    const f = Math.max(0.05, fx, fy);
    scaleGroup(this.snap, held, f);
    this.frame = { b: { x: b.x, y: b.y, w: b.w * f, h: b.h * f }, rot: 0 };
  }

  turn(held: Held, deg: number) {
    turnGroup(this.snap, held, deg);
    this.frame = { b: { ...this.snap.b }, rot: deg };
  }
}
