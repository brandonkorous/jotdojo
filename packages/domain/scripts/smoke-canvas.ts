/**
 * Typed text as an object on the plane. ADR-065.
 *
 * The three things that would be silently wrong, in the order they matter:
 *
 *   1. THE SPINE AND THE BOXES ARE DIFFERENT TEXT. `readBody` returns what the
 *      textarea shows and what the next autosave writes back. If the boxes'
 *      flattened copy leaked into it, the next keystroke would save them into
 *      the spine as though somebody had typed them there -- the exact
 *      duplication readBody's own comment warns about, arriving by a new door.
 *   2. A DELETE SPANS BOTH KINDS. One lasso holds strokes and boxes, so a
 *      delta that removes must reach both arrays or half a selection survives.
 *
 * The third -- that the recogniser never sees typed text -- is asserted in
 * ink-render's own suite. It is a fact about the renderer, and putting it here
 * made domain depend on ink-render, which already depends on domain.
 */
import {
  upsertUserFromGoogle, asUser, createNote, defaultSpaceId, getNote,
  createInkBlock, getInk, appendStrokes, applyInkDelta, searchNotes,
  readingOrder, flattenTexts, validateTexts,
  type Point, type Stroke, type TextBox,
} from "../src/index";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const box = (over: Partial<TextBox> = {}): TextBox => ({
  id: "t1", x: 0, y: 0, w: 200, size: 16, color: "#1F2933", text: "hello", ...over,
});

const point = (x: number, y: number): Point => [x, y, 0, 0.5, 0, 0];
const stroke = (id: string): Stroke => ({
  id, tool: "pen", color: "#1F2933", width: 3,
  pts: [point(10, 10), point(60, 60)],
});

console.log("\nreading order on a surface where nothing comes first");
{
  // Two columns. Read naively by y alone they interleave into nonsense; the
  // row banding is what keeps each column together. tiles.ts solves the same
  // problem for recognition and this follows its rule.
  const left = [box({ id: "l1", x: 0, y: 0 }), box({ id: "l2", x: 0, y: 40 })];
  const right = [box({ id: "r1", x: 400, y: 5 }), box({ id: "r2", x: 400, y: 45 })];
  const order = readingOrder([...right, ...left]).map((b) => b.id);
  check("a two-column layout does not interleave",
    order.join(",") === "l1,r1,l2,r2", order.join(","));

  // 5px at size 16 is well inside one band, so a nudge must not reorder.
  const nudged = readingOrder([box({ id: "a", x: 0, y: 0 }), box({ id: "b", x: 50, y: 3 })]);
  check("a box nudged three pixels does not change places",
    nudged.map((b) => b.id).join(",") === "a,b", nudged.map((b) => b.id).join(","));

  check("the flattened text says the order was derived",
    flattenTexts(left).includes("read top to bottom"), flattenTexts(left));
  check("...and a single box says nothing of the kind",
    flattenTexts([box({ text: "just this" })]) === "just this");
}

console.log("\nwhat a text box is allowed to be");
{
  const ok = validateTexts([{ x: 1, y: 2, w: 30, size: 16, color: "#ABCDEF", text: "hi" }]);
  check("an id is minted when none is given", typeof ok[0]?.id === "string" && ok[0].id.length > 0);
  for (const [label, bad] of [
    ["a colour that is not #rrggbb", { ...box(), color: "red" }],
    ["a width of zero", { ...box(), w: 0 }],
    ["a NaN coordinate", { ...box(), x: Number.NaN }],
    ["a size nobody could read", { ...box(), size: 9_000 }],
  ] as const) {
    let refused = false;
    try { validateTexts([bad]); } catch { refused = true; }
    check(`${label} is refused`, refused);
  }
}

const stamp = Date.now();
const user = await upsertUserFromGoogle({
  googleSub: `cv-${stamp}`, email: `cv-${stamp}@example.test`, displayName: "Cy",
});
const A = asUser(user.id);
const spaceId = await defaultSpaceId(A);
const note = await createNote(A, spaceId, "The spine\n\nTyped into the textarea.");
const ink = await createInkBlock(A, note.id, { w: 800, h: 600 });
await appendStrokes(A, ink.blockId, 0, [stroke("s1")]);

