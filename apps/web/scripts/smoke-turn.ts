/**
 * Turning, resizing by handle, and voice cards. ADR-121, ADR-122.
 *
 * Pure, like smoke-images.ts. The claim under test is that a turned object is
 * caught, tapped, framed and exported as the shape a person SEES.
 */
import type { ImageOnPage, Point, Sticker, TextBox } from "@jotacular/domain";
import { validateImages, validateStickers, validateTexts, normalTurn } from "@jotacular/domain";
import { cardBounds, contentBounds, extent, hits, toSvg } from "@jotacular/ink-render";
import { imageAt, imageInPolygon, imagesBounds } from "../lib/ink-rects";
import { boxAt } from "../lib/ink-objects";
import { InkSelection } from "../lib/ink-selection";
import { frameOf, gripAt, gripPoints, resizeTo, turnTo } from "../lib/ink-selection-grip";
import { VOICE_BARS, clock, peaks, voiceSize } from "../lib/ink-voice";
import { clearOf } from "../lib/ink-image-layer";
import { written } from "../lib/ink-print";
import type { Stroke } from "@jotacular/domain";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};
const near = (a: number, b: number, eps = 0.01) => Math.abs(a - b) <= eps;
const codeOf = (fn: () => unknown): string | null => {
  try { fn(); return null; } catch (e) { return (e as { code?: string }).code ?? "none"; }
};
const loop = (x: number, y: number, w: number, h: number): Point[] =>
  [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([px, py]) =>
    [px!, py!, 0, 0.5, 0, 0] as Point);

const pic = (over: Partial<ImageOnPage> = {}): ImageOnPage =>
  ({ id: "i1", blockId: "b1", x: 0, y: 0, w: 200, h: 100, ...over });
const card = (over: Partial<TextBox> = {}): TextBox =>
  ({ id: "t1", x: 0, y: 0, w: 200, h: 100, size: 16, color: "#111111", text: "hi", ...over });

console.log("\nthe stored angle");
{
  check("upright stores nothing", normalTurn(0) === undefined);
  check("a hair off upright is upright", normalTurn(0.6) === undefined);
  check("270 is -90", normalTurn(270) === -90);
  check("-180 is 180", normalTurn(-180) === 180);
  check("rounded to a tenth", normalTurn(12.345) === 12.3);
  check("a card keeps its turn", validateTexts([card({ rot: 8 })])[0]!.rot === 8);
  check("an upright card has no rot key", !("rot" in validateTexts([card({ rot: 0 })])[0]!));
  check("a sticker keeps its turn", validateStickers([{
    id: "s", name: "star", x: 0, y: 0, size: 40, color: "#112233", rot: -30,
  }])[0]!.rot === -30);
  check("NaN is refused with bad_images",
    codeOf(() => validateImages([pic({ rot: NaN })])) === "bad_images");
  check("a voice placement keeps its media", validateImages([pic({ media: "audio" })])[0]!.media === "audio");
  check("an unknown media is refused with bad_images",
    codeOf(() => validateImages([{ ...pic(), media: "video" }])) === "bad_images");
}

console.log("\nthe shape a person sees");
{
  const turned = pic({ rot: 90 });
  const e = extent({ x: 0, y: 0, w: 200, h: 100 }, 90);
  check("a quarter turn swaps the extent", near(e.w, 100) && near(e.h, 200) && near(e.x, 50));
  check("bounds use the extent", near(imagesBounds([turned])!.h, 200));
  check("a tap on the turned body lands", imageAt([turned], 100, -40) === turned);
  check("a tap on the old corner misses", imageAt([turned], 5, 5) === null);
  check("hits agrees", hits({ x: 0, y: 0, w: 200, h: 100 }, 90, 100, 140));
  check("a loop round the extent catches it", imageInPolygon(loop(40, -60, 120, 220), turned));
  check("a loop round the upright box does not",
    !imageInPolygon(loop(-1, -1, 202, 102), turned));
  const box = card({ rot: 45 });
  check("a turned card is tapped on its body", boxAt([box], 100, 50) === box);
}

console.log("\nthe handles");
{
  const sel = new InkSelection();
  const p = pic();
  sel.hold([], [], [p]);
  check("one object has handles", sel.gripped?.obj === p);
  const pts = gripPoints(frameOf(sel.gripped!), 1);
  check("the knob is above the top edge", near(pts.knob[0], 100) && pts.knob[1] < 0);
  check("the resize corner is bottom-right", near(pts.resize[0], 200) && near(pts.resize[1], 100));
  check("a pointer on the knob takes it", gripAt(frameOf(sel.gripped!), pts.knob[0], pts.knob[1], 1) === "turn");
  check("a pointer on the corner takes it", sel.gripAt(200, 100, 1) === "resize");
  check("a pointer in the middle takes neither", sel.gripAt(100, 50, 1) === null);

  sel.beginGrip("resize", 200, 100);
  sel.dragTo(400, 150);
  sel.endDrag();
  check("a photo keeps its shape", near(p.w, 400) && near(p.h, 200));
  check("the near corner stays put", p.x === 0 && p.y === 0);

  turnTo({ kind: "pic", obj: p }, 400, 100);
  check("pointing right is a quarter turn", p.rot === 90);
  turnTo({ kind: "pic", obj: p }, 200, -500);
  check("pointing up is upright again", p.rot === undefined);
  turnTo({ kind: "pic", obj: p }, 203, -500);
  check("near upright snaps upright", p.rot === undefined);

  const two = new InkSelection();
  two.hold([], [card()], [pic()]);
  check("two objects have no handles", two.gripped === null);
}

