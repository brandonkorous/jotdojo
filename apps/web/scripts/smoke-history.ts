/**
 * Taking it back, and making another one. ADR-109, ADR-110.
 *
 * Pure. The rules under test are the two that decide whether somebody's work
 * survives a mistake: that the inverse of a delta puts the page back exactly as
 * it was, and that a pasted copy is a NEW object rather than a second reference
 * to the old one.
 *
 * The page is folded with the client's own `fold`, which is the same function
 * the engine applies an undo with -- so a pass here is a pass on the real path
 * rather than on a re-implementation of it.
 */
import type { ImageOnPage, InkDelta, Link, Point, Stroke, TextBox } from "@jotacular/domain";
import { EMPTY, InkHistory, fold, invert, type Snapshot } from "../lib/ink-history";
import { clip, isEmpty, reborn, PASTE_OFFSET } from "../lib/ink-clipboard";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const pt = (x: number, y: number): Point => [x, y, 0, 0.5, 0, 0];

const stroke = (id: string, x = 0): Stroke =>
  ({ id, tool: "pen", color: "#1F2933", width: 2.2, pts: [pt(x, 0), pt(x + 10, 10)] });

const box = (id: string, over: Partial<TextBox> = {}): TextBox =>
  ({ id, x: 0, y: 0, w: 100, size: 16, color: "#1F2933", text: id, ...over });

const photo = (id: string): ImageOnPage =>
  ({ id, blockId: `blk-${id}`, x: 0, y: 0, w: 50, h: 50 });

const arrow = (id: string, from: string, to: string): Link =>
  ({ id, from: { id: from, x: 0, y: 0 }, to: { id: to, x: 90, y: 0 },
    color: "#1F2933", width: 2.2, head: "end" });

const page = (over: Partial<Snapshot> = {}): Snapshot => ({ ...EMPTY, ...over });

/** Undo, applied. What the engine does with the delta the history hands it. */
const undone = (before: Snapshot, delta: InkDelta): Snapshot =>
  fold(fold(before, delta), invert(delta, before));

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

console.log("\nthe inverse of a delta puts the page back");
{
  const before = page({ strokes: [stroke("s1"), stroke("s2", 100)] });

  // Drawing. The way back names the new stroke and takes it away.
  const drew: InkDelta = { remove: [], upsert: [stroke("s3", 200)] };
  check("a stroke drawn comes off again", same(undone(before, drew), before));

  // Erasing. The way back carries the stroke itself, points and all.
  const erased: InkDelta = { remove: ["s1"], upsert: [] };
  const back = undone(before, erased);
  check("a stroke rubbed out comes back", back.strokes.length === 2);
  check("...with its pressure intact",
    back.strokes.find((s) => s.id === "s1")!.pts[0]![3] === 0.5);

  // AND IT COMES BACK ON TOP, not where it was. A delta names things and never
  // places, which is what makes it commute with somebody else's drawing
  // (ADR-058) -- so a restored stroke has no position to go back to. ADR-109
  // argues why that is the right trade; this pins it so a change is deliberate.
  check("...on top rather than in its old place in paint order",
    back.strokes[1]!.id === "s1", back.strokes.map((s) => s.id).join(","));

  // Recolouring. The way back is the stroke as it WAS, not as it is.
  const recoloured: InkDelta = { remove: [], upsert: [{ ...stroke("s1"), color: "#00C2A8" }] };
  check("a recolour goes back to the old colour",
    undone(before, recoloured).strokes.find((s) => s.id === "s1")!.color === "#1F2933");
  check("...and stays in its place in paint order",
    undone(before, recoloured).strokes[0]!.id === "s1");
}

console.log("\nthe three whole-array kinds go back whole");
{
  const before = page({
    texts: [box("t1", { text: "kept" })],
    images: [photo("p1")],
    links: [arrow("l1", "t1", "p1")],
  });

  const typed: InkDelta = { remove: [], upsert: [], texts: [box("t1", { text: "changed" })] };
  check("an edited box goes back to its old words",
    undone(before, typed).texts[0]!.text === "kept");

  const moved: InkDelta = { remove: [], upsert: [], images: [{ ...photo("p1"), x: 900 }] };
  check("a moved photo goes back to where it was",
    undone(before, moved).images[0]!.x === 0);

  // THE ONE THAT NEARLY SHIPPED WRONG. These fields are upserts by id, so an
  // array that simply leaves the new box out does not delete it -- the way
  // back from "a box was added" has to NAME the box. Sending the old array on
  // its own left the new box sitting there, and undo looked like it had done
  // nothing at all.
  const added: InkDelta = { remove: [], upsert: [], texts: [box("t1"), box("t9", { x: 300 })] };
  check("a box that was added goes away again",
    undone(before, added).texts.map((t) => t.id).join(",") === "t1",
    undone(before, added).texts.map((t) => t.id).join(","));

  const drawn: InkDelta = { remove: [], upsert: [], links: [arrow("l1", "t1", "p1"), arrow("l9", "t1", "p1")] };
  check("...and so does an arrow that was drawn",
    undone(before, drawn).links.map((l) => l.id).join(",") === "l1");

  const shot: InkDelta = { remove: [], upsert: [], images: [photo("p1"), photo("p9")] };
  check("...and a photo that was put down",
    undone(before, shot).images.map((i) => i.id).join(",") === "p1");
}

