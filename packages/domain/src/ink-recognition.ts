import { and, eq, sql } from "drizzle-orm";
import { withActor, notes, blocks, type Tx } from "@jotdojo/db";
import { type Actor } from "./actor";
import { Forbidden, NotFound } from "./errors";
import { assertMember } from "./spaces";
import { publish } from "./events";

/**
 * What follows a change to an ink page: a reading of it, or the withdrawal of
 * one. docs/08-ink.md.
 *
 * Split out of ink.ts when that file reached the size limit and gained a second
 * write path. Both paths -- appending strokes and applying a delta -- have to
 * do exactly this afterwards, and a rule two callers implement separately is a
 * rule that will eventually differ between them.
 */

/**
 * Tell any other open copy of this page how far it has got.
 *
 * All three write paths -- append, delta, whole-page replace -- say exactly
 * this. `version` is what distinguishes "ask for the tail" from "read it
 * whole", which a count alone cannot. ADR-058.
 */
export function announceInk(
  page: { spaceId: string; noteId: string }, blockId: string,
  strokeCount: number, version: number,
) {
  publish({
    kind: "ink", spaceId: page.spaceId, noteId: page.noteId, blockId,
    strokeCount, version, at: Date.now(),
  });
}

/** Recognition waits for a pause rather than firing per batch. */
const QUIET_PERIOD_SECONDS = 30;

/**
 * Everything a page owes after it changes.
 *
 * An empty page has nothing to recognize and must not queue a model call, which
 * is why `hasStrokes` is a parameter rather than something re-derived here.
 */
export async function markPageChanged(
  tx: Tx, page: { blockId: string; noteId: string }, hasStrokes: boolean,
): Promise<void> {
  if (hasStrokes) {
    await queueRecognition(tx, page.blockId);
    await tx.update(blocks)
      .set({ transcriptState: "pending" })
      .where(and(eq(blocks.id, page.blockId), eq(blocks.transcriptState, "ready")));
  }
  await tx.update(notes).set({ updatedAt: new Date() }).where(eq(notes.id, page.noteId));
}

/**
 * Queue recognition for a quiet period from now, pushing any existing job out.
 *
 * Recognition is a VLM call over the whole page, so firing one per two-second
 * batch would mean forty calls for a page someone spent two minutes writing --
 * thirty-nine of them reading an unfinished drawing, and all forty billed. The
 * job instead settles thirty seconds after the last stroke lands.
 *
 * Same coalescing shape as queueEmbedding in note-body.ts, with one difference:
 * this moves `available_at` forward on every change rather than leaving the
 * first job's time alone.
 */
export async function queueRecognition(tx: Tx, blockId: string): Promise<void> {
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

  const changed = await withActor(actor.userId, async (tx) => {
    const rows = await tx.select({ spaceId: blocks.spaceId, noteId: blocks.noteId }).from(blocks)
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

    return rows[0];
  });

  // Somebody else looking at this note is reading the machine's version of the
  // handwriting. They should stop.
  publish({
    kind: "block", spaceId: changed.spaceId, noteId: changed.noteId,
    blockId, transcriptState: "ready", at: Date.now(),
  });
}
