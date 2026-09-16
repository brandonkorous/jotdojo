/**
 * Stickers, over real SQL. ADR-115.
 *
 * Four things would be silently wrong, in the order they matter:
 *
 *   1. A STICKER IS ONLY WORTH STORING IF IT BECOMES WORDS. A page marked with
 *      three fires means something to a person and nothing to an agent unless
 *      the companion block says so, and "which notes did I flag" is the whole
 *      return on the feature.
 *   2. AN UNKNOWN NAME IS REFUSED, NEVER STORED. A page holding a name this
 *      build has no art for would draw a hole for ever, and the page is not
 *      ours to repair afterwards.
 *   3. A STICKER IS A THING ON THE PAGE, so an arrow may tie to one -- and
 *      must die with it, exactly as it does with a box (ADR-108).
 *   4. A DELTA ABOUT ONE KIND LEAVES THE OTHERS ALONE. A fifth array is a
 *      fifth chance to wipe a page by saying nothing about it.
 */
import {
  upsertUserFromGoogle, asUser, createNote, defaultSpaceId, getNote,
  createInkBlock, getInk, appendStrokes, applyInkDelta, searchNotes, hasInk,
  validateStickers, flattenStickers, stickerNames, isStickerName,
  STICKER_NAMES, STICKER_GROUPS, MAX_STICKERS,
  type Link, type Point, type Sticker, type Stroke, type TextBox,
} from "../src/index";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const threw = (fn: () => unknown): string => {
  try { fn(); return "nothing was thrown"; } catch (e) { return (e as Error).message; }
};

const box = (id: string, text: string, x = 0): TextBox =>
  ({ id, x, y: 0, w: 200, size: 16, color: "#1F2933", text });

const point = (x: number, y: number): Point => [x, y, 0, 0.5, 0, 0];
const stroke = (id: string): Stroke =>
  ({ id, tool: "pen", color: "#1F2933", width: 3, pts: [point(10, 10), point(60, 60)] });

const mark = (id: string, name = "fire", x = 0): Sticker =>
  ({ id, name: name as Sticker["name"], x, y: 200, size: 48, color: "#A2593B" });

const arrow = (id: string, from: string, to: string): Link =>
  ({ id, from: { id: from, x: 100, y: 10 }, to: { id: to, x: 500, y: 10 },
    color: "#1F2933", width: 2.2, head: "end" });

console.log("\nthe list itself");
{
  check("there are stickers to offer", STICKER_NAMES.length >= 60, String(STICKER_NAMES.length));
  check("every name is unique", new Set(STICKER_NAMES).size === STICKER_NAMES.length);
  check("the groups add up to the list",
    Object.values(STICKER_GROUPS).flat().length === STICKER_NAMES.length);
  check("a name on the list is known", isStickerName("fire"));
  check("...and one that is not, is not", !isStickerName("unicorn"));
}

console.log("\nwhat a client may send");
{
  const ok = validateStickers([mark("k1")]);
  check("a good sticker is accepted", ok.length === 1 && ok[0]!.name === "fire");
  check("an id is minted when none is given",
    validateStickers([{ ...mark("x"), id: undefined }])[0]!.id.length > 0);

  // (2) The refusal that matters most.
  check("an unknown name is REFUSED, not stored",
    threw(() => validateStickers([{ ...mark("k2"), name: "unicorn" }])).includes("unknown sticker"));
  check("a colour that is not #rrggbb is refused",
    threw(() => validateStickers([{ ...mark("k3"), color: "red" }])).includes("color"));
  check("a size of zero is refused",
    threw(() => validateStickers([{ ...mark("k4"), size: 0 }])).includes("implausible"));
  check("a size beyond a page is refused",
    threw(() => validateStickers([{ ...mark("k5"), size: 1e9 }])).includes("implausible"));
  check("a coordinate that is not a number is refused",
    threw(() => validateStickers([{ ...mark("k6"), x: Number.NaN }])).includes("finite"));
  check("something that is not an array is refused",
    threw(() => validateStickers({} as unknown)).includes("must be an array"));
  check("more than a page full is refused",
    threw(() => validateStickers(
      Array.from({ length: MAX_STICKERS + 1 }, (_, i) => mark(`m${i}`)),
    )).includes("too many"));
}

console.log("\nstickers as words");
{
  check("none says nothing at all", flattenStickers([]) === "");
  const one = flattenStickers([mark("a")]);
  check("one is counted singly", one.includes("1 sticker on the page"), one);
  const many = flattenStickers([mark("a"), mark("b"), mark("c", "star")]);
  check("repeats are tallied rather than listed", many.includes("fire x2"), many);
  check("...and the other one is named too", many.includes("star"), many);
  check("it says they are stickers, not something somebody typed",
    many.startsWith("_["), many);

  const names = stickerNames([mark("a")]);
  check("a sticker has a name an arrow can use", names.get("a") === "fire sticker");
}

