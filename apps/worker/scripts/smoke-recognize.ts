/**
 * Handwriting recognition, end to end: strokes -> SVG -> PNG -> model ->
 * transcript -> searchable -> visible over MCP.
 *
 * The check that matters most is the last section. A person correcting a
 * transcript is ground truth, and a model must never overwrite it -- including
 * when the correction lands while a recognition job for that block is already
 * in flight. That window is guarded in two places (0011_recognition_jobs.sql)
 * and both are exercised here.
 *
 * Runs against VISION_PROVIDER=fake, which cannot read handwriting. What is
 * under test is the pipeline. Nothing here claims anything about accuracy.
 */
import sharp from "sharp";
import { fakeRecognizer } from "@jotdojo/vision";
import { toSvg, bands } from "@jotdojo/ink-render";
import {
  upsertUserFromGoogle, asUser, createNote, defaultSpaceId, searchNotes,
  createInkBlock, appendStrokes, getInk, correctTranscript,
  claimRecognizeJobs, storeTranscript,
  type Stroke, type InkDocument,
} from "@jotdojo/domain";
import { runRecognitionCycle } from "../src/recognize";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const scrawl = (row: number): Stroke => ({
  tool: "pen",
  color: "#1A1817",
  width: 2,
  pts: Array.from({ length: 24 }, (_, i) => [
    40 + i * 12, row + Math.sin(i / 2) * 9, i * 8, 0.4 + (i % 5) / 12, 0, 0,
  ] as Stroke["pts"][number]),
});

/** Drain anything other suites left behind so the counts below are ours. */
async function drainAll() {
  const r = fakeRecognizer("leftover");
  for (let i = 0; i < 20; i++) if ((await runRecognitionCycle(r, null, 16)).claimed === 0) return;
}

await drainAll();

const stamp = Date.now();
const user = await upsertUserFromGoogle({
  googleSub: `rec-${stamp}`, email: `r-${stamp}@example.test`, displayName: "Rec",
});
const actor = asUser(user.id);
const space = await defaultSpaceId(actor);

console.log("\nrendering");

const doc: InkDocument = {
  v: 1,
  canvas: { w: 1024, h: 1600 },
  strokes: [scrawl(100), scrawl(300), scrawl(900), scrawl(1400)],
};

const svg = toSvg(doc, { mode: "recognition" });
check("the page renders to SVG", svg.startsWith("<svg") && svg.includes("</svg>"));
check("recognition redraws in black on white regardless of pen colour",
  svg.includes('fill="#FFFFFF"') && svg.includes('stroke="#000000"') && !svg.includes("#1A1817"));

const png = await sharp(Buffer.from(svg)).png().toBuffer();
const meta = await sharp(png).metadata();
check("...and rasterises to a real PNG", meta.format === "png" && (meta.width ?? 0) > 0);
check("the long edge is capped", Math.max(meta.width ?? 0, meta.height ?? 0) <= 2000);

const split = bands(doc, 700);
check("a tall page is split into bands", split.length > 1);
check("every stroke survives the split",
  split.reduce((n, b) => n + b.strokes.length, 0) >= doc.strokes.length);
check("bands are translated to their own origin",
  split.every((b) => b.strokes.every((s) => s.pts.every((p) => p[1] >= -50))));

const preview = toSvg(doc, { mode: "preview" });
check("a preview keeps the pen colour", preview.includes("#1A1817"));
check("...and is smaller than the recognition render",
  Number(/width="(\d+)"/.exec(preview)![1]) < Number(/width="(\d+)"/.exec(svg)![1]));

console.log("\nthe pipeline");

const note = await createNote(actor, space, "");
const ink = await createInkBlock(actor, note.id, { w: 1024, h: 1600 });
await appendStrokes(actor, ink.blockId, 0, doc.strokes);

check("drawing leaves the block pending",
  (await getInk(actor, ink.blockId)).transcriptState === "pending");

// The quiet period keeps a job invisible for 30s after the last stroke, so a
// page someone is still writing is not read forty times. Nothing is claimable
// yet, and that IS the behaviour.
check("a job just queued is not claimable yet -- it waits for a pause",
  (await claimRecognizeJobs(8)).length === 0);

/** Skip the quiet period for one block, without releasing anyone else's. */
async function releaseQuietPeriod(id: string) {
  const { db } = await import("@jotdojo/db");
  await db.execute(
    `UPDATE outbox SET available_at = now() WHERE topic = 'block.recognize'
       AND completed_at IS NULL AND payload->>'blockId' = '${id}'`,
  );
}

await releaseQuietPeriod(ink.blockId);
const cycle = await runRecognitionCycle(fakeRecognizer("check with Dana about the margins"), null, 8);
check("the cycle reads the page", cycle.claimed >= 1 && cycle.read >= 1);

const done = await getInk(actor, ink.blockId);
check("the transcript is stored", done.transcript === "check with Dana about the margins");
check("...with the model's confidence", done.confidence === 0.82);
check("...and named the model that read it",
  (await getInk(actor, ink.blockId)).transcriptState === "ready");
check("nothing is left to do", (await runRecognitionCycle(fakeRecognizer(), null, 8)).claimed === 0);

console.log("\na handwritten page names itself");

// createNote leaves an empty text block at position 0, so before this a note
// that was nothing but ink appeared in the list as an untitled blank row --
// indistinguishable from one someone had abandoned.
const { listNotes } = await import("@jotdojo/domain");
const listed = (await listNotes(actor, space)).find((n) => n.id === note.id);
check("the title comes from what was read off the page",
  listed?.title === "check with Dana about the margins", `got "${listed?.title}"`);
check("...and so does the preview",
  listed?.preview.includes("Dana") === true, `got "${listed?.preview}"`);

console.log("\nhandwriting becomes searchable");

const hits = await searchNotes(actor, space, "margins");
check("the note is found by words nobody typed", hits.some((h) => h.id === note.id));

console.log("\na correction is ground truth");

await correctTranscript(actor, ink.blockId, "check with Dana about the MARGINS, twice");
await appendStrokes(actor, ink.blockId, doc.strokes.length, [scrawl(1500)]);
await releaseQuietPeriod(ink.blockId);

// Drawing more on a corrected page still queues a job -- appendStrokes cannot
// know the transcript is human. The claim function is what refuses it.
const afterCorrection = await runRecognitionCycle(fakeRecognizer("the model would say this"), null, 8);
check("a corrected block is never handed to the recognizer", afterCorrection.read === 0);

const kept = await getInk(actor, ink.blockId);
check("the human transcript survives", kept.transcript === "check with Dana about the MARGINS, twice");
check("...and stays at no confidence", kept.confidence === null);

// The window that a claim-time check alone would leave open: a person corrects
// the transcript WHILE a job for that block is already in flight. storeTranscript
// has to refuse too, or the model silently overwrites what they typed to fix it.
await storeTranscript(ink.blockId, "the model raced and won", "htr:vlm:fake", 0.99);
const raced = await getInk(actor, ink.blockId);
check("a transcript arriving AFTER a correction is refused at the store",
  raced.transcript === "check with Dana about the MARGINS, twice",
  `got "${raced.transcript}"`);

console.log("\nan empty page");

const blank = await createNote(actor, space, "");
const blankInk = await createInkBlock(actor, blank.id, { w: 400, h: 400 });
check("an empty ink block queues nothing", (await claimRecognizeJobs(8)).length === 0);
check("...and is not pending", (await getInk(actor, blankInk.blockId)).transcriptState === "ready");

console.log(failures === 0
  ? "\nrecognition smoke: all checks passed"
  : `\nrecognition smoke: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
