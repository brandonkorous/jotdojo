import { sql } from "drizzle-orm";
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
  document: import("./ink").InkDocument | null;
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
      document: (r.strokes as import("./ink").InkDocument | null) ?? null,
      blobUrl: (r.blob_url as string | null) ?? null,
      mimeType: (r.mime_type as string | null) ?? null,
    }));
  });
}

export async function storeTranscript(
  blockId: string, transcript: string, source: string, confidence: number,
): Promise<void> {
  await withoutActor(async (tx) => {
    await tx.execute(sql`
      SELECT app_store_transcript(
        ${blockId}::uuid, ${transcript}::text, ${source}::text, ${confidence}::real
      )
    `);
  });
}

/**
 * Meter one completed reading. ADR-007, ADR-036.
 *
 * Recorded AFTER the model answered, never before: a call that failed cost us
 * nothing worth billing, and charging for it would make a bad transcript
 * expensive twice.
 */
export async function recordRecognition(blockId: string, units: number): Promise<void> {
  await withoutActor(async (tx) => {
    await tx.execute(sql`SELECT app_record_recognition(${blockId}::uuid, ${units}::integer)`);
  });
}

export async function failTranscript(blockId: string): Promise<void> {
  await withoutActor(async (tx) => {
    await tx.execute(sql`SELECT app_fail_transcript(${blockId}::uuid)`);
  });
}
