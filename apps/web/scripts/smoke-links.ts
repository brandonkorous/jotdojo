/**
 * Arrows: where one runs, what takes it away, and what it says in words.
 * ADR-108.
 *
 * Pure, like smoke-lasso.ts and smoke-objects.ts beside it. The geometry lives
 * in `@jotacular/ink-render` on purpose -- ADR-078 records what happened the
 * last time the editor and the renderer each kept their own copy -- so this
 * suite tests the one both of them use.
 */
import type { ImageOnPage, Link, Stroke, TextBox } from "@jotacular/domain";
import { flattenLinks, orphanedBy, validateLinks } from "@jotacular/domain";
import { distanceTo, endsFor, objectBounds, segmentFor } from "@jotacular/ink-render";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const box = (over: Partial<TextBox> = {}): TextBox => ({
  id: "a", x: 0, y: 0, w: 100, h: 40, size: 16, color: "#1F2933", text: "Deposit", ...over,
});

const link = (over: Partial<Link> = {}): Link => ({
  id: "l1",
  from: { id: "a", x: 50, y: 20 },
  to: { id: "b", x: 450, y: 20 },
  color: "#1F2933", width: 2.2, head: "end", ...over,
});

const page = (texts: TextBox[] = [], images: ImageOnPage[] = [], strokes: Stroke[] = []) =>
  ({ strokes, texts, images });

console.log("\nan arrow runs between two things, not through them");
{
  const a = box({ id: "a", x: 0, y: 0 });
  const b = box({ id: "b", x: 400, y: 0, text: "Survey" });
  const seg = segmentFor(link(), page([a, b]));
  check("there is a line to draw", seg !== null);
  // It must start to the RIGHT of a's right edge and stop LEFT of b's left
  // edge, or half the arrow is hidden under the cards it joins.
  const right = objectBounds(page([a, b]), "a")!;
  const left = objectBounds(page([a, b]), "b")!;
  check("it starts outside the first card", seg!.x1 > right.x + right.w,
    `x1 ${seg!.x1} vs right edge ${right.x + right.w}`);
  check("...and stops short of the second", seg!.x2 < left.x,
    `x2 ${seg!.x2} vs left edge ${left.x}`);
  check("it runs left to right", seg!.x1 < seg!.x2);
}

console.log("\nit follows what it is tied to");
{
  const a = box({ id: "a", x: 0, y: 0 });
  const b = box({ id: "b", x: 400, y: 0 });
  const before = segmentFor(link(), page([a, b]))!;
  // The stored x/y is NEVER read while the object is there. Moving the card
  // and leaving the link untouched is the whole point of a connector.
  const moved = { ...b, y: 500 };
  const after = segmentFor(link(), page([a, moved]))!;
  check("moving the far card moves the far end", after.y2 !== before.y2,
    `${before.y2} -> ${after.y2}`);
  check("...downward, because that is where it went", after.y2 > before.y2);

  // The near end swings to face the new direction, and must STAY on the card
  // it leaves. An end that wandered off its own object is the failure this
  // whole file exists to catch.
  const near = objectBounds(page([a, moved]), "a")!;
  const reach = Math.hypot(near.w, near.h) / 2 + 12;
  const centre = { x: near.x + near.w / 2, y: near.y + near.h / 2 };
  check("the near end is still on the card it leaves",
    Math.hypot(after.x1 - centre.x, after.y1 - centre.y) <= reach,
    `end ${after.x1},${after.y1} centre ${centre.x},${centre.y} reach ${reach}`);
}

console.log("\nthe remembered point is the fallback, and only that");
{
  const a = box({ id: "a", x: 0, y: 0 });
  // Neither end is on the page any more. It falls back to where they were.
  const seg = segmentFor(link({ from: { id: "gone", x: 10, y: 10 }, to: { id: "also", x: 90, y: 10 } }), page([a]));
  check("an arrow with both ends missing still draws", seg !== null);
  check("...at the points it remembered", seg!.x1 === 10 && seg!.x2 === 90,
    JSON.stringify(seg));
}

console.log("\ntwo things on top of each other have no line between them");
{
  const a = box({ id: "a", x: 0, y: 0 });
  const b = box({ id: "b", x: 0, y: 0 });
  // A zero-length arrowhead is a blot nobody could explain, so there is none.
  check("no segment", segmentFor(link(), page([a, b])) === null);
}

console.log("\nan arrow may tie a photo or a stroke, not only a note");
{
  const photo: ImageOnPage = { id: "p", blockId: "blk", x: 400, y: 0, w: 100, h: 100 };
  const a = box({ id: "a" });
  check("a photo has bounds", objectBounds(page([a], [photo]), "p") !== null);
  check("an arrow to it draws",
    segmentFor(link({ to: { id: "p", x: 450, y: 50 } }), page([a], [photo])) !== null);
  check("a name nothing owns has no bounds", objectBounds(page([a], [photo]), "nope") === null);
}

