import type { ImageOnPage, InkDelta, Link, Stroke, TextBox } from "@jotacular/domain";

/**
 * Taking it back. ADR-109.
 *
 * The canvas had no undo at all. Native undo worked inside a text box and
 * nowhere else, so an eraser sweep across a drawing was final -- the one
 * outcome a product whose promise is "never lose a thought" does not get to
 * have.
 *
 * Every local edit already leaves as an `InkDelta`, and a delta that names
 * objects by id has an INVERSE: the objects as they were before it. So undo is
 * not a second way of changing the page. It is the same wire format, pointed
 * backwards, and it inherits ADR-058's commutativity whole -- an undo that
 * arrives after somebody else's edit merges with it instead of fighting it.
 */

/** The page as this device last agreed it was. Everything an inverse is
 *  computed against. */
export type Snapshot = {
  strokes: readonly Stroke[];
  texts: readonly TextBox[];
  images: readonly ImageOnPage[];
  links: readonly Link[];
};

export const EMPTY: Snapshot = { strokes: [], texts: [], images: [], links: [] };

type Step = { undo: InkDelta; redo: InkDelta };

/** Deep enough to cover an afternoon's mistakes, shallow enough that the stack
 *  never becomes the reason a tab runs out of memory. */
const DEPTH = 80;

export class InkHistory {
  private past: Step[] = [];
  private future: Step[] = [];
  private shadow: Snapshot = EMPTY;

  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }

  /**
   * Adopt a page without making it undoable.
   *
   * Two callers, one rule: loading a note, and catching up with somebody
   * else's edit. Neither is a thing THIS person did, and an undo stack that
   * offered to take back a colleague's work would be a weapon.
   */
  observe(page: Snapshot) {
    this.shadow = clone(page);
  }

  /** The same, and forget everything -- for a page that has been replaced
   *  rather than changed. */
  reset(page: Snapshot) {
    this.past = [];
    this.future = [];
    this.observe(page);
  }

  /** One thing this person did. The future is dropped, because a new edit
   *  after an undo is a different branch and there is no way back to the old
   *  one that would not surprise somebody. */
  record(delta: InkDelta) {
    this.past.push({ undo: invert(delta, this.shadow), redo: clone(delta) });
    if (this.past.length > DEPTH) this.past.shift();
    this.future = [];
    this.shadow = fold(this.shadow, delta);
  }

  /** The delta that takes the last edit back, or null. The caller applies it
   *  and publishes it; the shadow moves here so the two cannot disagree. */
  undo(): InkDelta | null {
    const step = this.past.pop();
    if (!step) return null;
    this.future.push(step);
    this.shadow = fold(this.shadow, step.undo);
    return step.undo;
  }

  redo(): InkDelta | null {
    const step = this.future.pop();
    if (!step) return null;
    this.past.push(step);
    this.shadow = fold(this.shadow, step.redo);
    return step.redo;
  }
}

/**
 * The delta that undoes this one, given the page as it was before it.
 *
 * Strokes are named one by one, because a delta only ever carries the ones it
 * touched. The other three kinds travel as WHOLE ARRAYS on the wire, so their
 * inverse is simply the array as it stood.
 */
export function invert(delta: InkDelta, before: Snapshot): InkDelta {
  const known = new Map(before.strokes.map((s) => [s.id, s]));
  const undo: InkDelta = { remove: [], upsert: [] };

  for (const stroke of delta.upsert) {
    const was = known.get(stroke.id);
    if (was) undo.upsert.push(cloneStroke(was));
    else undo.remove.push(stroke.id);
  }
  for (const id of delta.remove) {
    const was = known.get(id);
    if (was) undo.upsert.push(cloneStroke(was));
  }

  // A removal spans every kind, and takes arrows with it (ADR-108), so ANY
  // removal has to restore all three arrays rather than only the named one.
  const removing = delta.remove.length > 0;
  if (removing || delta.texts !== undefined) undo.texts = before.texts.map((t) => ({ ...t }));
  if (removing || delta.images !== undefined) undo.images = before.images.map((i) => ({ ...i }));
  if (removing || delta.links !== undefined) undo.links = before.links.map(cloneLink);

  // AND THE NEW ONES HAVE TO BE NAMED. These three fields are upserts by id,
  // not replacements: an array that simply leaves a box out does not delete it
  // (the server's `mergeById` keeps it), so the way back from "a box was added"
  // is to remove that box rather than to re-send the array without it.
  undo.remove.push(
    ...added(delta.texts, before.texts),
    ...added(delta.images, before.images),
    ...added(delta.links, before.links),
  );
  return undo;
}

/** Ids this delta introduces, which the way back has to take away again. */
function added(
  next: ReadonlyArray<{ id: string }> | undefined, before: ReadonlyArray<{ id: string }>,
): string[] {
  if (next === undefined) return [];
  const known = new Set(before.map((item) => item.id));
  return next.filter((item) => !known.has(item.id)).map((item) => item.id);
}

/**
 * The page after this delta. The client's own copy of the server's merge.
 *
 * NOT imported from `@jotacular/domain`: that module's merge sits beside
 * `syncTextBlock`, which reaches a database, and importing it here would put a
 * Postgres driver in the JavaScript a phone downloads.
 */
export function fold(page: Snapshot, delta: InkDelta): Snapshot {
  const gone = new Set(delta.remove);
  return {
    strokes: mergeById(page.strokes, gone, delta.upsert),
    texts: mergeById(page.texts, gone, delta.texts ?? null),
    images: mergeById(page.images, gone, delta.images ?? null),
    // An arrow outlives neither of the things it ties, and the rule is applied
    // HERE as well because the server applies it there -- a shadow that kept an
    // arrow the page had dropped would invent one on the next undo. ADR-108's
    // `orphanedBy` is the authority; this is three lines of it, not a copy.
    links: mergeById(page.links, gone, delta.links ?? null).filter(
      (l) => !(l.from.id !== null && gone.has(l.from.id))
        && !(l.to.id !== null && gone.has(l.to.id)),
    ),
  };
}

/**
 * One kind, merged by id, preserving paint order.
 *
 * `next === null` means the delta said nothing about this kind, which is not
 * the same as saying there is none of it. Removal applies either way, because
 * `remove` spans every kind. The domain's `mergeById` says the rest.
 */
function mergeById<T extends { id: string }>(
  page: readonly T[], gone: ReadonlySet<string>, next: readonly T[] | null,
): T[] {
  const replacements = new Map((next ?? []).map((item) => [item.id, item]));
  const kept: T[] = [];
  for (const item of page) {
    if (gone.has(item.id)) continue;
    const replacement = replacements.get(item.id);
    kept.push(replacement ?? item);
    if (replacement) replacements.delete(item.id);
  }
  for (const item of next ?? []) {
    if (replacements.has(item.id) && !gone.has(item.id)) kept.push(item);
  }
  return kept;
}

const cloneStroke = (s: Stroke): Stroke => ({ ...s, pts: s.pts.map((p) => [...p] as typeof p) });
const cloneLink = (l: Link): Link => ({ ...l, from: { ...l.from }, to: { ...l.to } });

const clone = <T>(value: T): T => structuredClone(value);
