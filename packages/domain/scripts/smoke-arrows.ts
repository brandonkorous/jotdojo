/**
 * Arrows, over real SQL. ADR-108.
 *
 * Three things would be silently wrong, in the order they matter:
 *
 *   1. AN ARROW IS ONLY WORTH STORING IF IT BECOMES WORDS. Two cards with a
 *      line between them mean something to a person and nothing at all to an
 *      agent, and `Deposit -> Survey` in the companion block is the whole
 *      return on the feature. If that row is not written, this is decoration.
 *   2. AN ARROW DIES WITH EITHER END. It is the one place a page disagrees
 *      with a comment (ADR-107), and it has to hold when the delta that
 *      deleted the card never mentioned the arrow.
 *   3. A DELTA ABOUT ONE KIND LEAVES THE OTHERS ALONE. A fourth array is a
 *      fourth chance to wipe a page by saying nothing about it.
 */
import {
  upsertUserFromGoogle, asUser, createNote, defaultSpaceId, getNote,
  createInkBlock, getInk, appendStrokes, applyInkDelta, searchNotes, findInkBlock,
  type Link, type Point, type Stroke, type TextBox,
} from "../src/index";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const box = (id: string, text: string, x = 0): TextBox =>
  ({ id, x, y: 0, w: 200, size: 16, color: "#1F2933", text });

const point = (x: number, y: number): Point => [x, y, 0, 0.5, 0, 0];
const stroke = (id: string): Stroke =>
  ({ id, tool: "pen", color: "#1F2933", width: 3, pts: [point(10, 10), point(60, 60)] });

const arrow = (id: string, from: string, to: string): Link =>
  ({ id, from: { id: from, x: 100, y: 10 }, to: { id: to, x: 500, y: 10 },
    color: "#1F2933", width: 2.2, head: "end" });

const stamp = Date.now();
const user = await upsertUserFromGoogle({
  googleSub: `ar-${stamp}`, email: `ar-${stamp}@example.test`, displayName: "Ari",
});
const A = asUser(user.id);
const spaceId = await defaultSpaceId(A);

const note = await createNote(A, spaceId, "Buying a flat");
const ink = await createInkBlock(A, note.id, { w: 800, h: 600 });
await appendStrokes(A, ink.blockId, 0, [stroke("s1")]);
await applyInkDelta(A, ink.blockId, {
  remove: [], upsert: [],
  texts: [box("t1", "Deposit"), box("t2", "Survey", 400), box("t3", "Offer", 800)],
});

console.log("\nan arrow lands on the page beside everything else");
{
  await applyInkDelta(A, ink.blockId, {
    remove: [], upsert: [], links: [arrow("l1", "t1", "t2")],
  });
  const { document } = await getInk(A, ink.blockId);
  check("the arrow is stored", document.links?.length === 1, JSON.stringify(document.links));
  check("...in its own array", !JSON.stringify(document.strokes).includes("l1"));
  check("...and the boxes are untouched", document.texts?.length === 3);
  check("...and so are the strokes", document.strokes.length === 1);
  check("it remembers what it ties",
    document.links?.[0]?.from.id === "t1" && document.links?.[0]?.to.id === "t2");
}

console.log("\n(1) an arrow becomes a sentence an agent can read");
{
  await applyInkDelta(A, ink.blockId, {
    remove: [], upsert: [], links: [arrow("l1", "t1", "t2"), arrow("l2", "t2", "t3")],
  });
  const detail = await getNote(A, note.id);
  const companion = detail.blocks?.find((b) => b.kind === "text" && b.body?.includes("Deposit"));
  check("the companion row exists", companion !== undefined,
    detail.blocks?.map((b) => `${b.kind}@${b.position}`).join(", "));
  check("it says one thing points at another",
    companion?.body?.includes("Deposit -> Survey") ?? false, companion?.body ?? "");
  check("...and the second arrow too",
    companion?.body?.includes("Survey -> Offer") ?? false, companion?.body ?? "");
  check("it says the arrows were drawn rather than typed",
    companion?.body?.includes("arrows drawn on the page") ?? false, companion?.body ?? "");
  check("the boxes' own words are still there",
    companion?.body?.includes("Offer") ?? false);
}

console.log("\n...so a page of arrows is findable");
{
  const hits = await searchNotes(A, spaceId, "Survey");
  check("lexical search reaches it", hits.some((h) => h.id === note.id), `${hits.length} hits`);
}

