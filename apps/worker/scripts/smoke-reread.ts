/**
 * Reading old content again with a newer model. M5, ADR-046.
 *
 * This is the payoff for storing strokes rather than a flattened raster: a page
 * drawn a year ago becomes readable by a better model, and the person who drew
 * it does nothing.
 *
 * The check that matters most is the last section. A correction is ground
 * truth. Overwriting somebody's correction with a "better" model would be the
 * single most infuriating thing this product could do, and a pass that walks
 * the whole corpus is exactly how that would happen by accident.
 *
 * Runs against the fake recognizer. What is under test is which blocks get
 * queued and which are left alone -- nothing here claims anything about how
 * well any model reads.
 */
import { fakeRecognizer } from "@jotdojo/vision";
import {
  upsertUserFromGoogle, asUser, createNote, defaultSpaceId,
  createInkBlock, appendStrokes, getNote, correctTranscript,
  countStale, listStale, requeueRecognition,
  type Stroke,
} from "@jotdojo/domain";
import { runRecognitionCycle } from "../src/recognize";
import { sourceFor } from "../src/sources";
import { plannedKinds } from "../src/reread";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const scrawl = (row: number): Stroke => ({
  tool: "pen", color: "#1A1817", width: 2,
  pts: Array.from({ length: 20 }, (_, i) => [
    40 + i * 12, row + Math.sin(i / 2) * 8, i * 8, 0.5, 0, 0,
  ] as Stroke["pts"][number]),
});

async function releaseQuietPeriod() {
  const { db } = await import("@jotdojo/db");
  await db.execute(
    `UPDATE outbox SET available_at = now()
      WHERE topic = 'block.recognize' AND completed_at IS NULL`,
  );
}

/**
 * Take everybody else's jobs out of the queue.
 *
 * The recognition queue is global -- a worker claims the oldest jobs, whoever
 * they belong to -- so a suite that shares a database with fifteen others
 * cannot assume its own page is in the first batch. Draining is not enough
 * either: a job for an over-quota space is deferred and handed straight back,
 * so it never leaves the queue by being worked.
 */
async function clearForeignJobs(mine: string) {
  const { db } = await import("@jotdojo/db");
  await db.execute(
    `UPDATE outbox o SET completed_at = now()
      WHERE o.topic = 'block.recognize' AND o.completed_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM blocks b
           WHERE b.id = (o.payload ->> 'blockId')::uuid AND b.space_id = '${mine}'
        )`,
  );
}

/** Whether THIS page is stale. The database is shared with every other suite,
 *  so a count of the whole corpus proves nothing about one block. */
const isStale = async (blockId: string, source: string) =>
  (await listStale("ink", source, 5000, space)).includes(blockId);

/** Leave the queue empty so the counts below are ours. */
async function drainAll() {
  await releaseQuietPeriod();
  const r = fakeRecognizer("leftover");
  for (let i = 0; i < 30; i++) if ((await runRecognitionCycle(r, null, 16)).claimed === 0) return;
}

/** Read until THIS page has been read, rather than hoping it was in the batch. */
async function readUntilDone(blockId: string, text: string) {
  const { db } = await import("@jotdojo/db");
  for (let i = 0; i < 20; i++) {
    await releaseQuietPeriod();
    await runRecognitionCycle(fakeRecognizer(text), null, 16);
    const rows = await db.execute(
      `SELECT 1 FROM outbox WHERE topic = 'block.recognize' AND completed_at IS NULL
         AND payload ->> 'blockId' = '${blockId}'`);
    if ((rows as unknown as unknown[]).length === 0) return;
  }
}

const OLD = "htr:vlm:old-model-v1";
const NOW = sourceFor("ink", { vision: "fake-recognizer-v1" });

const stamp = Date.now();
const user = await upsertUserFromGoogle({
  googleSub: `rr-${stamp}`, email: `rr-${stamp}@example.test`, displayName: "Reread",
});
const actor = asUser(user.id);
const space = await defaultSpaceId(actor);
await clearForeignJobs(space);
await drainAll();

