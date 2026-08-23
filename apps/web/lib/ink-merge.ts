import type { Stroke } from "@jotdojo/domain";

/**
 * Reconciling this device's page with the server's. ADR-058.
 *
 * Pure, so the rules can be read and tested without a canvas -- and they are
 * the rules that decide whether somebody's handwriting survives two devices,
 * which is not a thing to leave implicit inside a render loop.
 *
 * Everything here works by stroke id. That is the whole reason ids exist.
 */

/** Strokes in `incoming` this page has not got. Order is preserved, so a
 *  highlighter arriving from elsewhere lands behind the same words. */
export function newcomers(page: readonly Stroke[], incoming: readonly Stroke[]): Stroke[] {
  const known = new Set(page.map((s) => s.id));
  return incoming.filter((s) => !known.has(s.id));
}

/**
 * One page, plus what it is missing from another. Order follows the first.
 *
 * Both directions of live ink are this operation:
 *
 *   mergePages(mine, theirs)     strokes another device drew, arriving here
 *   mergePages(theirs, unsent)   their page adopted, keeping my upload queue
 *
 * The second is the one that matters. Adopting the server's page outright is
 * the obvious implementation and it silently discards strokes still waiting to
 * upload -- which is the one outcome this product does not get to have. A
 * pending stroke the other side ALREADY has is matched by id and not added
 * twice, so an unconfirmed queue is harmless rather than duplicated.
 *
 * Strokes are copied, because the selection mutates them in place: two pages
 * sharing a stroke object would drag both when one is moved.
 */
export function mergePages(page: readonly Stroke[], other: readonly Stroke[]): Stroke[] {
  return [...page, ...newcomers(page, other)].map((s) => ({ ...s, pts: [...s.pts] }));
}

/**
 * Whether a page needs a full re-read rather than a tail fetch.
 *
 * A count that only grew can be caught up by asking for what came after --
 * cheap, and the common case, because drawing is what people mostly do. A count
 * that fell, or a version that moved further than the count explains, means
 * something in the middle changed and every index this device holds is a guess.
 */
export function needsFullRead(
  have: { count: number; version: number }, said: { count: number; version: number },
): boolean {
  if (said.count < have.count) return true;
  return said.version - have.version !== said.count - have.count;
}