console.log("\nan arrow dies with either of the things it ties. ADR-108");
{
  const links = [
    link({ id: "l1", from: { id: "a", x: 0, y: 0 }, to: { id: "b", x: 9, y: 0 } }),
    link({ id: "l2", from: { id: "c", x: 0, y: 0 }, to: { id: "d", x: 9, y: 0 } }),
  ];
  check("removing the near end takes it", orphanedBy(links, new Set(["a"])).join() === "l1");
  check("removing the far end takes it too", orphanedBy(links, new Set(["b"])).join() === "l1");
  check("removing something else takes neither", orphanedBy(links, new Set(["z"])).length === 0);
  check("removing nothing is not a question", orphanedBy(links, new Set()).length === 0);
  // This is the one place a page disagrees with a comment (ADR-107): what
  // somebody SAID about a rubbed-out note is a record, and an arrow is not.
  check("both ends at once still names it once",
    orphanedBy(links, new Set(["a", "b"])).length === 1);
}

console.log("\nan arrow is a sentence, which is why it is stored");
{
  const names = new Map([["a", "Deposit"], ["b", "Survey"]]);
  const words = flattenLinks([link()], names);
  check("it reads as one thing pointing at another", words.includes("Deposit -> Survey"), words);
  check("...and says how many there are", words.includes("1 arrow"), words);
  check("a double-headed one reads as a tie",
    flattenLinks([link({ head: "both" })], names).includes("Deposit <-> Survey"));
  check("a headless one reads as a plain line",
    flattenLinks([link({ head: "none" })], names).includes("Deposit -- Survey"));
  // An arrow between two squiggles is true and says nothing.
  check("an arrow between two unnamed things is left out",
    flattenLinks([link()], new Map()) === "");
  check("one named end is still worth saying",
    flattenLinks([link()], new Map([["a", "Deposit"]])).includes("Deposit ->"));
  check("no arrows is no words", flattenLinks([], names) === "");
}

console.log("\nwhat a client may send");
{
  check("a good one comes back", validateLinks([link()]).length === 1);
  check("an id is minted when none is given",
    validateLinks([{ ...link(), id: undefined }])[0]!.id.length > 0);
  // A loose end is an ORDINARY value here, not a missing one.
  check("a loose end is allowed",
    validateLinks([link({ to: { id: null, x: 5, y: 5 } })])[0]!.to.id === null);
  check("...and an absent id reads as loose",
    validateLinks([{ ...link(), to: { x: 5, y: 5 } }] as unknown[])[0]!.to.id === null);
  check("a bad colour is refused", threw(() => validateLinks([link({ color: "red" })])));
  check("an unknown head is refused",
    threw(() => validateLinks([link({ head: "spike" as Link["head"] })])));
  check("a NaN coordinate is refused",
    threw(() => validateLinks([link({ from: { id: "a", x: NaN, y: 0 } })])));
  check("a runaway coordinate is refused",
    threw(() => validateLinks([link({ from: { id: "a", x: 1e12, y: 0 } })])));
  check("a width of zero is refused", threw(() => validateLinks([link({ width: 0 })])));
  check("not an array is refused", threw(() => validateLinks("nope")));
  check("an end that is not an object is refused",
    threw(() => validateLinks([{ ...link(), from: "a" }] as unknown[])));
}

console.log("\nthe eraser has to be able to find one");
{
  const a = box({ id: "a", x: 0, y: 0 });
  const b = box({ id: "b", x: 400, y: 0 });
  const seg = segmentFor(link(), page([a, b]))!;
  const midX = (seg.x1 + seg.x2) / 2;
  check("a point on the line is at no distance", distanceTo(seg, midX, seg.y1) < 0.001);
  check("a point beside it is at that distance",
    Math.abs(distanceTo(seg, midX, seg.y1 + 10) - 10) < 0.001);
  // Past the end, not beside it: the clamp is what stops an eraser at the far
  // side of the page taking an arrow it never touched.
  check("a point beyond the end is measured from the end",
    distanceTo(seg, seg.x2 + 100, seg.y2) > 99);
}

console.log("\nan arrow is only born between two things that exist");
{
  const a = box({ id: "a" });
  const b = box({ id: "b", x: 400 });
  check("both there", endsFor(page([a, b]), "a", "b") !== null);
  check("the far one missing", endsFor(page([a]), "a", "b") === null);
  check("the near one missing", endsFor(page([b]), "a", "b") === null);
  const ends = endsFor(page([a, b]), "a", "b")!;
  check("each end names what it is tied to",
    ends.from.id === "a" && ends.to.id === "b");
  check("...and remembers where that was", ends.from.x === 50 && ends.to.x === 450,
    JSON.stringify(ends));
}

function threw(fn: () => unknown): boolean {
  try { fn(); return false; } catch { return true; }
}

console.log(failures === 0 ? "\nlinks: all good\n" : `\nlinks: ${failures} FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
