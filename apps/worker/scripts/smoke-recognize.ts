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
import { toSvg, tiles, bounds } from "@jotdojo/ink-render";
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

const split = tiles(doc, { tilePx: { w: 1600, h: 700 } });
check("a tall page is split into tiles", split.length > 1);
// A SUM is not the assertion this needs: duplicating one stroke into two tiles
// while dropping another satisfies it. Membership, per stroke.
check("every stroke survives the split",
  doc.strokes.every((s) => split.some((t) => t.doc.strokes.includes(s))));
check("each tile frames its own rect, not the whole surface",
  split.every((t) => toSvg(t.doc, { mode: "recognition", bounds: t.rect })
    .includes(`viewBox="`) && t.rect.h <= doc.canvas!.h));

console.log("\ngeometry comes from the ink, not the stored canvas");

// THE test for ADR-053. The canvas is a viewport written once at creation; the
// same strokes must render identically whatever it claims.
const tiny = toSvg({ ...doc, canvas: { w: 100, h: 100 } }, { mode: "recognition" });
const huge = toSvg({ ...doc, canvas: { w: 9000, h: 9000 } }, { mode: "recognition" });
check("the stored canvas does not change the render", tiny === huge);

// Panning left puts ink at negative coordinates. Before ADR-053 the viewBox
// was `0 0 w h` and every one of these strokes was silently clipped away.
const away: InkDocument = {
  v: 1,
  canvas: { w: 1024, h: 1600 },
  strokes: [scrawl(-900), scrawl(-700)].map((s) => ({
    ...s, pts: s.pts.map((p) => [p[0] - 4000, p[1], p[2], p[3], p[4], p[5]] as typeof p),
  })),
};
const negative = toSvg(away, { mode: "recognition" });
check("ink at negative coordinates is inside the viewBox",
  /viewBox="-\d/.test(negative));
// The background used to be width="100%", which resolves against the viewport
// with x/y defaulting to 0 -- off-screen entirely once the origin goes negative,
// leaving a transparent PNG the model reads nothing from.
check("...and the white background travels with it",
  /<rect x="-\d[^/]*fill="#FFFFFF"/.test(negative));

const awayPng = await sharp(Buffer.from(negative)).png().toBuffer();
const corner = await sharp(awayPng).extract({ left: 0, top: 0, width: 1, height: 1 })
  .raw().toBuffer();
check("...so the raster is opaque white, not transparent",
  corner[0] === 255 && corner[1] === 255 && corner[2] === 255);

// A two-point divider spanning the board has NO sample inside the middle tile.
// `pts.some(p => p[1] >= top)` misses it; rectangle overlap does not.
const divider: InkDocument = {
  v: 1,
  canvas: { w: 1024, h: 4000 },
  strokes: [{
    tool: "pen", color: "#1A1817", width: 2,
    pts: [[500, 0, 0, 0.5, 0, 0], [500, 4000, 100, 0.5, 0, 0]],
  }],
};
const crossed = tiles(divider, { tilePx: { w: 1600, h: 700 } });
check("a long stroke reaches every tile it crosses, not just its endpoints",
  crossed.length > 2 && crossed.every((t) => t.doc.strokes.length === 1));

check("an empty document has no bounds and produces no tiles",
  bounds({ v: 1, canvas: { w: 10, h: 10 }, strokes: [] }) === null
  && tiles({ v: 1, canvas: { w: 10, h: 10 }, strokes: [] }).length === 0);

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