/** A page, read once, so it has a transcript and a source. */
async function readPage(text: string) {
  const note = await createNote(actor, space, "");
  const ink = await createInkBlock(actor, note.id, { w: 800, h: 600 });
  await appendStrokes(actor, ink.blockId, 0, [scrawl(100), scrawl(200)]);
  await readUntilDone(ink.blockId, text);
  return { noteId: note.id, blockId: ink.blockId };
}

const transcriptOf = async (noteId: string) =>
  (await getNote(actor, noteId)).blocks?.find((b) => b.kind === "ink")?.transcript ?? null;

console.log("\na page read by the model we use now");
const fresh = await readPage("the first reading");
check("it has a transcript", (await transcriptOf(fresh.noteId)) === "the first reading",
  String(await transcriptOf(fresh.noteId)));
check("nothing is stale against the CURRENT source", (await countStale("ink", NOW, 5000, space)) === 0,
  String(await countStale("ink", NOW, 5000, space)));

console.log("\nthe day a better model ships");
check("the same page IS stale against a different source",
  await isStale(fresh.blockId, OLD));
const queued = await requeueRecognition("ink", OLD, 5000, space);
check("it is queued to be read again", queued >= 1, String(queued));
check("...and it is no longer listed, because it is already waiting",
  !(await isStale(fresh.blockId, OLD)));
check("...so queueing again bills nobody twice",
  (await requeueRecognition("ink", OLD, 5000, space)) === 0);
check("the OLD transcript is still readable while it waits",
  (await transcriptOf(fresh.noteId)) === "the first reading");

console.log("\nand then it is read again");
await releaseQuietPeriod();
const cycle = await runRecognitionCycle(fakeRecognizer("a much better reading"), null, 8);
check("the cycle picks the requeued page up", cycle.read >= 1, JSON.stringify(cycle));
check("the transcript is replaced", (await transcriptOf(fresh.noteId)) === "a much better reading",
  String(await transcriptOf(fresh.noteId)));
check("...and is no longer stale", (await countStale("ink", NOW, 5000, space)) === 0);

console.log("\na correction is ground truth and is NEVER re-read");
const mine = await readPage("what the machine thought");
await correctTranscript(actor, mine.blockId, "what I actually wrote");
check("the correction stands", (await transcriptOf(mine.noteId)) === "what I actually wrote");
check("a corrected block is not stale, whatever model ships",
  !(await isStale(mine.blockId, OLD)));
await requeueRecognition("ink", OLD, 5000, space);
check("...so a sweep of the whole space never queues it",
  !(await isStale(mine.blockId, OLD)));
await readUntilDone(mine.blockId, "the machine trying again");
check("...so a later pass cannot overwrite it",
  (await transcriptOf(mine.noteId)) === "what I actually wrote",
  String(await transcriptOf(mine.noteId)));

console.log("\nbounded, because each page costs money");
await drainAll();
const pages = [await readPage("one"), await readPage("two"), await readPage("three")];
const before = await countStale("ink", OLD, 5000, space);
check("the fresh pages are stale", before >= 3, String(before));
check("a limit of two queues two", (await requeueRecognition("ink", OLD, 2, space)) === 2);
check("...and the rest are still waiting for the next run",
  (await countStale("ink", OLD, 5000, space)) === before - 2,
  String(await countStale("ink", OLD, 5000, space)));
check("...including one this run created", await isStale(pages[2]!.blockId, OLD));

console.log("\nscoping, so one customer's pages cost one customer's pages");
const elsewhere = await countStale("ink", OLD);
check("the corpus has stale pages outside this space", elsewhere > 0, String(elsewhere));
check("...and a scoped count leaves them alone",
  (await countStale("ink", OLD, 5000, space)) < elsewhere);


console.log("\nwhat can be re-read at all");
check("with no providers configured, nothing is offered",
  plannedKinds({}).length === 0);
check("vision covers ink and photos",
  plannedKinds({ vision: "m" }).join() === "ink,image");
check("speech covers audio", plannedKinds({ speech: "m" }).join() === "audio");
check("the source format is the one the recogniser writes",
  NOW === "htr:vlm:fake-recognizer-v1", NOW);

await drainAll();
console.log(failures === 0
  ? "\nreread smoke: all checks passed"
  : `\nreread smoke: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
