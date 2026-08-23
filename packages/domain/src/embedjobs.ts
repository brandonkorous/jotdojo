import { sql } from "drizzle-orm";
import { publish } from "./events";
import { writeChange } from "./changes";
import { withoutActor } from "@jotdojo/db";

/**
 * The outbox drain, from the domain side.
 *
 * There is no `Actor` in this file and that is the point. Embedding runs on
 * behalf of nobody -- it is background work over blocks whose owners are
 * asleep. The old design gave the worker a BYPASSRLS role for exactly that
 * reason; ADR-024 replaced it with three SECURITY DEFINER functions, so the
 * worker connects as the same restricted `jotdojo_app` role as everything else
 * and can still only do these three things.
 *
 * That is why this file is thirty lines of function calls: all the authority
 * lives in 0009_embedding_jobs.sql, where it can be read in one sitting.
 */

export type EmbedJob = {
  jobId: string;
  blockId: string;
  spaceId: string;
  content: string;
};

export async function claimEmbedJobs(batch = 16, leaseSeconds = 120): Promise<EmbedJob[]> {
  return withoutActor(async (tx) => {
    const rows = await tx.execute(
      sql`SELECT * FROM app_claim_embed_jobs(${batch}::int, ${leaseSeconds}::int)`,
    );
    return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
      // bigint arrives as a string from postgres-js; keep it one, because
      // Number() on a bigserial is a bug waiting for the row count to grow.
      jobId: String(r.job_id),
      blockId: String(r.block_id),
      spaceId: String(r.space_id),
      content: String(r.content ?? ""),
    }));
  });
}

export async function storeEmbedding(
  blockId: string, spaceId: string, embedding: number[], model: string,
): Promise<void> {
  const literal = `[${embedding.join(",")}]`;
  await withoutActor(async (tx) => {
    await tx.execute(sql`
      SELECT app_store_embedding(
        ${blockId}::uuid, ${spaceId}::uuid, ${literal}::vector, ${model}::text
      )
    `);
  });
}

/**
 * Close an outbox job, or hand it back with an error for backoff.
 *
 * Topic-agnostic despite the SQL function still being called
 * `app_finish_embed_job` -- it only ever touched outbox rows by id, and
 * renaming it would be a migration whose only effect is on a name. Embedding
 * and recognition both close their jobs through here.
 */
export async function finishJob(jobId: string, error?: string): Promise<void> {
  await withoutActor(async (tx) => {
    await tx.execute(
      sql`SELECT app_finish_embed_job(${jobId}::bigint, ${error ?? null}::text)`,
    );
  });
}

// --- recognition ----------------------------------------------------------
// Same shape, second door. 0011_recognition_jobs.sql.

export type RecognizeJob = {
  jobId: string;
  blockId: string;
  spaceId: string;
  kind: "ink" | "image" | "audio";
  /** ink only */
  document: import("./ink-doc").InkDocument | null;
  /** image and audio only */
  blobUrl: string | null;
  mimeType: string | null;
};

export async function claimRecognizeJobs(
  batch = 4, leaseSeconds = 600,
): Promise<RecognizeJob[]> {
  return withoutActor(async (tx) => {
    const rows = await tx.execute(
      sql`SELECT * FROM app_claim_recognize_jobs(${batch}::int, ${leaseSeconds}::int)`,
    );
    return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
      jobId: String(r.job_id),
      blockId: String(r.block_id),
      spaceId: String(r.space_id),
      kind: String(r.kind) as RecognizeJob["kind"],
      document: (r.strokes as import("./ink-doc").InkDocument | null) ?? null,
      blobUrl: (r.blob_url as string | null) ?? null,
      mimeType: (r.mime_type as string | null) ?? null,
    }));
  });
}

/**
 * Store a reading.
 *
 * `coverage` is how much of the surface was actually read: 1 for the whole of
 * it, below 1 when tiles were dropped. Required rather than optional, because
 * a caller that forgets it is a partial reading presented as complete, and
 * that is exactly the failure ADR-056 exists to make impossible.
 */
export async function storeTranscript(
  blockId: string, transcript: string, source: string,
  confidence: number, coverage: number,
): Promise<void> {
  await withoutActor(async (tx) => {
    await tx.execute(sql`
      SELECT app_store_transcript(
        ${blockId}::uuid, ${transcript}::text, ${source}::text,
        ${confidence}::real, ${coverage}::real
      )
    `);
  });
  await announce(blockId, "ready");
}

/**
 * Meter one completed reading. ADR-007, ADR-036.
 *
 * Recorded AFTER the model answered, never before: a call that failed cost us
 * nothing worth billing, and charging for it would make a bad transcript
 * expensive twice.
 */
export async function recordRecognition(
  blockId: string, units: number, kind = "ink",
): Promise<void> {
  await withoutActor(async (tx) => {
    await tx.execute(sql`
      SELECT app_record_recognition(${blockId}::uuid, ${units}::integer, ${kind}::text)
    `);
  });
}

export async function failTranscript(blockId: string): Promise<void> {
  await withoutActor(async (tx) => {
    await tx.execute(sql`SELECT app_fail_transcript(${blockId}::uuid)`);
  });
  await announce(blockId, "failed");
}

/**
 * Tell any open page that this block has been read. ADR-058.
 *
 * The reason /07-capture-pipeline.md always said "push to any open client":
 * recognition settles thirty seconds after the last stroke and then takes as
 * long as a model call takes, by which point nobody is watching a spinner. It
 * should simply appear.
 *
 * Best effort, and after the write. A reading that is stored but not announced
 * shows up on the next visit; one that is announced but not stored would be a
 * lie, which is why the order is not the other way round.
 */
async function announce(blockId: string, state: string): Promise<void> {
  const where = await withoutActor(async (tx) => {
    const rows = await tx.execute(sql`SELECT * FROM app_block_note(${blockId}::uuid)`);
    const found = (rows as unknown as Array<{ note_id: string; space_id: string }>)[0];
    // Recorded here because this is the one place that already knows which
    // note and which space a block belongs to. A reading arriving twenty
    // minutes after somebody wrote a page is the clearest thing the changes
    // feed has to report, and the worker wrote nothing at all before ADR-063.
    //
    // Through a definer function: the worker has no actor, and audit_log's
    // policy matches nothing without one -- a plain INSERT here would write
    // zero rows and report success. ADR-057.
    if (found) {
      await writeChange(tx, found.space_id, `note.transcript.${state}`, found.note_id, { blockId });
    }
    return found;
  });
  if (!where) return;
  publish({
    kind: "block", spaceId: where.space_id, noteId: where.note_id,
    blockId, transcriptState: state, at: Date.now(),
  });
}
