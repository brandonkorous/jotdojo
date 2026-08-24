/**
 * Ink storage, and specifically the properties that protect a page nobody can
 * retype: eager append, idempotent retries, and a refusal to leave a hole.
 *
 * Every refusal here asserts the error CODE, not merely that something threw.
 * ADR-020: a check that cannot tell a refusal from a crash is not testing the
 * refusal.
 */
import {
  upsertUserFromGoogle, asUser, createNote, defaultSpaceId,
  createInkBlock, ensureInkBlock, findInkBlock, hasInk, getNote, appendStrokes, getInk, correctTranscript,
  type Stroke, type StrokeInput,
} from "../src/index";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

async function refused(label: string, code: string, fn: () => Promise<unknown>) {
  let got = "nothing was thrown";
  try {
    await fn();
  } catch (err) {
    got = (err as { code?: string }).code ?? `an error with no code: ${(err as Error).message}`;
  }
  check(label, got === code, `expected code "${code}", got "${got}"`);
}

const strokeAt = (n: number): StrokeInput => ({
  tool: "pen",
  color: "#1A1817",
  width: 2,
  pts: [[n, n, 0, 0.5, 0, 0], [n + 10, n + 4, 16, 0.6, 0, 0], [n + 20, n, 32, 0.4, 0, 0]],
});

const stamp = Date.now();
const alice = await upsertUserFromGoogle({
  googleSub: `ink-a-${stamp}`, email: `ia-${stamp}@example.test`, displayName: "Alice",
});
const bob = await upsertUserFromGoogle({
  googleSub: `ink-b-${stamp}`, email: `ib-${stamp}@example.test`, displayName: "Bob",
});
const A = asUser(alice.id);
const B = asUser(bob.id);
const space = await defaultSpaceId(A);
const note = await createNote(A, space, "A page with handwriting on it");

console.log("\ncreating a page");

const ink = await createInkBlock(A, note.id, { w: 1024, h: 1366 });
check("an ink block is created before a single stroke is drawn", ink.strokeCount === 0);
check("...with an artifact ready to append into", Boolean(ink.artifactId));
check("...and nothing to recognize yet", ink.transcriptState === "ready");

console.log("\neager append");

const first = await appendStrokes(A, ink.blockId, 0, [strokeAt(0), strokeAt(30)]);
check("the first batch lands", first.strokeCount === 2 && first.accepted === 2);

const second = await appendStrokes(A, ink.blockId, 2, [strokeAt(60)]);
check("the next batch continues from where it left off", second.strokeCount === 3);

const after = await getInk(A, ink.blockId);
check("all three strokes are stored", after.strokeCount === 3);
check("the points survive the round trip",
  JSON.stringify(after.document.strokes[0]!.pts) === JSON.stringify(strokeAt(0).pts));
check("the canvas size is remembered", after.canvas.w === 1024 && after.canvas.h === 1366);
check("drawing moved the block to pending recognition", after.transcriptState === "pending");

console.log("\nwhat happens when the network misbehaves");

// The response to batch 2 was lost and the client sent it again.
const replay = await appendStrokes(A, ink.blockId, 2, [strokeAt(60)]);
check("a replayed batch is accepted and NOT duplicated",
  replay.strokeCount === 3 && replay.accepted === 0);
check("...so the page still has three strokes",
  (await getInk(A, ink.blockId)).strokeCount === 3);

// A batch went missing. Silently accepting this would leave a hole in the
// middle of someone's handwriting that nothing would ever report.
await refused("a batch that skips ahead is REFUSED", "stroke_gap",
  () => appendStrokes(A, ink.blockId, 9, [strokeAt(90)]));
check("...and the page is untouched", (await getInk(A, ink.blockId)).strokeCount === 3);

const resumed = await appendStrokes(A, ink.blockId, 3, [strokeAt(90)]);
check("the client can resend from where the server actually is", resumed.strokeCount === 4);

console.log("\nwhat the client is allowed to send");

await refused("a NaN coordinate is REFUSED", "bad_strokes",
  () => appendStrokes(A, ink.blockId, 4, [{ ...strokeAt(0), pts: [[NaN, 0, 0, 1, 0, 0]] }]));
await refused("a point with the wrong arity is REFUSED", "bad_strokes",
  () => appendStrokes(A, ink.blockId, 4, [{ ...strokeAt(0), pts: [[1, 2, 3]] }]));
