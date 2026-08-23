/**
 * @jotdojo/worker -- the async half.
 *
 * Drains the outbox and runs everything the capture path is forbidden from
 * doing. The synchronous capture path never calls a model; if a model is in
 * the capture path, the capture contract is broken (docs/07).
 *
 * Three topics: `block.embed` (semantic search), `block.recognize`
 * (handwriting, photos, voice) and `note.triage` (the agent that reads new
 * notes and comments). Each is independent -- a missing provider for one does
 * not stop the others, and none of them stops capture. ADR-007.
 */
import { embedder } from "@jotdojo/embeddings";
import { recognizer } from "@jotdojo/vision";
import { transcriber } from "@jotdojo/speech";
import { reasoner } from "@jotdojo/reason";
import { runCycle } from "./embed";
import { runRecognitionCycle } from "./recognize";
import { runStructureCycle } from "./structure";
import { runTriageCycle } from "./triage";
import { enqueueDueTriage } from "./schedule";

const IDLE_MS = Number(process.env.WORKER_IDLE_MS ?? 2000);
const BATCH = Number(process.env.WORKER_BATCH ?? 16);
// Smaller, because each one is a vision call over a whole page.
/** Smaller than recognition's: one call over a whole page, and the answer is
 *  worth less than a transcript if it has to wait. */
const STRUCTURE_BATCH = Number(process.env.WORKER_STRUCTURE_BATCH ?? 2);
const RECOGNIZE_BATCH = Number(process.env.WORKER_RECOGNIZE_BATCH ?? 4);
const TRIAGE_BATCH = Number(process.env.WORKER_TRIAGE_BATCH ?? 4);

const provider = embedder();
const reader = recognizer();
const listener = transcriber();
const thinker = reasoner();

/**
 * Wait for a shutdown signal, doing nothing.
 *
 * A Deployment restarts a clean exit forever, so exiting here looks exactly
 * like a crash loop to anyone reading the cluster. Parking stays honestly
 * idle instead, and still stops promptly when Kubernetes asks. ADR-055.
 */
function park(): Promise<void> {
  return new Promise((resolve) => {
    // A signal handler does NOT hold the event loop open, and Node treats a
    // top-level await with nothing left to wake it as a deadlock: it warns
    // about an unsettled await and exits 13. The timer is the whole
    // difference between parking and dying slightly later.
    const alive = setInterval(() => {}, 1 << 30);
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      process.on(signal, () => {
        clearInterval(alive);
        resolve();
      });
    }
  });
}

if (!provider && !reader && !listener && !thinker) {
  // Not a crash. Search degrades to lexical plus trigram and capture is
  // entirely unaffected; a missing provider must never stop the app from
  // accepting notes (ADR-007). It must be loud, though -- a silently idle
  // worker looks exactly like a working one.
  console.warn(
    "[worker] no EMBEDDING_PROVIDER, VISION_PROVIDER, SPEECH_PROVIDER or "
    + "TRIAGE_PROVIDER is configured, so there is nothing to drain. Semantic "
    + "search, recognition and the triage agent are off; lexical search, fuzzy "
    + "search, ink capture and everything else still work. Set them to openai, "
    + "azure, anthropic, or fake (development only).",
  );
  await park();
  console.log("[worker] stopped");
  process.exit(0);
}

if (!provider) console.warn("[worker] no EMBEDDING_PROVIDER: semantic search is off");
if (!reader) console.warn("[worker] no VISION_PROVIDER: handwriting and photos stay unread");
if (!listener) console.warn("[worker] no SPEECH_PROVIDER: recordings stay untranscribed");
if (!thinker) console.warn("[worker] no TRIAGE_PROVIDER: the triage agent does not run");

console.log(
  `[worker] draining${provider ? ` block.embed (${provider.model})` : ""}`
  + `${reader ? ` block.recognize/vision (${reader.model})` : ""}`
  + `${listener ? ` block.recognize/speech (${listener.model})` : ""}`
  + `${thinker ? ` note.triage (${thinker.model})` : ""}`,
);

let running = true;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`[worker] ${signal}: finishing the current cycle`);
    running = false;
  });
}

/** One pass over every topic. Returns how much work was found, so an idle
 *  worker can back off instead of hammering the database. */
async function cycle(): Promise<number> {
  // Both topics every cycle. Recognition is slower and rarer, so it does not
  // get its own loop -- it would spend almost all of its time asleep.
  const embed = provider
    ? await runCycle(provider, BATCH)
    : { claimed: 0, embedded: 0, failed: 0 };
  // One queue, both senses. A job for a modality with no provider is failed
  // explicitly inside the cycle rather than skipped here, so the block says
  // "not read" instead of sitting pending forever.
  const ink = reader || listener
    ? await runRecognitionCycle(reader, listener, RECOGNIZE_BATCH)
    : { claimed: 0, read: 0, failed: 0 };

  // What is DRAWN on a page, as opposed to what it says. Same queue shape, a
  // different question, and it settles later than the transcript so a diagram
  // somebody is still drawing is not read twice. ADR-066.
  const shapes = await runStructureCycle(reader, STRUCTURE_BATCH);

  // Queued on a schedule rather than by an event: triage is about notes that
  // have STOPPED changing, and there is no event for somebody putting their
  // pen down. Nothing is queued when no provider can answer it.
  if (thinker) await enqueueDueTriage();
  const triage = thinker
    ? await runTriageCycle(thinker, TRIAGE_BATCH)
    : { claimed: 0, read: 0, spoke: 0, failed: 0 };

  if (embed.claimed > 0) {
    console.log(`[worker] embed: ${embed.claimed} claimed, ${embed.embedded} done, ${embed.failed} failed`);
  }
  if (ink.claimed > 0) {
    console.log(`[worker] ink: ${ink.claimed} claimed, ${ink.read} read, ${ink.failed} failed`);
  }
  if (shapes.claimed > 0) {
    console.log(`[worker] structure: ${shapes.claimed} claimed, ${shapes.read} read, ${shapes.failed} failed`);
  }
  if (triage.claimed > 0) {
    console.log(`[worker] triage: ${triage.claimed} claimed, ${triage.spoke} commented, ${triage.failed} failed`);
  }
  return embed.claimed + ink.claimed + shapes.claimed + triage.claimed;
}

// Back off when the queue is empty, so an idle worker is not a busy loop
// against the database. Resets the moment there is work.
let idle = IDLE_MS;

while (running) {
  try {
    idle = (await cycle()) > 0 ? IDLE_MS : Math.min(idle * 2, 30_000);
  } catch (err) {
    // The loop must outlive a database blip. Jobs stay leased and become
    // claimable again when the lease expires, so nothing is lost by waiting.
    console.error("[worker] cycle failed:", err);
    idle = Math.min(idle * 2, 30_000);
  }
  if (running) await new Promise((r) => setTimeout(r, idle));
}

console.log("[worker] stopped");
process.exit(0);
