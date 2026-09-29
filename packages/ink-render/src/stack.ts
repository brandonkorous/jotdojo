import type { ImageOnPage, Sticker, Stroke, TextBox } from "@jotacular/domain";

/**
 * One order for everything on the page, bottom to top. ADR-136.
 *
 * Each thing may carry `z`. One that does not -- every page before this --
 * keeps the order it always had: ink under notes under photos under stickers,
 * each kind in the order it was made. Those keys sit far below any real `z`,
 * so a new thing lands above the old page without renumbering it.
 */
export type StackKind = "stroke" | "text" | "image" | "sticker";
export type StackItem = { kind: StackKind; id: string; key: number };
export type Stackable = {
  strokes: readonly Stroke[];
  texts?: readonly TextBox[];
  images?: readonly ImageOnPage[];
  stickers?: readonly Sticker[];
};

const RANK: Record<StackKind, number> = { stroke: 0, text: 1, image: 2, sticker: 3 };
const LEGACY = -1e9;

export const stackKey = (kind: StackKind, index: number, z?: number): number =>
  z ?? LEGACY + RANK[kind] * 1e6 + index;

/** Bottom to top. A stroke drawn in a note is part of the note, not here. */
export function stackOf(p: Stackable): StackItem[] {
  const out: (StackItem & { r: number; i: number })[] = [];
  const add = (kind: StackKind, items: readonly { id: string; z?: number }[]) =>
    items.forEach((it, i) => out.push({ kind, id: it.id, key: stackKey(kind, i, it.z), r: RANK[kind], i }));
  add("stroke", p.strokes.filter((s) => !s.in));
  add("text", p.texts ?? []);
  add("image", p.images ?? []);
  add("sticker", p.stickers ?? []);
  out.sort((a, b) => a.key - b.key || a.r - b.r || a.i - b.i);
  return out.map(({ kind, id, key }) => ({ kind, id, key }));
}

/** The key just above everything, for something new. */
export function nextZ(p: Stackable): number {
  let top = 0;
  const see = (items: readonly { z?: number }[] | undefined) => {
    for (const it of items ?? []) if (it.z !== undefined && it.z > top) top = it.z;
  };
  see(p.strokes); see(p.texts); see(p.images); see(p.stickers);
  return Math.floor(top) + 1;
}
