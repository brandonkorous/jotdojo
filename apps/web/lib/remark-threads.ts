import type { CommentView } from "@jotacular/domain";

/**
 * A page's comments, grouped by the thing each one is about. ADR-107.
 *
 * Pure, and separate from the provider for the reason every split in this
 * codebase is: the provider is React state with a server round trip in it, and
 * this is arithmetic over a list. Only one of the two is worth reading twice.
 */

/** One conversation. `anchorId` is null for the page as a whole. */
export type Thread = {
  anchorId: string | null;
  /** What the canvas calls that object -- the first line of a note, or "a
   *  photo". Null when the canvas has not said, or when it has been erased. */
  label: string | null;
  comments: CommentView[];
  open: number;
};

/** What a pin has to draw: one mark per commented object. */
export type PinCount = { anchorId: string; count: number; open: number };

/**
 * Threads, newest conversation first, with the page's own always at the top.
 *
 * The page thread is present even when it is empty. It is where "something
 * about all of this" goes, and a composer that only appeared once somebody had
 * already used it would be a door that opens from the inside.
 */
export function threadsOf(
  comments: readonly CommentView[], labels: Readonly<Record<string, string>>,
): Thread[] {
  const byAnchor = new Map<string | null, CommentView[]>([[null, []]]);
  for (const c of comments) {
    const key = c.anchorId ?? null;
    const held = byAnchor.get(key);
    if (held) held.push(c);
    else byAnchor.set(key, [c]);
  }

  const threads = [...byAnchor].map(([anchorId, held]) => ({
    anchorId,
    label: anchorId === null ? null : labels[anchorId] ?? null,
    comments: held,
    open: held.filter((c) => !c.resolvedAt).length,
  }));

  return threads.sort((a, b) => {
    if (a.anchorId === null) return -1;
    if (b.anchorId === null) return 1;
    return last(b) - last(a);
  });
}

/** One mark per anchored object, in the order the threads are listed so the
 *  drawer and the page agree about what there is. */
export function pinsOf(threads: readonly Thread[]): PinCount[] {
  return threads
    .filter((t): t is Thread & { anchorId: string } => t.anchorId !== null)
    .map((t) => ({ anchorId: t.anchorId, count: t.comments.length, open: t.open }));
}

/** When a thread last had anything said in it. Zero for an empty one, which
 *  only the page thread can be. */
function last(thread: Thread): number {
  const newest = thread.comments[thread.comments.length - 1];
  return newest ? newest.createdAt.getTime() : 0;
}
