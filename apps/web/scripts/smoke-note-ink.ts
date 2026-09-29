/**
 * Drawing in a note. ADR-134.
 *
 * Pure. The claim: a stroke drawn in a note is part of that note -- saved
 * with its name, carried when it moves, turns or grows, copied with it, and
 * gone when it goes.
 */
import type { Point, Stroke, TextBox } from "@jotacular/domain";
import { nextPage, validateStrokes } from "@jotacular/domain";
import { toSvg } from "@jotacular/ink-render";
import { InkSelection } from "../lib/ink-selection";
import { carry } from "../lib/ink-selection-grip";
import { reborn } from "../lib/ink-clipboard";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};
const near = (a: number, b: number, eps = 0.01) => Math.abs(a - b) <= eps;
const codeOf = (fn: () => unknown): string | null => {
  try { fn(); return null; } catch (e) { return (e as { code?: string }).code ?? "none"; }
};
const pt = (x: number, y: number): Point => [x, y, 0, 0.5, 0, 0];
const note = (): TextBox =>
  ({ id: "n1", x: 0, y: 0, w: 200, h: 100, size: 16, color: "#111111", text: "hi", fill: "#CCF3ED" });
const sketch = (id: string, noteId?: string): Stroke => ({
  id, tool: "pen", color: "#6A39FF", width: 2, pts: [pt(20, 20), pt(80, 60)],
  ...(noteId ? { in: noteId } : {}),
});

console.log("\nsaved with the note's name");
{
  check("a stroke keeps the note it was drawn in", validateStrokes([sketch("s", "n1")])[0]!.in === "n1");
  check("a stroke with no note has no key", !("in" in validateStrokes([sketch("s")])[0]!));
  check("a bad note name is refused with bad_strokes",
    codeOf(() => validateStrokes([{ ...sketch("s"), in: 7 }])) === "bad_strokes");
}

console.log("\ngone when the note goes");
{
  const page = { strokes: [sketch("a", "n1"), sketch("b")], texts: [note()], images: [], links: [], stickers: [] };
  const next = nextPage(page, { remove: ["n1"], upsert: [], texts: null, images: null, links: null, stickers: null });
  check("the note's drawing went with it", !next.strokes.some((s) => s.id === "a"));
  check("ink that was not in it stayed", next.strokes.some((s) => s.id === "b"));
}

console.log("\npicked up with the note");
{
  const box = note();
  const mine = sketch("a", "n1");
  const loose = sketch("b");
  const sel = new InkSelection();
  sel.pick([mine, loose], [box], 100, 50, 4);
  check("tapping the note holds its drawing too", sel.selected.includes(mine) && !sel.selected.includes(loose));
  check("the note still has its own handles", sel.gripped?.obj === box);
  check("the bar names the note, not the strokes", sel.summary.attached === 1);
  sel.beginDrag(100, 50);
  sel.dragTo(130, 90);
  sel.endDrag();
  check("dragging the note moved its drawing", near(mine.pts[0]![0], 50) && near(mine.pts[0]![1], 60));
  check("...and not the loose ink", near(loose.pts[0]![0], 20));
}

console.log("\nstretched and turned with the note");
{
  const s = sketch("a", "n1");
  carry([s], { b: { x: 0, y: 0, w: 200, h: 100 }, rot: 0 }, { b: { x: 0, y: 0, w: 400, h: 100 }, rot: 0 });
  check("twice as wide, the sketch is twice as wide", near(s.pts[1]![0], 160) && near(s.pts[1]![1], 60));
  const t = sketch("t", "n1");
  carry([t], { b: { x: 0, y: 0, w: 200, h: 100 }, rot: 0 }, { b: { x: 0, y: 0, w: 200, h: 100 }, rot: 90 });
  check("a quarter turn turns the sketch about the note's centre", near(t.pts[0]![0], 130) && near(t.pts[0]![1], -30));
}

console.log("\ncopied with the note");
{
  const copy = reborn({ strokes: [sketch("a", "n1")], texts: [note()], images: [], stickers: [], links: [] }, 10, 10);
  check("the copy's drawing belongs to the copy", copy.strokes[0]!.in === copy.texts[0]!.id && copy.texts[0]!.id !== "n1");
  const alone = reborn({ strokes: [sketch("a", "n1")], texts: [], images: [], stickers: [], links: [] }, 0, 0);
  check("copied without its note, it is ink on the page", !("in" in alone.strokes[0]!));
}

console.log("\nexported between the colour and the words");
{
  const doc = { v: 1 as const, canvas: { w: 1, h: 1 }, strokes: [sketch("a", "n1")], texts: [note()] };
  const svg = toSvg(doc, { mode: "viewing", text: true });
  const colour = svg.indexOf('fill="#CCF3ED"');
  const ink = svg.indexOf('stroke="#6A39FF"');
  const words = svg.indexOf(">hi<");
  check("colour, then drawing, then words", colour < ink && ink < words, `${colour} ${ink} ${words}`);
  const read = toSvg(doc, { mode: "recognition" });
  check("recognition still reads the drawing", read.includes("<path"));
}

console.log(failures === 0 ? "\nnote ink: all good\n" : `\nnote ink: ${failures} FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
