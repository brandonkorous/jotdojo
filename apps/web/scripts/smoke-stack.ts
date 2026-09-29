/**
 * The page's one order. ADR-136.
 *
 * Pure. Old pages keep the order they always had; new things land on top;
 * the four moves do what they say; the export paints in the same order.
 */
import type { ImageOnPage, Point, Sticker, Stroke, TextBox } from "@jotacular/domain";
import { validateTexts } from "@jotacular/domain";
import { nextZ, stackOf, toSvg } from "@jotacular/ink-render";
import { reorder } from "../lib/ink-stack";
import { paintStroke } from "../lib/ink-paint";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};
const codeOf = (fn: () => unknown): string | null => {
  try { fn(); return null; } catch (e) { return (e as { code?: string }).code ?? "none"; }
};
const pt = (x: number, y: number): Point => [x, y, 0, 0.5, 0, 0];
const ink = (id: string, z?: number): Stroke =>
  ({ id, tool: "pen", color: "#6A39FF", width: 2, pts: [pt(0, 0), pt(40, 40)], ...(z === undefined ? {} : { z }) });
const note = (id: string, z?: number): TextBox =>
  ({ id, x: 0, y: 0, w: 100, size: 16, color: "#111111", text: id, fill: "#CCF3ED", ...(z === undefined ? {} : { z }) });
const pic = (id: string, z?: number): ImageOnPage =>
  ({ id, blockId: "b", x: 0, y: 0, w: 50, h: 50, ...(z === undefined ? {} : { z }) });
const star = (id: string, z?: number): Sticker =>
  ({ id, name: "star", x: 0, y: 0, size: 40, color: "#112233", ...(z === undefined ? {} : { z }) });
const order = (p: Parameters<typeof stackOf>[0]) => stackOf(p).map((i) => i.id).join(" ");

console.log("\nan old page keeps its order");
{
  const page = { strokes: [ink("s1"), ink("s2")], texts: [note("t1")], images: [pic("i1")], stickers: [star("k1")] };
  check("ink, then notes, then photos, then stickers", order(page) === "s1 s2 t1 i1 k1", order(page));
  check("the next thing goes above all of it", nextZ(page) === 1);
}

console.log("\nnew things land on top");
{
  const page = { strokes: [ink("old"), ink("new", 3)], texts: [note("t1", 1)], images: [pic("i1", 2)] };
  check("a stroke drawn after a photo is above it", order(page) === "old t1 i1 new", order(page));
  check("and the next is above that", nextZ(page) === 4);
  check("a stroke drawn in a note is not in the order", order({ strokes: [{ ...ink("x"), in: "t1" }] }) === "");
  check("a bad z is refused with bad_texts", codeOf(() => validateTexts([{ ...note("t"), z: NaN }])) === "bad_texts");
}

console.log("\nthe four moves");
{
  const fresh = () => ({ strokes: [ink("a", 1)], texts: [note("b", 2)], images: [pic("c", 3)], stickers: [star("d", 4)] });
  let p = fresh();
  reorder(p, new Set(["a"]), "front");
  check("to the front", order(p) === "b c d a", order(p));
  p = fresh(); reorder(p, new Set(["d"]), "back");
  check("to the back", order(p) === "d a b c", order(p));
  p = fresh(); reorder(p, new Set(["a"]), "forward");
  check("up one", order(p) === "b a c d", order(p));
  p = fresh(); reorder(p, new Set(["c"]), "backward");
  check("down one", order(p) === "a c b d", order(p));
  p = fresh(); reorder(p, new Set(["a", "b"]), "front");
  check("a group keeps its own order", order(p) === "c d a b", order(p));
  p = fresh();
  check("nothing to move past is no move", !reorder(p, new Set(["a", "b", "c", "d"]), "front"));
}

console.log("\nthe export paints in the same order");
{
  const doc = { v: 1 as const, canvas: { w: 1, h: 1 }, strokes: [ink("over", 5)], texts: [note("under", 1)] };
  const svg = toSvg(doc, { mode: "viewing", text: true });
  check("a stroke above a note is painted after it",
    svg.indexOf('fill="#CCF3ED"') < svg.indexOf('stroke="#6A39FF"'));
  const flip = { ...doc, strokes: [ink("under", 1)], texts: [note("over", 5)] };
  const svg2 = toSvg(flip, { mode: "viewing", text: true });
  check("...and a note above a stroke covers it",
    svg2.indexOf('stroke="#6A39FF"') < svg2.indexOf('fill="#CCF3ED"'));
}

console.log("\na line is painted in a few calls, not one per segment. ADR-137");
{
  let strokes = 0;
  const ctx = new Proxy({}, {
    get: (_, k) => (k === "stroke" ? () => { strokes += 1; }
      : k === "getTransform" ? () => ({ a: 2 }) : () => {}),
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  const steady = { ...ink("s"), pts: Array.from({ length: 40 }, (_, i) => [i * 5, 0, i, 0.5, 0, 0] as Point) };
  paintStroke(ctx, steady);
  check("a steady line is one call", strokes === 1, String(strokes));
  strokes = 0;
  const pressed = { ...ink("p"), pts: Array.from({ length: 40 }, (_, i) => [i * 5, 0, i, i / 39, 0, 0] as Point) };
  paintStroke(ctx, pressed);
  check("a line that swells takes a handful, not forty", strokes > 1 && strokes < 12, String(strokes));
}

console.log(failures === 0 ? "\nstack: all good\n" : `\nstack: ${failures} FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