console.log("\n(2) an arrow dies with either of the things it ties");
{
  // The delta says nothing about links. The arrow goes anyway, because one of
  // its ends did -- and BOTH arrows touching t2 have to go, not just one.
  await applyInkDelta(A, ink.blockId, { remove: ["t2"], upsert: [] });
  const { document } = await getInk(A, ink.blockId);
  check("the box is gone", document.texts?.map((t) => t.id).join(",") === "t1,t3",
    JSON.stringify(document.texts?.map((t) => t.id)));
  check("...and every arrow that touched it", document.links?.length === 0,
    JSON.stringify(document.links));

  const detail = await getNote(A, note.id);
  const companion = detail.blocks?.find((b) => b.kind === "text" && b.body?.includes("Offer"));
  check("the sentence goes with it",
    !(companion?.body?.includes("->") ?? false), companion?.body ?? "");
}

console.log("\n(3) a delta about one kind leaves the others alone");
{
  await applyInkDelta(A, ink.blockId, {
    remove: [], upsert: [], links: [arrow("l3", "t1", "t3")],
  });
  // A stroke-only delta must not wipe the page's arrows.
  await applyInkDelta(A, ink.blockId, { remove: [], upsert: [stroke("s2")] });
  const after = (await getInk(A, ink.blockId)).document;
  check("a stroke delta leaves the arrows", after.links?.length === 1,
    JSON.stringify(after.links));
  check("...and the boxes", after.texts?.length === 2);

  // An ARRAY THAT LEAVES SOMETHING OUT IS NOT A DELETION. Every one of these
  // four fields is an upsert by id, and going is said with `remove` -- which is
  // what lets two devices edit one page without either wiping the other.
  await applyInkDelta(A, ink.blockId, { remove: [], upsert: [], links: [] });
  const kept = (await getInk(A, ink.blockId)).document;
  check("an empty array does not delete anything", kept.links?.length === 1,
    JSON.stringify(kept.links));

  // Naming it does.
  await applyInkDelta(A, ink.blockId, { remove: ["l3"], upsert: [] });
  const bare = (await getInk(A, ink.blockId)).document;
  check("naming the arrow takes it", bare.links?.length === 0, JSON.stringify(bare.links));
  check("...without touching the boxes", bare.texts?.length === 2);
  check("...or the strokes", bare.strokes.length === 2);
}

console.log("\nan arrow counts as something being on the page");
{
  const bare = await createNote(A, spaceId, "");
  const layer = await createInkBlock(A, bare.id, { w: 800, h: 600 });
  await applyInkDelta(A, layer.blockId, {
    remove: [], upsert: [], texts: [box("b1", "one"), box("b2", "two", 400)],
  });
  await applyInkDelta(A, layer.blockId, {
    remove: [], upsert: [], links: [arrow("bl", "b1", "b2")],
  });
  // A page that is nothing but two notes and an arrow still has a page to load.
  const found = await findInkBlock(A, bare.id);
  check("the layer reports its arrows", found?.linkCount === 1, JSON.stringify(found?.linkCount));
}

console.log("\nwhat the server refuses");
{
  for (const [label, links] of [
    ["a colour that is not #rrggbb", [{ ...arrow("x", "t1", "t3"), color: "red" }]],
    ["an unknown head", [{ ...arrow("x", "t1", "t3"), head: "spike" }]],
    ["a NaN coordinate", [{ ...arrow("x", "t1", "t3"), from: { id: "t1", x: NaN, y: 0 } }]],
    ["an end that is not an object", [{ ...arrow("x", "t1", "t3"), to: "t3" }]],
  ] as const) {
    let refused = false;
    try {
      await applyInkDelta(A, ink.blockId, {
        remove: [], upsert: [], links: links as unknown as Link[],
      });
    } catch { refused = true; }
    check(`${label} is refused`, refused);
  }

  const still = (await getInk(A, ink.blockId)).document;
  check("and the page is exactly as it was", still.texts?.length === 2 && still.strokes.length === 2);
}

console.log("\nan outsider cannot draw on somebody else's page");
{
  const other = await upsertUserFromGoogle({
    googleSub: `ar2-${stamp}`, email: `ar2-${stamp}@example.test`, displayName: "Bo",
  });
  const B = asUser(other.id);
  let refused = false;
  try {
    await applyInkDelta(B, ink.blockId, {
      remove: [], upsert: [], links: [arrow("sneak", "t1", "t3")],
    });
  } catch { refused = true; }
  check("refused", refused);
  const { document } = await getInk(A, ink.blockId);
  check("...and nothing was added", document.links?.length === 0,
    JSON.stringify(document.links));
}

console.log(failures === 0 ? "\narrows: all good\n" : `\narrows: ${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
