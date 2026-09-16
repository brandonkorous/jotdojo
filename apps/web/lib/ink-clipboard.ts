import type { ImageOnPage, Link, Point, Stroke, TextBox } from "@jotacular/domain";

/**
 * Copy, paste and duplicate on the canvas. ADR-110.
 *
 * Copying a card meant redrawing it. That is the kind of gap nobody writes a
 * bug report about -- they just do the work twice -- and a board of five
 * near-identical notes is most of what a whiteboard is for.
 *
 * NOT the system clipboard. Reading it needs a permission prompt in the middle
 * of a gesture, the write half is asynchronous, and neither carries a stroke's
 * pressure. An in-page clipboard costs nothing, works on every browser, and is
 * honest about what it is: things go between Jotacular pages, not between apps.
 */

export type Clipping = {
  strokes: Stroke[];
  texts: TextBox[];
  images: ImageOnPage[];
  /** Only arrows whose BOTH ends were copied. An arrow with one end left
   *  behind would paste pointing at the original, which nobody means. */
  links: Link[];
};

/** How far a pasted copy sits from its original, in document units. Far enough
 *  to see two things, near enough that the copy is obviously the copy. */
export const PASTE_OFFSET = 24;

/** Lives for the tab, not for the page, so a note can be copied INTO another
 *  one. A ref rather than state: nothing re-renders when it changes. */
let held: Clipping | null = null;

export const holding = () => held !== null;

export function put(clipping: Clipping) {
  held = clipping;
}

export const take = (): Clipping | null => held;

/**
 * What a selection copies to.
 *
 * Deep, because everything here is mutated in place by a drag: a clipping that
 * shared objects with the page would change every time the original moved.
 */
export function clip(
  selection: {
    strokes: readonly Stroke[]; texts: readonly TextBox[]; images: readonly ImageOnPage[];
  },
  links: readonly Link[],
): Clipping {
  const ids = new Set<string>([
    ...selection.strokes.map((s) => s.id),
    ...selection.texts.map((t) => t.id),
    ...selection.images.map((i) => i.id),
  ]);
  return {
    strokes: selection.strokes.map(cloneStroke),
    texts: selection.texts.map((t) => ({ ...t })),
    images: selection.images.map((i) => ({ ...i })),
    links: links.filter((l) => inside(l, ids)).map(cloneLink),
  };
}

const inside = (link: Link, ids: ReadonlySet<string>) =>
  link.from.id !== null && link.to.id !== null
  && ids.has(link.from.id) && ids.has(link.to.id);

/**
 * The clipping again, as new objects at a new place.
 *
 * Every id is minted fresh and the arrows are re-tied to the new ids, which is
 * the whole difficulty: an arrow that kept its old ends would be a second
 * arrow drawn on top of the first.
 */
export function reborn(clipping: Clipping, dx: number, dy: number): Clipping {
  const renamed = new Map<string, string>();
  const rename = (id: string) => {
    const next = renamed.get(id) ?? crypto.randomUUID();
    renamed.set(id, next);
    return next;
  };

  const strokes = clipping.strokes.map((s) => ({
    ...cloneStroke(s), id: rename(s.id),
    pts: s.pts.map((p) => [p[0] + dx, p[1] + dy, p[2], p[3], p[4], p[5]] as Point),
  }));
  const texts = clipping.texts.map((t) => ({ ...t, id: rename(t.id), x: t.x + dx, y: t.y + dy }));
  const images = clipping.images.map((i) => ({ ...i, id: rename(i.id), x: i.x + dx, y: i.y + dy }));
  const links = clipping.links.map((l) => ({
    ...cloneLink(l),
    id: crypto.randomUUID(),
    from: { id: rename(l.from.id!), x: l.from.x + dx, y: l.from.y + dy },
    to: { id: rename(l.to.id!), x: l.to.x + dx, y: l.to.y + dy },
  }));
  return { strokes, texts, images, links };
}

/** Whether a clipping would put anything on the page at all. An empty one is
 *  never stored, so a failed copy cannot silently empty the clipboard. */
export const isEmpty = (clipping: Clipping) =>
  clipping.strokes.length === 0 && clipping.texts.length === 0
  && clipping.images.length === 0;

const cloneStroke = (s: Stroke): Stroke => ({ ...s, pts: s.pts.map((p) => [...p] as Point) });
const cloneLink = (l: Link): Link => ({ ...l, from: { ...l.from }, to: { ...l.to } });
