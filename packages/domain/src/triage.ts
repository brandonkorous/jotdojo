import { sql } from "drizzle-orm";
import { withoutActor } from "@jotdojo/db";

/**
 * The triage agent's side of the outbox. M5, ADR-048.
 *
 * No `Actor` in this file, for the same reason there is none in embedjobs.ts:
 * this is the system reading its own corpus while the people who wrote it are
 * asleep. All of the authority lives in 0024_triage.sql, where the rules about
 * who gets triaged, when, and what may be written back can be read in one
 * sitting.
 *
 * The narrowness is the point. The only thing this agent can write is a
 * comment (ADR-004): note content is untrusted input, so the mitigation for
 * being talked into something is that the worst it can do is say a sentence.
 */

export type TriageJob = {
  jobId: string;
  noteId: string;
  spaceId: string;
  title: string | null;
  content: string;
};

const rows = (result: unknown) => result as unknown as Array<Record<string, unknown>>;

/**
 * Queue the notes that have settled since each space was last looked at.
 *
 * `quiet` is the load-bearing argument. A note whose last edit was forty
 * seconds ago is a sentence somebody is still writing, and remarking on it is
 * the difference between an assistant and an interruption.
 *
 * `spaceId` narrows it to one, for the two cases where somebody is waiting:
 * they have just switched it on and want to see it work, or a suite needs its
 * own numbers to mean something. null is every space, which is the worker's
 * call. ADR-048.
 */
export async function enqueueTriage(
  quiet = "15 minutes", lookback = "24 hours", limit = 200,
  spaceId: string | null = null,
): Promise<number> {
  return withoutActor(async (tx) => {
    const result = await tx.execute(sql`
      SELECT app_enqueue_triage(
        ${quiet}::interval, ${lookback}::interval, ${limit}::integer,
        ${spaceId}::uuid) AS n
    `);
    return Number(rows(result)[0]?.n ?? 0);
  });
}

/**
 * Claim triage jobs, with the note already assembled.
 *
 * The text comes back from the database rather than being read block by block
 * here, so the worker never needs a door onto blocks it does not own -- the
 * same argument as the recognition claim, which hands over the strokes.
 */
export async function claimTriageJobs(
  batch = 4, leaseSeconds = 300,
): Promise<TriageJob[]> {
  return withoutActor(async (tx) => {
    const result = await tx.execute(
      sql`SELECT * FROM app_claim_triage_jobs(${batch}::int, ${leaseSeconds}::int)`,
    );
    return rows(result).map((r) => ({
      jobId: String(r.job_id),
      noteId: String(r.note_id),
      spaceId: String(r.space_id),
      title: (r.title as string | null) ?? null,
      content: String(r.content ?? ""),
    }));
  });
}

/**
 * Leave the agent's remark on a note.
 *
 * Returns null when nothing was written, which happens when the space was
 * switched off between the claim and the answer. That is not an error and must
 * not be retried: it is off meaning off, arriving a few seconds late.
 */
export async function commentAsAgent(
  noteId: string, body: string, model: string,
): Promise<string | null> {
  return withoutActor(async (tx) => {
    const result = await tx.execute(sql`
      SELECT app_comment_as_agent(
        ${noteId}::uuid, ${body}::text, ${model}::text) AS id
    `);
    const id = rows(result)[0]?.id;
    return id ? String(id) : null;
  });
}

/**
 * Meter one triage run. ADR-007, docs/01.
 *
 * Recorded whether or not the agent had anything to say, because deciding to
 * stay quiet cost exactly as much as deciding to speak. Charging only for
 * remarks would quietly reward a model for talking.
 */
export async function recordTriage(noteId: string, units = 1): Promise<void> {
  await withoutActor(async (tx) => {
    await tx.execute(sql`SELECT app_record_triage(${noteId}::uuid, ${units}::integer)`);
  });
}
