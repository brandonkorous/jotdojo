/**
 * Proves hybrid retrieval end to end: outbox -> worker -> pgvector -> fusion.
 *
 * The rule this suite exists to enforce is ADR-020's: a check that cannot tell
 * a refusal from a crash is not testing the refusal. So every assertion here
 * names the specific note it expects, and the tenancy checks assert on
 * *content*, not on "something happened".
 *
 * Runs against EMBEDDING_PROVIDER=fake -- a deterministic hash projection with
 * no semantics. That is deliberate: what is under test is the plumbing, and a
 * real provider would make this suite slow, keyed, and non-deterministic. The
 * one thing the fake cannot prove is retrieval *quality*; nothing here claims
 * to.
 */
import { fakeEmbedder } from "@jotacular/embeddings";
import {
  upsertUserFromGoogle, asUser, createNote, defaultSpaceId,
  searchNotes, claimEmbedJobs, storeEmbedding, finishJob,
} from "../src/index";

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}`);
  if (!ok) failures++;
};

/** Drain the queue the way the worker does, so this tests the real path. */
async function drain(): Promise<number> {
  const embedder = fakeEmbedder();
  let embedded = 0;
  for (let cycle = 0; cycle < 20; cycle++) {
    const jobs = await claimEmbedJobs(32);
    if (jobs.length === 0) break;
    const vectors = await embedder.embed(jobs.map((j) => j.content));
    const seen = new Set<string>();
    for (const [i, job] of jobs.entries()) {
      await storeEmbedding(job.blockId, job.spaceId, vectors[i]!, embedder.model);
      seen.add(job.jobId);
      embedded++;
    }
    for (const jobId of seen) await finishJob(jobId);
  }
  return embedded;
}

const stamp = Date.now();
const alice = await upsertUserFromGoogle({
  googleSub: `search-alice-${stamp}`, email: `sa-${stamp}@example.test`, displayName: "Alice",
});
const bob = await upsertUserFromGoogle({
  googleSub: `search-bob-${stamp}`, email: `sb-${stamp}@example.test`, displayName: "Bob",
});
const A = asUser(alice.id);
const B = asUser(bob.id);
const aSpace = await defaultSpaceId(A);
const bSpace = await defaultSpaceId(B);

const kubernetes = await createNote(A, aSpace,
  "Deploy notes: the kubernetes ingress controller needs a bigger request timeout");
const pricing = await createNote(A, aSpace,
  "We settled on three tiers and agreed not to charge for storage, only for recognition runs");
const short = await createNote(A, aSpace, "milk");
await createNote(B, bSpace,
  "Bob's own kubernetes cluster notes, which Alice must never see in her results");

console.log("\nqueue");

const beforeDrain = await searchNotes(A, aSpace, "kubernetes");
check("lexical search works before anything is embedded",
  beforeDrain.some((h) => h.id === kubernetes.id));
check("...and reports it was found lexically, not semantically",
  beforeDrain.find((h) => h.id === kubernetes.id)?.matchedBy.includes("lexical") === true);

const embedded = await drain();
check(`worker drained the queue (${embedded} blocks embedded)`, embedded >= 2);
check("a second drain finds nothing left to do", (await drain()) === 0);

console.log("\nfusion");

const hits = await searchNotes(A, aSpace, "kubernetes");
const top = hits.find((h) => h.id === kubernetes.id);
check("the kubernetes note is found", Boolean(top));
check("both lexical and semantic recalled it",
  top!.matchedBy.includes("lexical") && top!.matchedBy.includes("semantic"));

// The whole reason for trigram: tsvector stems, it does not spell-correct.
const typo = await searchNotes(A, aSpace, "kubernets");
check("a misspelled query still finds the note (trigram)",
  typo.some((h) => h.id === kubernetes.id));
check("...and says so", typo.find((h) => h.id === kubernetes.id)
  ?.matchedBy.includes("fuzzy") === true);

const milk = await searchNotes(A, aSpace, "milk");
check("a note whose only block is too short is never embedded",
  milk.find((h) => h.id === short.id)?.matchedBy.includes("semantic") === false);
check("...but is still findable lexically", milk.some((h) => h.id === short.id));

check("an unrelated query returns nothing",
  (await searchNotes(A, aSpace, "xylophone hovercraft")).length === 0);
check("an empty query returns nothing", (await searchNotes(A, aSpace, "   ")).length === 0);
check("pricing note is retrievable by its own words",
  (await searchNotes(A, aSpace, "tiers")).some((h) => h.id === pricing.id));

console.log("\ntenancy -- the part that matters");

// Every strategy is a separate query with its own WHERE clause. A leak in one
// of them would be invisible in the other two, so each is named.
const aliceLooksForBob = await searchNotes(A, aSpace, "cluster");
check("semantic recall does NOT cross spaces",
  !aliceLooksForBob.some((h) => h.preview.includes("Bob")));

const bobSearches = await searchNotes(B, bSpace, "kubernetes");
check("bob finds only his own kubernetes note", bobSearches.length === 1);
check("...and it is his", bobSearches[0]!.preview.includes("Bob"));

let refused = false;
try {
  await searchNotes(B, aSpace, "kubernetes");
} catch (err) {
  refused = (err as Error).name === "Forbidden" || /cannot reach/.test((err as Error).message);
}
check("bob searching alice's space is REFUSED, not merely empty", refused);

// A grant-scoped agent is the case RLS alone cannot catch: space_ids lives in
// an array column that no policy reads (ADR-021).
const scopedAgent = {
  type: "agent" as const,
  userId: alice.id,
  clientId: "smoke-client",
  clientRecordId: "00000000-0000-0000-0000-000000000000",
  scopes: ["notes:read"] as const,
  spaceIds: [] as const,
};
let agentRefused = false;
try {
  await searchNotes(scopedAgent, aSpace, "kubernetes");
} catch (err) {
  agentRefused = /cannot reach/.test((err as Error).message);
}
check("an agent without a grant for the space is REFUSED", agentRefused);

console.log(failures === 0 ? "\nall search checks passed" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
