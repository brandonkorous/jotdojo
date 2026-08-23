/**
 * Reading a page for what is DRAWN on it. ADR-066.
 *
 * The pipeline, end to end against a real database: strokes land, a structural
 * job is queued behind the transcript's, the worker claims it, a (fake) model
 * answers, and the result is stored somewhere a transcript cannot destroy.
 *
 * The last of those is the point. `blocks` has ONE transcript slot and
 * `app_store_transcript` overwrites it wholesale, so structure kept there would
 * be wiped by the next re-read of the same page -- and re-reading is something
 * this product does deliberately (ADR-046). The check below re-reads on
 * purpose and then looks.
 */
import {
  upsertUserFromGoogle, asUser, createNote, defaultSpaceId,
  createInkBlock, appendStrokes, storeTranscript, getStructure,
  enqueueStructureNow, meteredKinds,
  type Point, type Stroke,
} from "@jotdojo/domain";
import { fakeRecognizer, parseStructure, readStructure, RecognitionError } from "@jotdojo/vision";
import { runStructureCycle } from "../src/structure";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

console.log("\nwhat a model is allowed to send back");
{
  const good = parseStructure('{"shapes":[{"kind":"rectangle","bounds":{"x":0,"y":0,"w":10,"h":5}}],"confidence":0.9}');
  check("a clean answer parses", good.shapes.length === 1 && good.confidence === 0.9);
  check("...through a code fence too",
    parseStructure('```json\n{"shapes":[],"confidence":1}\n```').shapes.length === 0);

  // An empty array is a CORRECT and common answer: most pages are prose.
  check("no diagram is a valid answer", parseStructure('{"shapes":[],"confidence":1}').confidence === 1);

  // A malformed entry is dropped, not fatal. One bad box must not cost
  // somebody the reading of their whole diagram.
  const mixed = parseStructure(
    '{"shapes":[{"kind":"circle","bounds":{"x":1,"y":1,"w":4,"h":4}},'
    + '{"kind":"circle"},{"kind":"box","bounds":{"x":0,"y":0,"w":0,"h":9}}],"confidence":0.4}');
  check("a malformed shape is dropped, not fatal", mixed.shapes.length === 1,
    JSON.stringify(mixed.shapes));

  // An unknown kind is carried as `other` rather than dropped -- the bounds
  // still say where something is, which is most of the value.
  const odd = parseStructure('{"shapes":[{"kind":"hexagon","bounds":{"x":0,"y":0,"w":3,"h":3}}],"confidence":0.5}');
  check("an unknown kind becomes `other`", odd.shapes[0]?.kind === "other", JSON.stringify(odd));

  for (const [label, bad] of [
    ["prose with no JSON", "I could not see a diagram."],
    ["JSON with no shapes array", '{"confidence":1}'],
  ] as const) {
    let threw = false;
    try { parseStructure(bad); } catch (e) { threw = e instanceof RecognitionError; }
    check(`${label} is refused`, threw);
  }

  check("an absurd confidence becomes 0.5, not a lie",
    parseStructure('{"shapes":[],"confidence":"very"}').confidence === 0.5);
}

console.log("\nthe connections, which are the whole point");
{
  const linked = parseStructure(
    '{"shapes":[{"kind":"rectangle","bounds":{"x":0,"y":0,"w":9,"h":9}},'
    + '{"kind":"rectangle","bounds":{"x":40,"y":0,"w":9,"h":9}},'
    + '{"kind":"arrow","bounds":{"x":10,"y":4,"w":29,"h":1},"from":0,"to":1,"label":"then"}],'
    + '"confidence":0.8}');
  const arrow = linked.shapes[2];
  check("an arrow says what it joins", arrow?.from === 0 && arrow?.to === 1, JSON.stringify(arrow));
  check("...and carries its label", arrow?.label === "then");
}

const stamp = Date.now();
const user = await upsertUserFromGoogle({
  googleSub: `st-${stamp}`, email: `st-${stamp}@example.test`, displayName: "Sky",
});
const A = asUser(user.id);
const spaceId = await defaultSpaceId(A);
const note = await createNote(A, spaceId, "A diagram");
const ink = await createInkBlock(A, note.id, { w: 800, h: 600 });

const point = (x: number, y: number): Point => [x, y, 0, 0.5, 0, 0];
await appendStrokes(A, ink.blockId, 0, [{
  id: "s1", tool: "pen", color: "#1F2933", width: 3,
  pts: [point(10, 10), point(200, 10), point(200, 120), point(10, 120), point(10, 10)],
} satisfies Stroke]);

/** Drawing queues the job 45s out, which a suite is not going to wait for.
 *  Coalesced onto the pending one rather than making a second. */
