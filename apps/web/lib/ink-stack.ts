import type { Stroke } from "@jotacular/domain";
import { stackKey, stackOf, type Stackable, type StackKind } from "@jotacular/ink-render";

/**
 * Asking the page's one order questions. ADR-136.
 *
 * `topHit` picks what a tap lands on: the highest thing under the pointer,
 * whatever kind it is. `reorder` is the four menu commands.
 */
type Z = { id: string; z?: number };

/** The highest of each kind's hit, by the page order. */
export function topHit<T extends Z>(
  hits: readonly { kind: StackKind; item: T | null; list: readonly T[] }[],
): T | null {
  let best: T | null = null;
  let bestKey = -Infinity;
  for (const { kind, item, list } of hits) {
    if (!item) continue;
    const key = stackKey(kind, list.indexOf(item), item.z);
    if (key > bestKey) { best = item; bestKey = key; }
  }
  return best;
}

/** The highest item of one kind under a point, by the page order. */
export function topOfKind<T extends Z>(
  kind: StackKind, list: readonly T[], hit: (item: T) => boolean,
): T | null {
  let best: T | null = null;
  let bestKey = -Infinity;
  list.forEach((item, i) => {
    if (!hit(item)) return;
    const key = stackKey(kind, i, item.z);
    if (key > bestKey) { best = item; bestKey = key; }
  });
  return best;
}

export type Reorder = "front" | "back" | "forward" | "backward";

/** Bumped whenever something is moved within the order, so the screen can
 *  tell without looking at every stroke. ADR-137. */
export let orderVersion = 0;
export const bumpOrder = () => { orderVersion += 1; };

/**
 * Move what is held within the order, keeping its own order among itself.
 * Mutates `z` on the held objects; true when anything moved.
 */
export function reorder(page: Stackable, held: ReadonlySet<string>, how: Reorder): boolean {
  const stack = stackOf(page);
  const mine = stack.filter((it) => held.has(it.id));
  const rest = stack.filter((it) => !held.has(it.id));
  if (mine.length === 0 || rest.length === 0) return false;
  const lo = Math.min(...mine.map((m) => stack.indexOf(m)));
  const hi = Math.max(...mine.map((m) => stack.indexOf(m)));
  // Where the block goes: an index into `rest`, which it will sit just below.
  let at: number;
  if (how === "front") at = rest.length;
  else if (how === "back") at = 0;
  else if (how === "forward") at = rest.findIndex((r) => stack.indexOf(r) > hi) + 1 || rest.length;
  else {
    const above = rest.findIndex((r) => stack.indexOf(r) > lo);
    at = Math.max(0, (above === -1 ? rest.length : above) - 1);
  }
  const below = at > 0 ? rest[at - 1]!.key : (rest[0]!.key - mine.length - 1);
  const above = at < rest.length ? rest[at]!.key : below + mine.length + 1;
  const step = (above - below) / (mine.length + 1);
  const z = new Map(mine.map((m, i) => [m.id, below + step * (i + 1)]));
  const set = (items: readonly Z[] | undefined) => {
    for (const it of items ?? []) { const v = z.get(it.id); if (v !== undefined) it.z = v; }
  };
  set(page.strokes as Stroke[]); set(page.texts); set(page.images); set(page.stickers);
  bumpOrder();
  return true;
}