await refused("an unknown tool is REFUSED", "bad_strokes",
  () => appendStrokes(A, ink.blockId, 4, [{ ...strokeAt(0), tool: "chainsaw" }]));
await refused("a colour that is not #rrggbb is REFUSED", "bad_strokes",
  () => appendStrokes(A, ink.blockId, 4, [{ ...strokeAt(0), color: "red" }]));
await refused("an absurd width is REFUSED", "bad_strokes",
  () => appendStrokes(A, ink.blockId, 4, [{ ...strokeAt(0), width: 1e9 }]));
await refused("a negative seq is REFUSED", "bad_seq",
  () => appendStrokes(A, ink.blockId, -1, [strokeAt(0)]));
await refused("an implausible canvas is REFUSED", "bad_canvas",
  () => createInkBlock(A, note.id, { w: 0, h: 1366 }));
check("none of that reached the page", (await getInk(A, ink.blockId)).strokeCount === 4);

console.log("\ntenancy");

await refused("bob cannot read alice's ink", "not_found", () => getInk(B, ink.blockId));
await refused("bob cannot draw on alice's page", "not_found",
  () => appendStrokes(B, ink.blockId, 4, [strokeAt(0)]));
await refused("bob cannot start ink on alice's note", "not_found",
  () => createInkBlock(B, note.id, { w: 100, h: 100 }));
check("alice's page is unchanged", (await getInk(A, ink.blockId)).strokeCount === 4);

console.log("\nerase replaces the page");

const page = (await getInk(A, ink.blockId)).document.strokes;
const { replaceStrokes } = await import("../src/index");
const shorter = await replaceStrokes(A, ink.blockId, page.slice(0, 2));
check("erasing two strokes leaves two", shorter.strokeCount === 2);
check("...and it is the right two",
  JSON.stringify((await getInk(A, ink.blockId)).document.strokes) === JSON.stringify(page.slice(0, 2)));

await refused("bob cannot replace alice's page", "not_found",
  () => replaceStrokes(B, ink.blockId, []));
check("alice's page survived that", (await getInk(A, ink.blockId)).strokeCount === 2);

const cleared = await replaceStrokes(A, ink.blockId, []);
check("erasing everything is allowed", cleared.strokeCount === 0);

console.log("\na person correcting the machine");

await correctTranscript(A, ink.blockId, "check with Dana about the margins");
const corrected = await getInk(A, ink.blockId);
check("the correction is stored", corrected.transcript === "check with Dana about the margins");
check("confidence is cleared -- a person is not 82% sure", corrected.confidence === null);
check("the block is no longer pending", corrected.transcriptState === "ready");

console.log("\nthe note has ONE ink layer. ADR-047");
const layered = await createNote(A, space, "a page with handwriting");
const layer = await ensureInkBlock(A, layered.id, { w: 800, h: 600 });
const again = await ensureInkBlock(A, layered.id, { w: 400, h: 300 });
check("asking twice returns the SAME block", again.blockId === layer.blockId,
  `${layer.blockId} vs ${again.blockId}`);
await appendStrokes(A, layer.blockId, 0, [strokeAt(10)]);
const afterStrokes = await ensureInkBlock(A, layered.id, { w: 800, h: 600 });
check("...and it still is once something is drawn on it",
  afterStrokes.blockId === layer.blockId);
check("...with the strokes still counted", afterStrokes.strokeCount === 1,
  String(afterStrokes.strokeCount));
check("a note with no handwriting has no layer to find",
  (await findInkBlock(A, (await createNote(A, space, "typed")).id)) === null);
// The page, not the block. ADR-102 mounts the ink layer on every note, so
// "a block of kind ink exists" is true everywhere and says nothing. ADR-103.
check("hasInk says yes for a note with strokes on it",
  (await hasInk(A, layered.id)) === true);
check("...and no for a note that has none",
  (await hasInk(A, (await createNote(A, space, "x")).id)) === false);
const bare = await createNote(A, space, "bare");
await ensureInkBlock(A, bare.id, { w: 800, h: 600 });
check("...and no for a note whose layer exists but is empty",
  (await hasInk(A, bare.id)) === false);


console.log(failures === 0 ? "\nink smoke: all checks passed" : `\nink smoke: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
