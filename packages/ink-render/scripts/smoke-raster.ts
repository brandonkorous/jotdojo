/**
 * What a person actually gets when they export a page. ADR-067.
 *
 * Pure, and it goes all the way to pixels on purpose. Every earlier bug in this
 * renderer was invisible in the SVG and obvious in the PNG -- the background
 * rect that resolved off-screen at a negative viewBox origin (ADR-053) produced
 * perfectly valid markup and a transparent image. Asserting on the string would
 * have passed.
 *
 * So: decode the PNG and look at it.
 */
import sharp from "sharp";
import type { InkDocument, Point, Stroke, TextBox } from "@jotacular/domain";
import { toPng } from "../src/raster";
import { toSvg } from "../src/svg";
import { strokesBounds, bounds, contentBounds } from "../src/geometry";
import { textBounds } from "../src/text-geometry";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const point = (x: number, y: number): Point => [x, y, 0, 0.5, 0, 0];

const stroke = (id: string, color: string, from: number): Stroke => ({
  id, tool: "pen", color, width: 3,
  pts: [point(from, 40), point(from + 30, 70), point(from + 60, 40)],
});

const textBox = (text: string, x: number, y: number): TextBox => ({
  id: `t-${x}-${y}`, x, y, w: 200, size: 16, color: "#1F2933", text,
});

const doc: InkDocument = {
  v: 1,
  canvas: { w: 800, h: 600 },
  strokes: [stroke("a", "#1F2933", 40), stroke("b", "#B4341C", 200)],
};

