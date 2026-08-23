import {
  claimTriageJobs, commentAsAgent, recordTriage, finishJob, type TriageJob,
} from "@jotacular/domain";
import { ReasoningError, type Reasoner } from "@jotacular/reason";

/**
 * The triage agent. M5, docs/07-capture-pipeline.md, ADR-048.
 *
 * Reads notes that have settled since the space was last looked at, and leaves
 * a comment on the few that are actually asking for something. It never edits,
 * and it is the only thing in the product that speaks without being spoken to
 * -- which is why the interesting behaviour here is all about staying quiet.
 */

export type TriageResult = {
  claimed: number;
  /** Read and judged, whether or not there was anything to say. */
  read: number;
  /** Read and worth a remark. Always <= read, usually much smaller. */
  spoke: number;
  failed: number;
};

/** Below this a note has not said enough to have anything in it. Cheaper than
 *  a model call and kinder than a remark about four words. */
const MIN_CHARS = 40;

/**
 * One triage cycle.
 *
 * Per job rather than per batch, like recognition and for the same reason: one
 * note that upsets the model must not cost everybody else their pass.
 */
export async function runTriageCycle(
  reasoner: Reasoner, batch = 4,
): Promise<TriageResult> {
  const jobs = await claimTriageJobs(batch);
  if (jobs.length === 0) return { claimed: 0, read: 0, spoke: 0, failed: 0 };

  let read = 0;
  let spoke = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      if (await triageOne(reasoner, job)) spoke++;
      read++;
      await finishJob(job.jobId);
    } catch (err) {
      failed++;
      const retryable = err instanceof ReasoningError ? err.retryable : true;
      // Nothing to mark on the note. Unlike a failed transcript there is no
      // gap for a person to see -- silence is what most notes get anyway, so a
      // failure here is invisible by design and lives in the outbox row.
      await finishJob(job.jobId, message(err, retryable));
    }
  }

  return { claimed: jobs.length, read, spoke, failed };
}

/** True when the agent had something to say and said it. */
async function triageOne(reasoner: Reasoner, job: TriageJob): Promise<boolean> {
  const content = job.content.trim();
  if (content.length < MIN_CHARS) return false;

  const notice = await reasoner.triage({ title: job.title, content });

  // Metered whether or not it spoke: deciding to stay quiet cost the same call
  // as deciding to speak, and billing only for remarks would pay a model to
  // talk. docs/01.
  await recordTriage(job.noteId);
  if (!notice.comment) return false;

  // null means the space was switched off between the claim and the answer.
  // Not an error and not retried -- that is off meaning off, a few seconds late.
  return (await commentAsAgent(job.noteId, notice.comment, reasoner.model)) !== null;
}

const message = (err: unknown, retryable: boolean) =>
  `${retryable ? "" : "permanent: "}${(err as Error).message}`;