const makeDue = () => enqueueStructureNow(ink.blockId);

/**
 * Drain until THIS block has been read, or give up.
 *
 * One cycle is not enough and never was. The queue is shared, so a previous run
 * of this suite -- or anything else that drew -- leaves jobs in front of ours,
 * and `runStructureCycle` claims in `available_at` order. The first version
 * called it once, passed while the queue happened to be empty, and started
 * failing the moment it was not: a test that depends on nobody having gone
 * first is a test that fails for a reason it does not name.
 *
 * The worker loops too. This is the same loop with a bound on it.
 */
const drainFor = async (blockId: string, recognizer: Parameters<typeof runStructureCycle>[0]) => {
  for (let i = 0; i < 25; i++) {
    if (await getStructure(A, blockId)) return i;
    if ((await runStructureCycle(recognizer, 8)).claimed === 0) break;
  }
  return -1;
};

console.log("\nthe pipeline");
{
  await makeDue();
  const rounds = await drainFor(ink.blockId, fakeRecognizer("the box"));
  check("drawing queued a structural read, and the worker got to it",
    rounds >= 0, `gave up after 25 cycles with the queue still non-empty`);

  const found = await getStructure(A, ink.blockId);
  check("the result is stored", found !== null);
  check("...with shapes on it", (found?.shapes.length ?? 0) > 0, JSON.stringify(found?.shapes));
  // Its OWN staleness key, in its own column. 0026 explains at length why
  // suffixing transcript_source would re-bill the entire corpus.
  check("...under its own source key", found?.source.startsWith("struct:vlm:") ?? false,
    String(found?.source));
  check("...which is NOT the transcript's", !(found?.source.startsWith("htr:") ?? true));
}

console.log("\na transcript cannot destroy it");
{
  // The reason this is a table and not a jsonb column on `blocks`.
  await storeTranscript(ink.blockId, "re-read later by a better model", "htr:vlm:m/r2", 0.9, 1);
  const after = await getStructure(A, ink.blockId);
  check("the structure survives a re-read of the same page",
    (after?.shapes.length ?? 0) > 0, JSON.stringify(after));
}

console.log("\nmetered as itself");
{
  const spent = await meteredKinds(A, ink.blockId);
  // 'structure', not 'ink'. Without the distinction one page read twice looks
  // like two pages, and the allowance in docs/01 is counted in pages.
  check("a structural pass is metered as structure", (spent.structure ?? 0) > 0,
    JSON.stringify(spent));
  check("...and not as another page of ink", (spent.ink ?? 0) <= 1, JSON.stringify(spent));
}

console.log("\nnobody else's diagram");
{
  const other = await upsertUserFromGoogle({
    googleSub: `st-b-${stamp}`, email: `stb-${stamp}@example.test`, displayName: "Bo",
  });
  let refused = false;
  try {
    await getStructure(asUser(other.id), ink.blockId);
  } catch {
    refused = true;
  }
  // RLS returns nothing for a stranger, which reads as "never looked at" --
  // the same answer as a page with no structure. Either is safe; neither
  // leaks. The check is that nothing comes BACK.
  const leaked = refused ? null : await getStructure(asUser(other.id), ink.blockId);
  check("a stranger gets nothing", refused || leaked === null, JSON.stringify(leaked));
}

console.log("\nan empty page is still an answer");
{
  const blankNote = await createNote(A, spaceId, "nothing drawn");
  const blank = await createInkBlock(A, blankNote.id, { w: 800, h: 600 });
  await enqueueStructureNow(blank.blockId);
  await drainFor(blank.blockId, fakeRecognizer());
  const found = await getStructure(A, blank.blockId);
  // "Looked, no diagram" and "never looked" are different facts, and a reader
  // that conflates them reports a blank page as a considered answer. ADR-056
  // draws the same distinction for coverage.
  check("a page with no ink is recorded as looked-at-and-empty",
    found !== null && found.shapes.length === 0, JSON.stringify(found));
}

console.log("\nno provider, no pretending");
{
  const none = await runStructureCycle(null, 4);
  check("nothing is claimed when no model can answer", none.claimed === 0);
}

console.log("\nreadStructure asks the right question");
{
  // fakeRecognizer keys on the word SHAPES, which is how a suite can prove the
  // structural prompt was the one sent without standing a model up.
  const asked = await readStructure(fakeRecognizer("labelled"), [{
    mediaType: "image/png", base64: "AA==",
  }]);
  check("the structural prompt was used", asked.shapes[0]?.label === "labelled",
    JSON.stringify(asked));
  check("no pages is no call", (await readStructure(fakeRecognizer(), [])).shapes.length === 0);
}

console.log(failures === 0 ? "\nstructure: all good\n" : `\nstructure: ${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
