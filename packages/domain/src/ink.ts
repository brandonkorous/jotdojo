import { and, eq, sql } from "drizzle-orm";
import { withActor, notes, blocks, mediaAssets, type Tx } from "@jotdojo/db";
import { canReachSpace, hasScope, type Actor } from "./actor";
import { Forbidden, NotFound, DomainError } from "./errors";
import { validateStrokes, MAX_STROKES, MAX_BATCH, type Stroke } from "./ink-doc";
import { assertMember } from "./spaces";
import { loadNote } from "./ink-block";

/**
 * Writing strokes into an ink block, and what follows from that. docs/08-ink.md.
 *
 * Vectors are the truth and are never flattened to a raster. Strokes are small
 * -- a page of handwriting is tens of kilobytes -- and keeping them means a
 * better recognizer can be run over old notes later, so handwriting from a year
 * ago silently improves. A PNG is a one-way door.
 *
 * What an ink document IS lives in ink-doc.ts; a block's own lifecycle lives in
 * ink-block.ts. This file is the part that changes what is on the page.
 */

/** Recognition waits for a pause rather than firing per batch. */
const QUIET_PERIOD_SECONDS = 30;

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
 *   seq <  count    already have it -- a retry after a response was lost. No-op.
 *   seq >  count    a batch went missing. Refuse, and tell the client where we
 *                   actually are so it can resend from there.
 *
 * The last case is the one worth being strict about. Accepting it would leave a
 * hole in the middle of someone's handwriting that nothing would ever report.
 */
export async function appendStrokes(
  actor: Actor, blockId: string, seq: number, rawStrokes: unknown,
): Promise<{ strokeCount: number; accepted: number }> {
  if (!hasScope(actor, "notes:write") && !hasScope(actor, "capture:write")) {
    throw new Forbidden("This connection cannot write notes");
  }
  if (!Number.isInteger(seq) || seq < 0) {
    throw new DomainError("seq must be a non-negative integer", "bad_seq", 400);
  }
  const strokes = validateStrokes(rawStrokes);

  return withActor(actor.userId, async (tx) => {
    // FOR UPDATE, because this is a read-modify-write on a jsonb document and
    // two tabs drawing on one page is a thing people do.
    const rows = await tx.execute(sql`
      SELECT b.id AS block_id, b.space_id, b.note_id, a.id AS artifact_id,
             jsonb_array_length(a.strokes -> 'strokes') AS count
        FROM blocks b
        JOIN media_assets a ON a.id = b.artifact_id
       WHERE b.id = ${blockId} AND b.kind = 'ink'
         FOR UPDATE OF a
    `);
    const row = (rows as unknown as Array<Record<string, unknown>>)[0];
    if (!row) throw new NotFound("That ink block does not exist, or you cannot reach it");

    const spaceId = String(row.space_id);
    if (!canReachSpace(actor, spaceId)) {
      throw new NotFound("That ink block does not exist, or you cannot reach it");
    }

    const count = Number(row.count ?? 0);

    if (seq < count) {
      // A retry whose original response never arrived. The strokes are already
      // here; saying "fine" is both true and what lets the client move on.
      return { strokeCount: count, accepted: 0 };
    }
    if (seq > count) {
      throw new DomainError(
        `strokes ${count}..${seq - 1} were never received; resend from ${count}`,
        "stroke_gap", 409,
      );
    }
    if (count + strokes.length > MAX_STROKES) {
      throw new DomainError("this page has too many strokes", "page_full", 400);
    }

    await tx.execute(sql`
      UPDATE media_assets
         SET strokes = jsonb_set(strokes, '{strokes}',
                                 (strokes -> 'strokes') || ${JSON.stringify(strokes)}::jsonb)
       WHERE id = ${String(row.artifact_id)}
    `);

    await queueRecognition(tx, blockId);
    await tx.update(blocks)
      .set({ transcriptState: "pending" })
      .where(and(eq(blocks.id, blockId), eq(blocks.transcriptState, "ready")));

    await tx.update(notes).set({ updatedAt: new Date() }).where(eq(notes.id, String(row.note_id)));

    return { strokeCount: count + strokes.length, accepted: strokes.length };
  });
}

/**
 * Queue recognition for a quiet period from now, pushing any existing job out.
 *
 * Recognition is a VLM call over the whole page, so firing one per two-second
 * batch would mean forty calls for a page someone spent two minutes writing --
 * thirty-nine of them reading an unfinished drawing, and all forty billed. The
 * job instead settles thirty seconds after the last stroke lands.
 *
 * Same coalescing shape as queueEmbedding in notes.ts, with one difference:
 * this moves `available_at` forward on every append rather than leaving the
 * first job's time alone.
 */
