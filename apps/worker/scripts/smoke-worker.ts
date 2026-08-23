/**
 * The drain loop's own behaviour, which smoke-search.ts does not cover.
 *
 * smoke-search drives claim/store/finish directly to prove retrieval works.
 * This drives runCycle(), which is what actually runs in production, and it
 * concentrates on the failure paths -- a queue is only as good as what it does
 * when the thing it calls is broken.
 */
import { fakeEmbedder, EmbeddingError, type Embedder } from "@jotacular/embeddings";
import {
  upsertUserFromGoogle, asUser, createNote, defaultSpaceId, searchNotes, claimEmbedJobs,
} from "@jotacular/domain";
import { runCycle } from "../src/embed";

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}`);
  if (!ok) failures++;
};

/** Drains whatever other suites left behind, so counts below are about us. */
async function drainAll(e: Embedder) {
  for (let i = 0; i < 50; i++) if ((await runCycle(e, 64)).claimed === 0) return;
}

/**
 * How many of OUR jobs are pending, counted by claiming and releasing.
 *
 * There is deliberately no read-only door for this: the worker's whole
 * capability surface is claim, store, finish (ADR-024), and adding a fourth
 * function so a test could peek would widen it for no production reason.
 *
 * Scoped to one space, because the queue is global. An unscoped count is a
 * count of what everybody else happened to leave lying about, and it passes
 * for months until the day it does not.
 */
async function peek(space: string): Promise<number> {
  // A zero-second lease, so the rows are claimable again the instant this
  // returns and the count does not perturb what follows.
  const jobs = await claimEmbedJobs(64, 0);
  return new Set(jobs.filter((j) => j.spaceId === space).map((j) => j.jobId)).size;
}

const good = fakeEmbedder();
const broken: Embedder = {
  model: "broken",
  maxDistance: 0.9,
  async embed() { throw new EmbeddingError("provider is down", true); },
};

await drainAll(good);

const stamp = Date.now();
const user = await upsertUserFromGoogle({
  googleSub: `worker-${stamp}`, email: `w-${stamp}@example.test`, displayName: "Worker",
});
const actor = asUser(user.id);
const space = await defaultSpaceId(actor);

console.log("\nhappy path");

const note = await createNote(actor, space,
  "The quarterly planning meeting moved to the first Thursday of the month");
check("one save queues exactly one job", (await peek(space)) === 1);

const first = await runCycle(good, 16);
check("the cycle claims and embeds it", first.claimed === 1 && first.embedded === 1);
check("nothing failed", first.failed === 0);
check("the queue is now empty", (await runCycle(good, 16)).claimed === 0);
check("the note is semantically findable",
  (await searchNotes(actor, space, "quarterly planning"))
    .find((h) => h.id === note.id)?.matchedBy.includes("semantic") === true);

console.log("\ncoalescing");

// Ten autosaves in a row is the normal case, not an edge case: the canvas
// saves every 600ms while someone types.
for (let i = 0; i < 10; i++) {
  await createNote(actor, space, `Autosave probe ${stamp} number ${i} with enough text to embed`);
}
// Counted on the QUEUE rather than on what one cycle claimed. `claimed` is a
// number about a batch and about whoever else is draining; the queue depth is
// the thing the coalescing rule is actually about.
check("ten distinct notes queue ten jobs", (await peek(space)) === 10);
await runCycle(good, 64);

const repeat = await createNote(actor, space,
  "A note that will be saved repeatedly before the worker ever wakes up");
const { saveNote } = await import("@jotacular/domain");
let rev = repeat.revision;
for (let i = 0; i < 5; i++) {
  rev = (await saveNote(actor, repeat.id, `Revision ${i} of a note saved over and over`, rev)).revision;
}
check("five saves of ONE note coalesce into one job", (await peek(space)) === 1);

console.log("\nwhen the provider is down");

await runCycle(good, 64);

const later = await createNote(actor, space,
  "This note is written while the embedding provider is refusing every request");
const failedCycle = await runCycle(broken, 16);
check("a provider outage does not throw out of the cycle", failedCycle.failed === 1);
check("...and nothing was recorded as embedded", failedCycle.embedded === 0);

// The job must be BACKED OFF, not lost and not hot-looping. Immediately
// re-claimable would mean a dead provider spins the queue at full speed;
// completed would mean the note is never embedded and nothing says so.
check("the failed job is not immediately re-claimable", (await claimEmbedJobs(16)).length === 0);
check("the note is still findable lexically meanwhile",
  (await searchNotes(actor, space, "refusing")).some((h) => h.id === later.id));

console.log("\nshort blocks");

const short = await createNote(actor, space, "eggs");
check("a too-short note leaves no job behind", (await peek(space)) === 0);
check("...and the cycle has nothing to do", (await runCycle(good, 16)).claimed === 0);
check("...but it is still a note", (await searchNotes(actor, space, "eggs"))
  .some((h) => h.id === short.id));

console.log(failures === 0 ? "\nworker smoke: all checks passed" : `\nworker smoke: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