console.log("\na group resizes and turns as one object");
{
  const line = { id: "s1", tool: "pen", color: "#111111", width: 2,
    pts: [[0, 0, 0, 0.5, 0, 0], [100, 0, 1, 0.5, 0, 0]] } as unknown as Stroke;
  const p = pic({ x: 0, y: 50, w: 100, h: 50 });
  const sel = new InkSelection();
  sel.hold([line], [], [p]);
  check("a group has handles too", sel.frame !== null && sel.gripped === null);
  const b = sel.marquee!;
  sel.beginGrip("resize", b.x + b.w, b.y + b.h);
  sel.dragTo(b.x + b.w * 2, b.y + b.h * 2);
  check("the stroke doubled from the corner", near(line.pts[1]![0], b.x + (100 - b.x) * 2));
  check("its width doubled", near(line.width, 4));
  check("the photo doubled with it", near(p.w, 200) && near(p.h, 100));
  sel.endDrag();
  const c = sel.marquee!;
  const [cx, cy] = [c.x + c.w / 2, c.y + c.h / 2];
  sel.beginGrip("turn", cx, c.y - 28);
  sel.dragTo(cx + 500, cy);
  check("the photo turned a quarter", p.rot === 90);
  check("the frame turned with it", sel.frame?.rot === 90);
  sel.endDrag();
  check("afterwards the frame is upright round the new shape", sel.frame?.rot === 0);
  const one = new InkSelection();
  one.hold([line], [], []);
  check("a single stroke has handles", one.frame !== null);
}

console.log("\na card resizes inside its colour");
{
  const c = card({ fill: "#FFE08A" });
  const before = cardBounds(c);
  resizeTo({ kind: "box", obj: c }, before.x + 300, before.y + 180);
  const after = cardBounds(c);
  check("the card's outer width follows the pointer", near(after.w, 300, 0.5));
  check("the card's top-left did not move", near(after.x, before.x) && near(after.y, before.y));
  const s: Sticker = { id: "s", name: "star", x: 0, y: 0, size: 40, color: "#112233" };
  resizeTo({ kind: "mark", obj: s }, 90, 60);
  check("a sticker stays square", near(s.size, 90));
}

console.log("\nthe export turns with the screen");
{
  const doc = { v: 1 as const, canvas: { w: 1, h: 1 }, strokes: [], texts: [card({ fill: "#FFE08A", rot: 30 })] };
  const svg = toSvg(doc, { mode: "preview", text: true });
  check("a turned card is drawn turned", /rotate\(30 /.test(svg), svg.slice(0, 300));
  const framed = contentBounds(doc)!;
  check("the frame holds the turned corners", framed.w > cardBounds(doc.texts[0]!).w);
}

console.log("\nvoice cards");
{
  const bars = peaks(Float32Array.from({ length: 4000 }, (_, i) => Math.sin(i / 30) * (i / 4000)));
  check(`${VOICE_BARS} bars`, bars.length === VOICE_BARS);
  check("the loudest bar is full height", near(Math.max(...bars), 1));
  check("silence still draws a line", Math.min(...peaks(new Float32Array(400))) > 0);
  const phone = voiceSize({ w: 360, h: 760 }, 1);
  check("never wider than most of a phone", phone.w <= 360 * 0.8);
  check("the same size on the glass at half zoom", near(voiceSize({ w: 1200, h: 800 }, 0.5).w, 640));
  check("a clock reads m:ss", clock(84_400) === "1:24");
  const photo = pic({ x: 0, y: 0, w: 200, h: 200 });
  const voice = pic({ id: "v", media: "audio", x: 40, y: 60, w: 160, h: 44 });
  clearOf(voice, [photo]);
  check("a new card steps off the photo under it", voice.y >= 200 && voice.x === 40);
}

console.log("\na print is dated on its foot");
{
  const now = new Date("2026-09-28T12:00:00Z");
  check("this year's date has no year", !/2026/.test(written("2026-03-04T10:00:00Z", now)));
  check("last year's date says so", /2025/.test(written("2025-03-04T10:00:00Z", now)));
  check("a bad date writes nothing", written("not a date", now) === "");
}

console.log(failures === 0 ? "\nturn: all good\n" : `\nturn: ${failures} FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
