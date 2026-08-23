/**
 * Partial readings are recorded as partial. M5, ADR-056.
 *
 * MAX_TILES caps one surface at 32 images, and a whiteboard photographed at
 * arm's length can exceed that. Before this, the worker logged a warning and
 * stored the partial reading as an ordinary transcript -- nothing in the row
 * was false, it was merely incomplete, which is worse, because incompleteness
 * is invisible and a bad transcript is not.
 *
 * The rendering side of this lives in the mcp package's smoke-render.ts. This
 * is the storage side: what actually lands in the column, and the one thing a
 * partial reading is forbidden to do.
 */
import {
  upsertUserFromGoogle, asUser, createNote, defaultSpaceId,
  createInkBlock, appendStrokes, storeTranscript, correctTranscript, getNote,
  type Stroke,
} from "@jotacular/domain";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const stamp = Date.now();
const user = await upsertUserFromGoogle({
  googleSub: `partial-${stamp}`, email: `p-${stamp}@example.test`, displayName: "Partial",
});
const actor = asUser(user.id);
const space = await defaultSpaceId(actor);

/** Counted rather than random, so a failing run names the same stroke twice. */
let strokeNo = 0;
const nextId = () => `stroke-${++strokeNo}`;

const scribble = (): Stroke => ({
  id: nextId(),
  tool: "pen", color: "#1A1817", width: 2,
  pts: [[0, 0, 0, 0.5, 0, 0], [40, 30, 8, 0.5, 0, 0], [80, 10, 16, 0.5, 0, 0]],
});

/** A fresh untitled note with one ink block on it. */
async function page() {
  const note = await createNote(actor, space, "");
  const ink = await createInkBlock(actor, note.id, { w: 800, h: 600 });
  await appendStrokes(actor, ink.blockId, 0, [scribble()]);
  return { noteId: note.id, blockId: ink.blockId };
}

const coverageOf = async (noteId: string, blockId: string) =>
  (await getNote(actor, noteId)).blocks?.find((b) => b.id === blockId)?.transcriptCoverage;

console.log("\na reading that covered the whole surface");
{
  const p = await page();
  await storeTranscript(p.blockId, "Thursday: call the roofer", "htr:vlm:m/r2", 0.9, 1);
  check("coverage is stored as whole", (await coverageOf(p.noteId, p.blockId)) === 1);
  check("and it may name the note",
    (await getNote(actor, p.noteId)).title === "Thursday: call the roofer",
    String((await getNote(actor, p.noteId)).title));
}

console.log("\na reading that covered part of it");
{
  const p = await page();
  await storeTranscript(p.blockId, "Thursday: call the roofer", "htr:vlm:m/r2", 0.9, 0.34);
  const got = await coverageOf(p.noteId, p.blockId);
  check("the fraction is stored", got !== null && got !== undefined && Math.abs(got - 0.34) < 1e-6,
    String(got));
  check("the transcript is still stored in full",
    (await getNote(actor, p.noteId)).blocks
      ?.find((b) => b.id === p.blockId)?.transcript === "Thursday: call the roofer");

  // The first line of the first tile of a board we only partly read is a guess
  // at what the board is about. A wrong title is far stickier than a wrong
  // transcript: it is what the note is called in every list and every search.
  check("but it must NOT name the note",
    !(await getNote(actor, p.noteId)).title,
    String((await getNote(actor, p.noteId)).title));
}

console.log("\nthe reading is still ready, not pending and not failed");
{
  const p = await page();
  await storeTranscript(p.blockId, "half a board", "htr:vlm:m/r2", 0.5, 0.2);
  const block = (await getNote(actor, p.noteId)).blocks?.find((b) => b.id === p.blockId);
  // Deliberately not a fifth transcript_state: a partial read IS ready.
  // Nothing should retry it, the UI should show it, search should index it.
  check("a partial read is ready", block?.transcriptState === "ready", block?.transcriptState);
  check("...and keeps its confidence", block?.confidence === 0.5);
}

console.log("\na person who looks at the page settles it");
{
  const p = await page();
  await storeTranscript(p.blockId, "half a board", "htr:vlm:m/r2", 0.5, 0.2);
  check("partial to begin with", (await coverageOf(p.noteId, p.blockId)) !== null);

  await correctTranscript(actor, p.blockId, "the whole board, actually");
  // They have looked at it and typed what it says. Leaving a machine's
  // coverage figure behind would keep flagging their answer as incomplete.
  check("correcting it clears the coverage",
    (await coverageOf(p.noteId, p.blockId)) === null,
    String(await coverageOf(p.noteId, p.blockId)));
  check("...and their words are what is stored",
    (await getNote(actor, p.noteId)).blocks
      ?.find((b) => b.id === p.blockId)?.transcript === "the whole board, actually");
}

console.log("\nthe existing corpus is unmeasured, not whole");
{
  const p = await page();
  // Nothing has read it yet, so nobody has measured it. NULL and 1 are
  // different claims and the difference is the point.
  check("an unread block has no coverage", (await coverageOf(p.noteId, p.blockId)) === null);
}

console.log(failures === 0
  ? "\npartial readings: all checks passed"
  : `\npartial readings: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
