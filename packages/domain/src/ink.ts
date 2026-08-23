import { withActor, type Tx } from "@jotacular/db";
import { canReachSpace, hasScope, type Actor } from "./actor";
import { Forbidden, NotFound, DomainError } from "./errors";
import { validateStrokes, MAX_STROKES, MAX_BATCH, type Stroke } from "./ink-doc";
import { markPageChanged, announceInk } from "./ink-recognition";
import { lockReachable, appendToPage, bumpPage, pageIds } from "./ink-page";

/**
 * Writing strokes into an ink block. docs/08-ink.md.
 *
 * Vectors are the truth and are never flattened to a raster. Strokes are small
 * -- a page of handwriting is tens of kilobytes -- and keeping them means a
 * better recognizer can be run over old notes later, so handwriting from a year
 * ago silently improves. A PNG is a one-way door.
 *
 * What an ink document IS lives in ink-doc.ts; a block's lifecycle lives in
 * ink-block.ts; changing the middle of a page lives in ink-delta.ts, and
 * recognition in ink-recognition.ts. This file is the append path -- the one
 * that runs every two seconds while somebody is actually writing.
 */

/**
 * Append a batch of strokes to an ink block.
 *
 * Eager, not on save: Safari evicts script-writable storage under pressure and
 * after disuse, so a finished drawing must never exist only in IndexedDB.
 * Losing a hand-drawn page is unforgivable in a way that losing a typed
 * paragraph is not -- the person cannot retype it from memory.
 *
 * `seq` is the index this batch claims to start at, and it makes the whole
 * thing idempotent without a request id:
 *
 *   seq === count   append it
 *   seq >  count    a batch went missing. Refuse, and tell the client where we
 *                   actually are so it can resend from there.
 *   seq <  count    the page has moved on. See below.
 *
 * The middle case is worth being strict about: accepting it would leave a hole
 * in the middle of someone's handwriting that nothing would ever report.
 *
 * The last case used to mean one thing -- a retry whose response was lost --
 * and with a single writer that was true. It is not true of two devices, where
 * a batch can be behind the page simply because somebody else drew first, and
 * dismissing it as a retry would discard real strokes with a success code.
 * ADR-058. So a batch that names its strokes is deduplicated BY ID and the rest
 * are kept, and only a batch with no ids of its own is still assumed to be a
 * retry -- which is the only safe guess when a stroke cannot be recognised.
 */
export async function appendStrokes(
  actor: Actor, blockId: string, seq: number, rawStrokes: unknown,
): Promise<{ strokeCount: number; accepted: number; version: number }> {
  if (!hasScope(actor, "notes:write") && !hasScope(actor, "capture:write")) {
    throw new Forbidden("This connection cannot write notes");
  }
  if (!Number.isInteger(seq) || seq < 0) {
    throw new DomainError("seq must be a non-negative integer", "bad_seq", 400);
  }
  // Whether the CLIENT chose the ids, checked before validation mints any.
  // Only a batch that named itself can be deduplicated by name.
  const identified = Array.isArray(rawStrokes) && rawStrokes.length > 0
    && rawStrokes.every((s) => typeof (s as { id?: unknown })?.id === "string");
  const strokes = validateStrokes(rawStrokes);

  const page = await withActor(actor.userId, async (tx) => {
    // Locked, because this is a read-modify-write on a jsonb document and two
    // tabs drawing on one page is a thing people do.
    const row = await lockReachable(tx, actor, blockId, (id) => canReachSpace(actor, id));

    if (seq > row.count) {
      throw new DomainError(
        `strokes ${row.count}..${seq - 1} were never received; resend from ${row.count}`,
        "stroke_gap", 409,
      );
    }

    const fresh = seq < row.count ? await unseen(tx, row.artifactId, strokes, identified) : strokes;
    if (fresh.length === 0) {
      // Everything in this batch is already on the page. Saying "fine" is both
      // true and what lets the client move on.
      return { ...row, accepted: 0 };
    }
    if (row.count + fresh.length > MAX_STROKES) {
      throw new DomainError("this page has too many strokes", "page_full", 400);
    }

    const version = await appendToPage(tx, row.artifactId, fresh);
    await markPageChanged(tx, { blockId, noteId: row.noteId }, true);
    return { ...row, count: row.count + fresh.length, version, accepted: fresh.length };
  });

  // Nothing to announce for a replayed batch: every device already has it, and
  // an event whose counter has not moved is one every receiver would discard.
  if (page.accepted > 0) announceInk(page, blockId, page.count, page.version);

  return { strokeCount: page.count, accepted: page.accepted, version: page.version };
}

/**
 * The strokes in a batch the page does not already have.
 *
 * An unidentified batch is taken at its word as a retry and dropped whole:
 * without ids there is no way to tell a resend from a second device, and
 * appending a possible duplicate would draw somebody's word twice with no way
 * back. With ids there is no guessing to do.
 */
async function unseen(
  tx: Tx, artifactId: string, strokes: Stroke[], identified: boolean,
): Promise<Stroke[]> {
  if (!identified) return [];
  const known = await pageIds(tx, artifactId);
  return strokes.filter((s) => !known.has(s.id));
}

/**
 * Replace the whole page.
 *
 * The blunt instrument, and now the rare one: applyInkDelta in ink-delta.ts is
 * what erase, move and recolour use, because naming strokes by id lets those
 * survive a second device drawing at the same time. This remains correct for
 * the one edit that genuinely IS the whole page -- clearing it -- and for a
 * client that has no ids to name.
 *
 * Do not reach for it on the append path, and do not reach for it for a partial
 * edit: it overwrites concurrent work by construction.
 */
export async function replaceStrokes(
  actor: Actor, blockId: string, rawStrokes: unknown,
): Promise<{ strokeCount: number; version: number }> {
  if (!hasScope(actor, "notes:write") && !hasScope(actor, "capture:write")) {
    throw new Forbidden("This connection cannot write notes");
  }
  const all = Array.isArray(rawStrokes) ? rawStrokes : [];
  if (all.length > MAX_STROKES) throw new DomainError("too many strokes", "page_full", 400);

  // Validated in batches so the per-batch cap does not become a page cap.
  const strokes: Stroke[] = [];
  for (let i = 0; i < all.length; i += MAX_BATCH) {
    strokes.push(...validateStrokes(all.slice(i, i + MAX_BATCH)));
  }

  const page = await withActor(actor.userId, async (tx) => {
    // The count, not the document: this overwrites the page, so reading what
    // was there would be pulling a page of handwriting across the wire only to
    // discard it.
    const row = await lockReachable(tx, actor, blockId, (id) => canReachSpace(actor, id));

    const version = await bumpPage(tx, row.artifactId, strokes);
    // What is on the page changed, so whatever was read off it is now stale.
    await markPageChanged(tx, { blockId, noteId: row.noteId }, strokes.length > 0);
    return { ...row, version };
  });

  announceInk(page, blockId, strokes.length, page.version);
  return { strokeCount: strokes.length, version: page.version };
}