console.log("\nan arrow taken by a deletion comes back with it. ADR-108, ADR-109");
{
  const before = page({
    texts: [box("t1"), box("t2", { x: 400 })],
    links: [arrow("l1", "t1", "t2")],
  });
  // The delta says nothing about links. The server takes the arrow anyway,
  // because one of its ends went -- so the inverse HAS to restore the array
  // even though nothing named it. This is the case the rule exists for.
  const deleted: InkDelta = { remove: ["t1"], upsert: [] };
  const back = fold(fold(before, deleted), invert(deleted, before));
  check("the box comes back", back.texts.length === 2);
  check("...and so does the arrow", back.links.length === 1, JSON.stringify(back.links));
}

console.log("\nthe stack");
{
  const history = new InkHistory();
  history.observe(page({ strokes: [stroke("s1")] }));
  check("nothing to undo on a fresh page", !history.canUndo);
  check("...and nothing to redo", !history.canRedo);

  history.record({ remove: [], upsert: [stroke("s2", 100)] });
  check("something to undo now", history.canUndo);
  check("still nothing to redo", !history.canRedo);

  const back = history.undo()!;
  check("the way back removes what was drawn", back.remove.join() === "s2");
  check("nothing left to undo", !history.canUndo);
  check("and something to redo", history.canRedo);

  const forward = history.redo()!;
  check("the way forward draws it again", forward.upsert[0]!.id === "s2");
  check("something to undo again", history.canUndo);

  // A new edit after an undo is a different branch, and there is no way back
  // to the old one that would not surprise somebody.
  history.undo();
  history.record({ remove: [], upsert: [stroke("s9")] });
  check("a new edit drops the future", !history.canRedo);
}

console.log("\nsomebody else's edit is not mine to take back. ADR-109");
{
  const history = new InkHistory();
  history.observe(page({ strokes: [stroke("s1")] }));
  history.observe(page({ strokes: [stroke("s1"), stroke("s2", 100)] }));
  check("adopting a page records no step", !history.canUndo);

  // And the shadow moved, so the NEXT undo is computed against what is really
  // on the page rather than against a version two edits old.
  history.record({ remove: ["s2"], upsert: [] });
  const back = history.undo()!;
  check("the next undo restores the stroke somebody else drew",
    back.upsert.some((s) => s.id === "s2"), JSON.stringify(back));
}

console.log("\na reset forgets, an observe does not");
{
  const history = new InkHistory();
  history.record({ remove: [], upsert: [stroke("s1")] });
  check("there is a step", history.canUndo);
  history.observe(page());
  check("observing keeps it", history.canUndo);
  history.reset(page());
  check("resetting drops it", !history.canUndo);
}

console.log("\na copy is a new thing, not a second name for the old one. ADR-110");
{
  const held = clip(
    { strokes: [stroke("s1")], texts: [box("t1")], images: [photo("p1")] },
    [arrow("l1", "t1", "s1"), arrow("l2", "t1", "outside")],
  );
  check("it takes what was caught", held.strokes.length === 1 && held.texts.length === 1);
  // An arrow with one end left behind would paste pointing at the original.
  check("it takes the arrow whose ends were BOTH caught", held.links.length === 1);
  check("...and leaves the one that reaches outside", held.links[0]!.id === "l1");

  const copy = reborn(held, PASTE_OFFSET, PASTE_OFFSET);
  check("every id is new", copy.strokes[0]!.id !== "s1" && copy.texts[0]!.id !== "t1");
  check("it is offset", copy.texts[0]!.x === PASTE_OFFSET);
  check("...strokes too", copy.strokes[0]!.pts[0]![0] === PASTE_OFFSET);
  check("pressure survives the copy", copy.strokes[0]!.pts[0]![3] === 0.5);
  check("a photo keeps pointing at the same bytes", copy.images[0]!.blockId === "blk-p1");
  check("...with a placement of its own", copy.images[0]!.id !== "p1");

  // The whole difficulty: an arrow that kept its old ends would be a second
  // arrow drawn on top of the first.
  check("the arrow is re-tied to the copies",
    copy.links[0]!.from.id === copy.texts[0]!.id
    && copy.links[0]!.to.id === copy.strokes[0]!.id,
    JSON.stringify(copy.links[0]));

  const twice = reborn(held, PASTE_OFFSET, PASTE_OFFSET);
  check("pasting twice gives different ids", twice.texts[0]!.id !== copy.texts[0]!.id);
  check("the clipping itself is untouched", held.texts[0]!.id === "t1" && held.texts[0]!.x === 0);
}

console.log("\nan empty copy never empties the clipboard");
{
  check("nothing caught is empty", isEmpty(clip({ strokes: [], texts: [], images: [] }, [])));
  check("one stroke is not", !isEmpty(clip({ strokes: [stroke("s")], texts: [], images: [] }, [])));
  check("one photo is not", !isEmpty(clip({ strokes: [], texts: [], images: [photo("p")] }, [])));
}

console.log(failures === 0 ? "\nhistory: all good\n" : `\nhistory: ${failures} FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
