/**
 * Photographs as objects on the plane, through the database. ADR-103.
 *
 * smoke-canvas.ts proves the same claims for typed text and this is its
 * sibling, because the things that would be silently wrong are the same three
 * and the third array is the one nobody has looked at yet:
 *
 *   1. A DELETE SPANS EVERY KIND. One lasso holds strokes, boxes and pictures,
 *      so a delta that removes must reach all three arrays or part of a
 *      selection survives the delete somebody watched happen.
 *   2. A DELTA THAT SAYS NOTHING ABOUT A KIND MUST NOT WIPE IT. A plain erase
 *      names strokes; it must not take the photographs with it.
 *   3. MOVING A PICTURE IS FOUR NUMBERS. It must never resend the bytes, and
 *      the block that owns them must be untouched by it.
 */
import {
  upsertUserFromGoogle, asUser, createNote, defaultSpaceId,
  createInkBlock, getInk, appendStrokes, applyInkDelta,
  createMediaBlock, finalizeMedia, noteImages,
  type ImageOnPage, type Stroke,
} from "../src/index";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const stamp = Date.now();
const alice = await upsertUserFromGoogle({
  googleSub: `img-${stamp}`, email: `img-${stamp}@example.test`, displayName: "Ida",
});
const A = await asUser(alice.id);
const space = await defaultSpaceId(A);

const pic = (over: Partial<ImageOnPage> = {}): ImageOnPage => ({
  id: "i1", blockId: "block-1", x: 100, y: 100, w: 200, h: 150, ...over,
});

const strokeAt = (x: number): Stroke => ({
  id: `s-${x}`, tool: "pen", color: "#1F2933", width: 2,
  pts: [[x, 10, 0, 0.5, 0, 0], [x + 10, 20, 8, 0.5, 0, 0]],
});

const note = await createNote(A, space, "a page with a photograph on it");
const ink = await createInkBlock(A, note.id, { w: 800, h: 600 });
await appendStrokes(A, ink.blockId, 0, [strokeAt(10), strokeAt(40)]);

console.log("\na photograph lands on the page");
{
  await applyInkDelta(A, ink.blockId, { remove: [], upsert: [], images: [pic()] });
  const page = await getInk(A, ink.blockId);
  const images = page.document.images ?? [];
  check("it is on the page", images.length === 1, JSON.stringify(images));
  check("it knows which block holds the bytes", images[0]?.blockId === "block-1");
  check("and where it sits", images[0]?.x === 100 && images[0]?.w === 200);
  check("the strokes are untouched", page.document.strokes.length === 2);
  // A picture is not something to recognise, and keeping the arrays apart is
  // what makes that impossible rather than merely unlikely. ADR-065.
  check("nothing leaked into the strokes",
    page.document.strokes.every((s) => "pts" in s));
}

console.log("\nmoving one is four numbers, not a re-upload");
{
  const before = await getInk(A, ink.blockId);
  await applyInkDelta(A, ink.blockId, {
    remove: [], upsert: [], images: [pic({ x: 500, y: 320 })],
  });
  const page = await getInk(A, ink.blockId);
  check("it moved", page.document.images?.[0]?.x === 500);
  check("there is still exactly one", (page.document.images ?? []).length === 1);
  check("the version moved", page.version > before.version);
  check("the stroke count did not", page.strokeCount === before.strokeCount);
}

console.log("\na delta that says nothing about pictures must not wipe them");
{
  // The plain-erase path. `remove` spans every kind, so the guard being tested
  // is that an ABSENT `images` means "said nothing", not "there are none".
  await applyInkDelta(A, ink.blockId, { remove: ["s-10"], upsert: [] });
  const page = await getInk(A, ink.blockId);
  check("the stroke went", page.document.strokes.length === 1);
  check("the photograph stayed", (page.document.images ?? []).length === 1);
}

console.log("\none lasso, one delta, every kind");
{
  await applyInkDelta(A, ink.blockId, {
    remove: [], upsert: [], images: [pic({ x: 500, y: 320 }), pic({ id: "i2", x: 20, y: 20 })],
  });
  const two = await getInk(A, ink.blockId);
  check("both are on the page", (two.document.images ?? []).length === 2);

  // The claim: deleting a mixed selection cannot leave half of it behind.
  await applyInkDelta(A, ink.blockId, { remove: ["s-40", "i1"], upsert: [] });
  const page = await getInk(A, ink.blockId);
  check("the stroke went", page.document.strokes.length === 0);
  check("the named picture went", (page.document.images ?? []).length === 1);
  check("...and the other one did not", page.document.images?.[0]?.id === "i2");
}

console.log("\nwhat the page refuses");
{
  const bad = async (images: unknown[]): Promise<boolean> => {
    try {
      await applyInkDelta(A, ink.blockId, { remove: [], upsert: [], images: images as ImageOnPage[] });
      return false;
    } catch { return true; }
  };
  // A placement with no block behind it is a hole nothing can ever fill in.
  check("a placement with no block", await bad([{ x: 0, y: 0, w: 1, h: 1 }]));
  check("a placement with no size", await bad([{ blockId: "b", x: 0, y: 0, w: 0, h: 1 }]));
  const page = await getInk(A, ink.blockId);
  check("and none of it reached the page", (page.document.images ?? []).length === 1);
}

console.log("\nonly photographs that actually arrived");
{
  // Asking for an upload slot writes the block and the asset row before a
  // single byte is sent. A capture that failed on the wire leaves one behind
  // with no photograph in it, and adopting those put empty rectangles on the
  // page -- seen in a browser, on this very path. ADR-103.
  const shelf = await createNote(A, space, "a note with a failed capture on it");
  const dead = await createMediaBlock(A, shelf.id, "image", "image/png");
  const none = await noteImages(A, shelf.id);
  check("a slot with no bytes is not offered", none.length === 0, `blockId ${dead.blockId}`);

  const live = await createMediaBlock(A, shelf.id, "image", "image/png");
  await finalizeMedia(A, live.blockId, { byteSize: 1234, width: 240, height: 160 });
  const known = await noteImages(A, shelf.id);
  check("a finalized one is", known.length === 1);
  check("...and it carries the size it actually is",
    known[0]?.width === 240 && known[0]?.height === 160);
  check("...and it is the finalized block, not the dead one",
    known[0]?.blockId === live.blockId);
}

console.log(failures === 0 ? "\nink images smoke: all checks passed" : `\nink images smoke: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
