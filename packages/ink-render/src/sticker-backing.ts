import { STICKER_ART } from "./sticker-art";

/**
 * The white a sticker is cut from. ADR-128.
 *
 * The artwork is line drawing: a ring is an outline and a hole, so the white
 * edge alone went round the lines and the middle showed the page through. The
 * backing is the artwork's OUTER outlines only, filled -- the silhouette.
 */
type Pt = [number, number];
type Sub = { d: string; pts: Pt[] };

const NUM = /[+-]?(?:\d*\.\d+|\d+\.?)(?:e[+-]?\d+)?/gi;
const ARITY: Record<string, number> = { M: 2, L: 2, C: 6, S: 4 };

/** Split into closed subpaths, every command made absolute. Handles the
 *  commands the sticker art uses (M L C S Z) in either case. */
export function subpaths(d: string): Sub[] {
  const out: Sub[] = [];
  let cur: Pt = [0, 0];
  let start: Pt = [0, 0];
  let sub: Sub | null = null;
  for (const [, cmd, args] of d.matchAll(/([MmLlCcSsZz])([^MmLlCcSsZz]*)/g)) {
    const up = cmd!.toUpperCase();
    if (up === "Z") {
      if (sub) { sub.d += "Z"; out.push(sub); sub = null; }
      cur = start;
      continue;
    }
    const nums = (args!.match(NUM) ?? []).map(Number);
    const rel = cmd !== up;
    for (let i = 0, first = true; i + ARITY[up]! <= nums.length; i += ARITY[up]!, first = false) {
      const abs: number[] = nums.slice(i, i + ARITY[up]!)
        .map((v, j) => (rel ? v + cur[j % 2]! : v));
      const moving = up === "M" && first;
      if (moving) { start = [abs[0]!, abs[1]!]; sub = { d: "", pts: [] }; }
      const letter = up === "M" && !first ? "L" : up;
      sub ??= { d: "", pts: [] };
      sub.d += `${letter}${abs.map((v) => Math.round(v * 100) / 100).join(" ")}`;
      for (let j = 0; j < abs.length; j += 2) sub.pts.push([abs[j]!, abs[j + 1]!]);
      cur = [abs[abs.length - 2]!, abs[abs.length - 1]!];
    }
  }
  if (sub) out.push(sub);
  return out;
}

const box = (pts: Pt[]) => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
};

/** The outlines no other outline surrounds. */
export function outerOf(d: string): string {
  const subs = subpaths(d).map((s) => ({ ...s, b: box(s.pts) }));
  const inside = (a: (typeof subs)[number], o: (typeof subs)[number]) =>
    a !== o && a.b.x0 >= o.b.x0 && a.b.y0 >= o.b.y0 && a.b.x1 <= o.b.x1 && a.b.y1 <= o.b.y1;
  return subs.filter((s) => !subs.some((o) => inside(s, o))).map((s) => s.d).join("");
}

const cache = new Map<string, string>();

/** One sticker's backing path, in its artwork's own viewBox. */
export function stickerBacking(name: string): string {
  const art = STICKER_ART[name];
  if (!art) return "";
  let d = cache.get(name);
  if (d === undefined) { d = outerOf(art.d); cache.set(name, d); }
  return d;
}
