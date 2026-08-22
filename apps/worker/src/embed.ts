import { claimEmbedJobs, finishJob, storeEmbedding, type EmbedJob } from "@jotdojo/domain";
import { EmbeddingError, type Embedder } from "@jotdojo/embeddings";

export type CycleResult = { claimed: number; embedded: number; failed: number };

/**
 * One drain cycle: claim a batch, embed it, store the vectors, close the jobs.
 *
 * Exported separately from the loop so the smoke suite can run exactly one
 * cycle and assert on what it did, rather than starting a daemon and sleeping.
 */
export async function runCycle(embedder: Embedder, batch = 16): Promise<CycleResult> {
  const jobs = await claimEmbedJobs(batch);
  if (jobs.length === 0) return { claimed: 0, embedded: 0, failed: 0 };

  // A note is several blocks, so one outbox row can yield several jobs. The
  // job is only finished once every block it produced has been handled --
  // finishing early would drop the rest of the note out of semantic search.
  const byJob = new Map<string, EmbedJob[]>();
  for (const job of jobs) {
    const list = byJob.get(job.jobId) ?? [];
    list.push(job);
    byJob.set(job.jobId, list);
  }

  let embedded = 0;
  let failed = 0;

  // One provider call for the whole batch (docs/07: batch, they are chatty),
  // but the *outcome* is applied per job, so one bad note cannot fail the rest.
  let vectors: number[][];
  try {
    vectors = await embedder.embed(jobs.map((j) => j.content));
  } catch (err) {
    const message = err instanceof EmbeddingError ? err.message : String(err);
    // Whole batch failed: hand every job back with its error so backoff
    // applies, rather than leaving them leased until the lease expires.
    for (const jobId of byJob.keys()) await finishJob(jobId, message);
    return { claimed: jobs.length, embedded: 0, failed: byJob.size };
  }

  for (const [jobId, group] of byJob) {
    try {
      for (const job of group) {
        const vector = vectors[jobs.indexOf(job)];
        if (!vector) throw new Error(`no vector returned for block ${job.blockId}`);
        await storeEmbedding(job.blockId, job.spaceId, vector, embedder.model);
        embedded++;
      }
      await finishJob(jobId);
    } catch (err) {
      failed++;
      await finishJob(jobId, String(err));
    }
  }

  return { claimed: jobs.length, embedded, failed };
}