/** [r, g, b, a] at a pixel, from the decoded PNG. */
async function pixelAt(png: Buffer, x: number, y: number): Promise<number[]> {
  const { data, info } = await sharp(png).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const at = (y * info.width + x) * info.channels;
  return [...data.subarray(at, at + 4)];
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

console.log("\na page, rendered for a person to look at");
{
  const png = await toPng(doc, { mode: "viewing" });
  check("it is a PNG", PNG_MAGIC.every((b, i) => png[i] === b), png.subarray(0, 8).toString("hex"));

  const meta = await sharp(png).metadata();
  check("...of a sensible size",
    (meta.width ?? 0) > 200 && (meta.width ?? 0) <= 1600,
    `${meta.width}x${meta.height}`);

  // The corner is padding, so it is paper and nothing else. Opaque, because a
  // transparent PNG opened against a dark background is invisible ink -- and
  // that is exactly what `preview` mode produces.
  const corner = await pixelAt(png, 1, 1);
  check("the corner is white", corner[0] === 255 && corner[1] === 255 && corner[2] === 255,
    `rgba(${corner.join(", ")})`);
  check("...and opaque", corner[3] === 255, `alpha ${corner[3]}`);
}

console.log("\nthe modes disagree, which is the whole reason there are three");
{
  const preview = await toPng(doc, { mode: "preview" });
  const corner = await pixelAt(preview, 1, 1);
  check("a thumbnail is still transparent", corner[3] === 0, `alpha ${corner[3]}`);

  const viewing = toSvg(doc, { mode: "viewing" });
  check("viewing keeps the pen colour", viewing.includes("#B4341C"));
  check("...and recognition still does not",
    !toSvg(doc, { mode: "recognition" }).includes("#B4341C"));
  check("recognition still draws on white",
    toSvg(doc, { mode: "recognition" }).includes('fill="#FFFFFF"'));
}

console.log("\nsmall ink is enlarged for a person and not for a card");
{
  const tiny: InkDocument = { ...doc, strokes: [stroke("t", "#1F2933", 0)] };
  const viewing = await sharp(await toPng(tiny, { mode: "viewing" })).metadata();
  const preview = await sharp(await toPng(tiny, { mode: "preview" })).metadata();
  // A two-word note is 60 units wide. Shown at 1:1 it is a stamp.
  check("viewing fills its frame", (viewing.width ?? 0) > (preview.width ?? 0),
    `viewing ${viewing.width}, preview ${preview.width}`);
}

console.log("\nexporting a selection draws the selection");
{
  const only = new Set(["b"]);
  const picked = { ...doc, strokes: doc.strokes.filter((s) => only.has(s.id)) };
  const svg = toSvg(picked, { mode: "viewing" });
  check("the chosen stroke is there", svg.includes("#B4341C"));
  check("...and the other one is not", !svg.includes("#1F2933"));

  // The frame comes from the strokes being drawn, so a lasso round the second
  // squiggle crops to it rather than putting it in the corner of the page.
  const whole = strokesBounds(doc.strokes)!;
  const part = strokesBounds(picked.strokes)!;
  check("the frame is the selection, not the page", part.w < whole.w,
    `${part.w} vs ${whole.w}`);

  // strokeBounds inflates by the round linecap. A box drawn through the point
  // centres clips half a nib off every end, which on a tight marquee is
  // visible as a shaved letter.
  check("the box allows for the width of the nib", part.x < 200,
    `left edge ${part.x}, first point at x=200`);
}

console.log("\nthe recogniser does not see typed text");
{
  // The whole reason texts are a second array rather than a polymorphic list.
  // If the model reads typed words back as handwriting, a certainty becomes a
  // confidence-scored guess. ADR-065.
  const typed: InkDocument = { ...doc, texts: [textBox("mooring fee, ask Dana", 400, 20)] };

  check("recognition renders no typed text",
    !toSvg(typed, { mode: "recognition" }).includes("mooring fee"));
  check("...and frames only the ink",
    JSON.stringify(bounds(typed)) !== JSON.stringify(contentBounds(typed)));

  const forPerson = toSvg(typed, { mode: "viewing", text: true });
  check("a person's export DOES show it", forPerson.includes("mooring fee"));
  check("...as real text, not a picture of it", forPerson.includes("<text"));

  // SVG paints in document order, so the last thing written is on top. The
  // editor puts the object plane above both canvases, and these were reversed
  // -- invisible while text was transparent, and a card buried under somebody's
  // handwriting the moment a box had a fill. ADR-078.
  check("typed text sits OVER the ink, as it does on screen",
    forPerson.indexOf("<text") > forPerson.lastIndexOf("<path"),
    `text at ${forPerson.indexOf("<text")}, last path at ${forPerson.lastIndexOf("<path")}`);
}

console.log("\na page that is nothing but typed text");
{
  const words: InkDocument = {
    v: 1, canvas: { w: 800, h: 600 }, strokes: [], texts: [textBox("no ink at all", 40, 40)],
  };
  check("has no ink bounds", bounds(words) === null);
  // Without contentBounds this exports as a 1x1 image and opens on blank paper.
  check("...but does have content bounds", contentBounds(words) !== null);
  check("...and renders", toSvg(words, { mode: "viewing", text: true }).includes("no ink at all"));
}

console.log("\na note with a colour behind it");
{
  const card: InkDocument = {
    ...doc,
    texts: [{ ...textBox("mooring fee", 400, 20), fill: "#CCF3ED" }],
  };
  const svg = toSvg(card, { mode: "viewing", text: true });

  check("the card is drawn", svg.includes('fill="#CCF3ED"'));
  // Behind, not in front. A rect emitted after the text would cover it.
  check("...behind its own words",
    svg.indexOf('fill="#CCF3ED"') < svg.indexOf("mooring fee"));

  // The whole reason the ink is derived rather than stored: a card cannot be
  // saved with text nobody can read on it. ADR-079.
  check("charcoal type on a light card", svg.includes('fill="#111418"'));
  const dark: InkDocument = {
    ...doc, texts: [{ ...textBox("after dark", 400, 20), fill: "#111418" }],
  };
  check("...and paper type on a dark one",
    toSvg(dark, { mode: "viewing", text: true }).includes('fill="#F7F3EA"'));

  // The frame has to clear the card's edge, or every exported note loses the
  // colour off its sides.
  const plain: InkDocument = { ...doc, texts: [textBox("mooring fee", 400, 20)] };
  check("the frame allows for the card, not just the words",
    contentBounds(card)!.w > contentBounds(plain)!.w,
    `${contentBounds(card)!.w} vs ${contentBounds(plain)!.w}`);

  // Colouring a note must not move a word: the padding grows outward.
  check("...and colouring a note does not move its text",
    textBounds(card.texts![0]!).x === textBounds(plain.texts![0]!).x);

  // Recognition never draws text at all, so it certainly never draws a card --
  // but a coloured rectangle reaching the model would be a new way to break
  // ADR-065, so it is asserted rather than assumed.
  check("recognition draws no card either",
    !toSvg(card, { mode: "recognition" }).includes("#CCF3ED"));
}

console.log("\na page with nothing on it");
{
  const blank: InkDocument = { v: 1, canvas: { w: 800, h: 600 }, strokes: [] };
  check("has no bounds to frame", strokesBounds(blank.strokes) === null);
  // Callers are expected to check that and say "there is no drawing" rather
  // than hand somebody a 1x1 image and call it their page.
  const meta = await sharp(await toPng(blank, { mode: "viewing" })).metadata();
  check("...and renders to the empty placeholder", meta.width === 1 && meta.height === 1,
    `${meta.width}x${meta.height}`);
}

console.log(failures === 0 ? "\nraster: all good\n" : `\nraster: ${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
