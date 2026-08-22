import { sql } from "drizzle-orm";
import { withoutActor } from "@jotdojo/db";

/**
 * Reading old content again with a newer model. M5, ADR-046.
 *
 * The whole reason ink is stored as strokes rather than as a flattened image
 * (docs/08) is that a page can be read again later. This is that, made real:
 * point it at the model you use now, and everything read by an older one is
 * queued to be read again.
 *
 * No actor. Like the outbox drain and the sweep, this is the system acting on
 * its own corpus rather than a person acting on their notes -- and it must be
 * able to reach every space, which no signed-in actor can.
 *
 * `spaceId` narrows it to one, which is the shape support actually needs:
 * somebody writes in about their own old pages, and the answer should cost
 * their pages rather than everybody's.
 */

/** The block kinds that carry a machine reading. */
export type ReadKind = "ink" | "image" | "audio";

const rows = (result: unknown) => result as unknown as Array<Record<string, unknown>>;

/**
 * How many blocks were read by something other than `source`.
 *
 * Read-only, and the same definition of "stale" the requeue uses -- so a dry
 * run cannot promise a different number from the pass that follows it.
 */
export async function countStale(
  kind: ReadKind, source: string, limit = 100_000, spaceId: string | null = null,
): Promise<number> {
  return withoutActor(async (tx) => {
    const result = await tx.execute(sql`
      SELECT count(*)::int AS n FROM app_stale_transcripts(
        ${kind}::text, ${source}::text, ${limit}::integer, ${spaceId}::uuid)
    `);
    return Number(rows(result)[0]?.n ?? 0);
  });
}

/**
 * WHICH blocks are stale, not just how many.
 *
 * The count is what a person wants before spending money; the ids are what a
 * test needs to say "this page, not that one" on a corpus it does not own.
 */
export async function listStale(
  kind: ReadKind, source: string, limit = 500, spaceId: string | null = null,
): Promise<string[]> {
  return withoutActor(async (tx) => {
    const result = await tx.execute(sql`
      SELECT block_id FROM app_stale_transcripts(
        ${kind}::text, ${source}::text, ${limit}::integer, ${spaceId}::uuid)
    `);
    return rows(result).map((r) => String(r.block_id));
  });
}

/**
 * Queue the stale ones and say how many.
 *
 * Bounded on purpose. A corpus of a hundred thousand pages should be re-read
 * over days in batches somebody can watch, not enqueued in one transaction that
 * commits a bill.
 */
export async function requeueRecognition(
  kind: ReadKind, source: string, limit = 500, spaceId: string | null = null,
): Promise<number> {
  return withoutActor(async (tx) => {
    const result = await tx.execute(sql`
      SELECT app_requeue_recognition(
        ${kind}::text, ${source}::text, ${limit}::integer, ${spaceId}::uuid) AS n
    `);
    return Number(rows(result)[0]?.n ?? 0);
  });
}