console.log("\na box lands on the page beside the strokes");
{
  await applyInkDelta(A, ink.blockId, {
    remove: [], upsert: [],
    texts: [box({ id: "t1", x: 300, y: 20, text: "mooring fee, ask Dana" })],
  });

  const { document } = await getInk(A, ink.blockId);
  check("the box is stored", document.texts?.length === 1, JSON.stringify(document.texts));
  check("...and the strokes are untouched", document.strokes.length === 1);
  check("...in their own array", !JSON.stringify(document.strokes).includes("mooring fee"));
}

console.log("\nthe spine and the boxes stay separate");
{
  const detail = await getNote(A, note.id);
  // (1). If this fails, the next autosave writes the boxes into the spine.
  check("readBody returns the spine ONLY",
    detail.body.includes("Typed into the textarea") && !detail.body.includes("mooring fee"),
    detail.body);

  // ...and the companion row still exists, or none of this is findable.
  const companion = detail.blocks?.filter((b) => b.kind === "text");
  check("there are two text blocks now", companion?.length === 2,
    detail.blocks?.map((b) => `${b.kind}@${b.position}`).join(", "));
  check("the second one holds the box's words",
    companion?.some((b) => b.body?.includes("mooring fee")) ?? false);
}

console.log("\nthe boxes are findable");
{
  const hits = await searchNotes(A, spaceId, "mooring");
  check("lexical search reaches a canvas text box", hits.some((h) => h.id === note.id),
    `${hits.length} hits`);
}

console.log("\na note becomes a card");
{
  const carded = await createNote(A, spaceId, "");
  const layer = await createInkBlock(A, carded.id, { w: 800, h: 600 });
  await applyInkDelta(A, layer.blockId, {
    remove: [], upsert: [],
    texts: [box({ id: "c1", h: 120, fill: "#CCF3ED", text: "ring the harbour office" })],
  });

  const { document } = await getInk(A, layer.blockId);
  const stored = document.texts?.[0];
  check("the colour survives the round trip", stored?.fill === "#CCF3ED",
    JSON.stringify(stored));
  check("...and so does the height it was drawn at", stored?.h === 120);

  // A card is still a note: its words go into the companion block, so it is
  // findable exactly as plain canvas text is. ADR-065.
  check("a card's words are still findable",
    (await searchNotes(A, spaceId, "harbour")).some((h) => h.id === carded.id));

  // Taking the colour off is not the same as setting it to white.
  await applyInkDelta(A, layer.blockId, {
    remove: [], upsert: [],
    texts: [box({ id: "c1", h: 120, text: "ring the harbour office" })],
  });
  const plain = (await getInk(A, layer.blockId)).document.texts?.[0];
  check("...and it can be taken off again", plain?.fill === undefined,
    JSON.stringify(plain));

  let refused = false;
  try {
    await applyInkDelta(A, layer.blockId, {
      remove: [], upsert: [], texts: [box({ id: "c2", fill: "aquamarine" })],
    });
  } catch { refused = true; }
  check("a colour that is not #rrggbb is refused", refused);
}

console.log("\none delta, both kinds");
{
  const mixed = await createNote(A, spaceId, "");
  const layer = await createInkBlock(A, mixed.id, { w: 800, h: 600 });
  await appendStrokes(A, layer.blockId, 0, [stroke("keep"), stroke("gone")]);
  await applyInkDelta(A, layer.blockId, {
    remove: [], upsert: [],
    texts: [box({ id: "tkeep", text: "keep me" }), box({ id: "tgone", text: "delete me" })],
  });

  // (3). A lasso holding one stroke and one box, deleted in one go.
  await applyInkDelta(A, layer.blockId, { remove: ["gone", "tgone"], upsert: [] });

  const { document } = await getInk(A, layer.blockId);
  check("the stroke is gone", document.strokes.map((s) => s.id).join(",") === "keep");
  check("...and so is the box", document.texts?.map((t) => t.id).join(",") === "tkeep",
    JSON.stringify(document.texts));

  // A stroke-only delta must not wipe the page's typed boxes.
  await applyInkDelta(A, layer.blockId, { remove: [], upsert: [stroke("another")] });
  const after = (await getInk(A, layer.blockId)).document;
  check("a delta that says nothing about text leaves it alone",
    after.texts?.length === 1, JSON.stringify(after.texts));
}

console.log(failures === 0 ? "\ncanvas: all good\n" : `\ncanvas: ${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