const stamp = Date.now();
const user = await upsertUserFromGoogle({
  googleSub: `st-${stamp}`, email: `st-${stamp}@example.test`, displayName: "Stevie",
});
const A = asUser(user.id);
const spaceId = await defaultSpaceId(A);

const note = await createNote(A, spaceId, "Kitchen plans");
const ink = await createInkBlock(A, note.id, { w: 800, h: 600 });
await appendStrokes(A, ink.blockId, 0, [stroke("s1")]);
await applyInkDelta(A, ink.blockId, {
  remove: [], upsert: [], texts: [box("t1", "Worktop"), box("t2", "Splashback", 400)],
});

console.log("\na sticker lands on the page beside everything else");
{
  await applyInkDelta(A, ink.blockId, {
    remove: [], upsert: [], stickers: [mark("k1"), mark("k2", "star", 300)],
  });
  const { document } = await getInk(A, ink.blockId);
  check("the stickers are stored", document.stickers?.length === 2,
    JSON.stringify(document.stickers));
  check("...in their own array", !JSON.stringify(document.strokes).includes("k1"));
  // (4) The fifth chance to wipe a page.
  check("...and the boxes are untouched", document.texts?.length === 2);
  check("...and so are the strokes", document.strokes.length === 1);
  check("a sticker remembers which picture it is",
    document.stickers?.[0]?.name === "fire" && document.stickers?.[1]?.name === "star");
}

console.log("\n(1) a sticker becomes words an agent can read");
{
  const detail = await getNote(A, note.id);
  const companion = detail.blocks?.find((b) => b.kind === "text" && b.body?.includes("Worktop"));
  check("the companion row exists", companion !== undefined);
  check("it says what is stuck on the page",
    companion?.body?.includes("fire") ?? false, companion?.body ?? "");
  check("...and says they are stickers rather than typed words",
    companion?.body?.includes("stickers on the page") ?? false, companion?.body ?? "");
  check("the boxes' own words are still there",
    companion?.body?.includes("Splashback") ?? false);
}

console.log("\n...so a marked page is findable");
{
  const hits = await searchNotes(A, spaceId, "fire");
  check("lexical search reaches it", hits.some((h) => h.id === note.id), `${hits.length} hits`);
}

console.log("\n(3) an arrow may tie to a sticker, and dies with it");
{
  await applyInkDelta(A, ink.blockId, {
    remove: [], upsert: [], links: [arrow("l1", "k1", "t1")],
  });
  const withArrow = await getNote(A, note.id);
  const body = withArrow.blocks?.find((b) => b.kind === "text" && b.body?.includes("Worktop"))?.body;
  check("the arrow reads back naming the sticker",
    body?.includes("fire sticker -> Worktop") ?? false, body ?? "");

  // The delta says nothing about links. The arrow goes anyway, because one of
  // its ends did. ADR-108's rule, applied to a kind it predates.
  await applyInkDelta(A, ink.blockId, { remove: ["k1"], upsert: [] });
  const { document } = await getInk(A, ink.blockId);
  check("the sticker is gone", document.stickers?.map((s) => s.id).join(",") === "k2",
    JSON.stringify(document.stickers?.map((s) => s.id)));
  check("...and the arrow went with it", (document.links ?? []).length === 0,
    JSON.stringify(document.links));
  check("...and the box it pointed at is still there",
    document.texts?.some((t) => t.id === "t1") ?? false);
}

console.log("\na delta about one kind leaves the stickers alone");
{
  await applyInkDelta(A, ink.blockId, { remove: [], upsert: [stroke("s2")] });
  const { document } = await getInk(A, ink.blockId);
  check("a stroke-only delta keeps the stickers", document.stickers?.length === 1,
    JSON.stringify(document.stickers));
  await applyInkDelta(A, ink.blockId, { remove: [], upsert: [], texts: [box("t1", "Worktop")] });
  const after = await getInk(A, ink.blockId);
  check("a text-only delta keeps them too", after.document.stickers?.length === 1);
}

console.log("\nmoving one is an upsert, not a new sticker");
{
  await applyInkDelta(A, ink.blockId, {
    remove: [], upsert: [], stickers: [{ ...mark("k2", "star", 300), y: 900 }],
  });
  const { document } = await getInk(A, ink.blockId);
  check("there is still one sticker", document.stickers?.length === 1);
  check("...and it moved", document.stickers?.[0]?.y === 900, JSON.stringify(document.stickers));
}

console.log("\na page that is nothing but a sticker still has something on it");
{
  const bare = await createNote(A, spaceId, "Just a flag");
  const layer = await createInkBlock(A, bare.id, { w: 800, h: 600 });
  await applyInkDelta(A, layer.blockId, { remove: [], upsert: [], stickers: [mark("k9", "flag")] });
  check("hasInk says yes", await hasInk(A, bare.id));
}

console.log(failures === 0
  ? "\nstickers smoke: all checks passed"
  : `\nstickers smoke: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
