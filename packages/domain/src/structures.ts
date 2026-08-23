import { sql } from "drizzle-orm";
import { withActor, withoutActor, type Tx } from "@jotacular/db";
import { canReachSpace, type Actor } from "./actor";
import { NotFound } from "./errors";
import type { InkDocument } from "./ink-doc";

/**
 * What is DRAWN on a page. ADR-066.
 *
 * The domain side of the structural pass: queue it, claim it, store it, read it
 * back. The model call is `@jotacular/vision`; the pipeline is 0031, which
 * follows 0024's worked precedent.
 *
 * Deliberately NOT part of `blocks`. That table has one transcript slot and
 * `app_store_transcript` overwrites it wholesale, so structure living there
 * would be destroyed by the next re-read of the same page -- and re-reading is
 * something this product does on purpose (ADR-046).
 */

/** Structure settles after the transcript does. Reading a diagram somebody is
 *  still drawing costs a model call and answers nothing. */
const QUIET_PERIOD_SECONDS = 45;

export type StructureJob = {
  jobId: string;
  blockId: string;
  spaceId: string;
  document: InkDocument;
};

export type StoredStructure = {
  shapes: unknown[];
  source: string;
  confidence: number | null;
  createdAt: Date;
};

/** Queue a structural read, coalesced onto any pending one for the same page. */
export async function queueStructure(tx: Tx, blockId: string): Promise<void> {
  await tx.execute(sql`
    SELECT app_enqueue_structure(${blockId}::uuid, ${QUIET_PERIOD_SECONDS}::integer)
  `);
}

/**
 * Queue a structural read to run NOW rather than after the quiet period.
 *
 * For a person asking to re-read a page, and for suites that are not going to
 * sit through 45 seconds. Same coalescing as the delayed path -- asking twice
 * does not queue twice.
 */
export async function enqueueStructureNow(blockId: string): Promise<void> {
  await withoutActor(async (tx) => {
    await tx.execute(sql`SELECT app_enqueue_structure(${blockId}::uuid, 0::integer)`);
  });
}

/**
 * What a block has cost, by kind.
 *
 * A structural pass is metered as `structure` and a transcript as its block's
 * own kind; conflating them would make one page read twice look like two pages.
 *
 * Reads AS the actor, not `withoutActor`. recognition_usage's policy is
 * app_can_reach_space(), so with no actor set every count comes back zero --
 * which makes "nothing was billed" pass for entirely the wrong reason. The same
 * trap audit_log set in ADR-063.
 */
export async function meteredKinds(
  actor: Actor, blockId: string,
): Promise<Record<string, number>> {
  return withActor(actor.userId, async (tx) => {
    const rows = await tx.execute(sql`
      SELECT kind, sum(units)::int AS units FROM recognition_usage
       WHERE block_id = ${blockId} GROUP BY kind
    `) as unknown as Array<{ kind: string; units: number }>;
    return Object.fromEntries(rows.map((r) => [r.kind, Number(r.units)]));
  });
}

export async function claimStructureJobs(limit = 2): Promise<StructureJob[]> {
  return withoutActor(async (tx) => {
    const rows = await tx.execute(sql`
      SELECT * FROM app_claim_structure_jobs(${limit}::integer)
    `) as unknown as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      jobId: String(r.job_id),
      blockId: String(r.block_id),
      spaceId: String(r.space_id),
      document: r.strokes as InkDocument,
    }));
  });
}

export async function storeStructure(
  blockId: string, shapes: unknown[], source: string, confidence: number,
): Promise<void> {
  await withoutActor(async (tx) => {
    await tx.execute(sql`
      SELECT app_store_structure(
        ${blockId}::uuid, ${JSON.stringify(shapes)}::jsonb, ${source}::text,
        ${confidence}::real
      )
    `);
  });
}

/**
 * What was found on a page, for a caller who may look.
 *
 * Null when nothing has read it yet, which is different from an empty array --
 * "not looked at" and "looked at, no diagram" are different facts and a reader
 * that conflates them will report a blank page as a considered answer. The same
 * distinction ADR-056 draws for coverage.
 */
export async function getStructure(
  actor: Actor, blockId: string,
): Promise<StoredStructure | null> {
  return withActor(actor.userId, async (tx) => {
    const rows = await tx.execute(sql`
      SELECT s.shapes, s.source, s.confidence, s.created_at, s.space_id
        FROM block_structures s WHERE s.block_id = ${blockId}
    `) as unknown as Array<Record<string, unknown>>;
    const row = rows[0];
    if (!row) return null;
    if (!canReachSpace(actor, String(row.space_id))) {
      throw new NotFound("That block does not exist, or you cannot reach it");
    }
    return {
      shapes: (row.shapes as unknown[]) ?? [],
      source: String(row.source),
      confidence: row.confidence === null ? null : Number(row.confidence),
      createdAt: new Date(String(row.created_at)),
    };
  });
}