async function queueRecognition(tx: Tx, blockId: string) {
  const updated = await tx.execute(sql`
    UPDATE outbox
       SET available_at = now() + make_interval(secs => ${QUIET_PERIOD_SECONDS})
     WHERE topic = 'block.recognize'
       AND completed_at IS NULL
       AND payload ->> 'blockId' = ${blockId}
    RETURNING id
  `);

  if ((updated as unknown as unknown[]).length > 0) return;

  await tx.execute(sql`
    INSERT INTO outbox (topic, payload, available_at)
    VALUES ('block.recognize', jsonb_build_object('blockId', ${blockId}::text),
            now() + make_interval(secs => ${QUIET_PERIOD_SECONDS}))
  `);
}

/**
 * A person correcting what the recognizer read.
 *
 * Sets transcript_source to 'user' and confidence to null, and that block is
 * never re-recognized again. A correction is the one input we treat as ground
 * truth -- overwriting it later with a "better" model would be the single most
 * infuriating thing this product could do.
 */
export async function correctTranscript(
  actor: Actor, blockId: string, text: string,
): Promise<void> {
  if (actor.type !== "user") throw new Forbidden("Only a person can correct a transcript");

  await withActor(actor.userId, async (tx) => {
    const rows = await tx.select({ spaceId: blocks.spaceId }).from(blocks)
      .where(eq(blocks.id, blockId)).limit(1);
    if (!rows[0]) throw new NotFound();
    await assertMember(tx, actor, rows[0].spaceId);

    await tx.update(blocks).set({
      transcript: text.trim(),
      transcriptSource: "user",
      confidence: null,
      // A person who has looked at the page and typed what it says has settled
      // the question of completeness too. Leaving a machine's coverage figure
      // behind would keep flagging their answer as partial. ADR-056.
      transcriptCoverage: null,
      transcriptState: "ready",
    }).where(eq(blocks.id, blockId));

    // Any queued recognition for this block is now wrong by definition.
    await tx.execute(sql`
      UPDATE outbox SET completed_at = now()
       WHERE topic = 'block.recognize' AND completed_at IS NULL
         AND payload ->> 'blockId' = ${blockId}
    `);
  });
}

/**
 * Replace the whole page.
 *
 * Erase is stroke-wise, so erasing removes items from the middle of the array
 * and the append protocol -- which only ever adds to the end -- cannot express
 * it. Rather than invent a delete-by-index that would race with in-flight
 * appends, the client sends the page it now believes in and that becomes the
 * truth.
 *
 * This is a bigger payload and a bigger hammer, and it is correct precisely
 * because erasing is rare compared with drawing. Do not reach for it on the
 * append path.
 */
export async function replaceStrokes(
  actor: Actor, blockId: string, rawStrokes: unknown,
): Promise<{ strokeCount: number }> {
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

  return withActor(actor.userId, async (tx) => {
    const rows = await tx.execute(sql`
      SELECT b.space_id, b.note_id, a.id AS artifact_id
        FROM blocks b
        JOIN media_assets a ON a.id = b.artifact_id
       WHERE b.id = ${blockId} AND b.kind = 'ink'
         FOR UPDATE OF a
    `);
    const row = (rows as unknown as Array<Record<string, unknown>>)[0];
    if (!row) throw new NotFound("That ink block does not exist, or you cannot reach it");
    if (!canReachSpace(actor, String(row.space_id))) {
      throw new NotFound("That ink block does not exist, or you cannot reach it");
    }

    await tx.execute(sql`
      UPDATE media_assets
         SET strokes = jsonb_set(strokes, '{strokes}', ${JSON.stringify(strokes)}::jsonb)
       WHERE id = ${String(row.artifact_id)}
    `);

    // What is on the page changed, so whatever was read off it is now stale.
    // An empty page has nothing to recognize and should not queue a VLM call.
    if (strokes.length > 0) {
      await queueRecognition(tx, blockId);
      await tx.update(blocks).set({ transcriptState: "pending" })
        .where(and(eq(blocks.id, blockId), eq(blocks.transcriptState, "ready")));
    }
    await tx.update(notes).set({ updatedAt: new Date() }).where(eq(notes.id, String(row.note_id)));

    return { strokeCount: strokes.length };
  });
}
