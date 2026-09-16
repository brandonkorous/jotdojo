/**
 * A sticker, drawn. ADR-115.
 *
 * Three things would be silently wrong here, and none of them shows in a type:
 *
 *   1. THE TWO LISTS DRIFT. The names live in `@jotacular/domain` and the paths
 *      live in a generated file here. A name with no art draws nothing, on a
 *      page somebody has already saved.
 *   2. THE WHITE EDGE EATS THE PICTURE. `paint-order="stroke fill"` is what
 *      puts the outline BEHIND the artwork. Without it the stroke is painted
 *      over the fill and the glyph is quietly thinned -- valid markup, wrong
 *      picture. So this renders it both ways and compares the pixels.
 *   3. A STICKER REACHES THE RECOGNISER. A vision model handed a flame reads it
 *      as a squiggle and writes it into somebody's transcript.
 *
 * It goes all the way to pixels for the reason smoke-raster.ts does: every
 * earlier bug in this renderer was invisible in the SVG and obvious in the PNG.
 */
import sharp from "sharp";
import {
  STICKER_NAMES, STICKER_GROUPS, type InkDocument, type Sticker,
} from "@jotacular/domain";
import { STICKER_ART } from "../src/sticker-art";
import { placeSticker, stickerBounds, STICKER_BORDER } from "../src/sticker-geometry";
import { toSvg } from "../src/svg";
import { svgToPng } from "../src/raster";
import { contentBounds } from "../src/geometry";
import { objectBounds } from "../src/links";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const RED = "#E5484D";
const mark = (name: string, x = 0, y = 0, size = 200): Sticker =>
  ({ id: `k-${name}`, name: name as Sticker["name"], x, y, size, color: RED });

const page = (stickers: Sticker[]): InkDocument =>
  ({ v: 1, canvas: { w: 800, h: 600 }, strokes: [], stickers });

async function count(svg: string, hit: (r: number, g: number, b: number) => boolean) {
  const { data, info } = await sharp(await svgToPng(svg)).raw()
    .toBuffer({ resolveWithObject: true });
  let n = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (hit(data[i]!, data[i + 1]!, data[i + 2]!)) n++;
  }
  return n;
}

const isRed = (r: number, g: number, b: number) => r > 170 && g < 100 && b < 100;

console.log("\n(1) every sticker the domain offers has artwork here");
{
  const missing = STICKER_NAMES.filter((name) => !STICKER_ART[name]);
  check("no name is without art", missing.length === 0, missing.join(", "));
  check("no art is without a name",
    Object.keys(STICKER_ART).length === STICKER_NAMES.length,
    `${Object.keys(STICKER_ART).length} art, ${STICKER_NAMES.length} names`);
  const broken = STICKER_NAMES.filter((name) => {
    const art = STICKER_ART[name]!;
    return !(art.w > 0 && art.h > 0 && art.d.length > 10);
  });
  check("every path is drawable", broken.length === 0, broken.join(", "));
  check("the groups cover the list",
    Object.values(STICKER_GROUPS).flat().length === STICKER_NAMES.length);
}

console.log("\nwhere the picture goes in its square");
{
  check("the square is the size", (() => {
    const b = stickerBounds(mark("fire", 10, 20, 50));
    return b.x === 10 && b.y === 20 && b.w === 50 && b.h === 50;
  })());

  // `fire` is 448x512 -- taller than it is wide, which is the case a square
  // box gets wrong if anything stretches it.
  const p = placeSticker(mark("fire", 0, 0, 100))!;
  check("a tall glyph is placed", p !== null);
  const w = p.art.w * p.k;
  const h = p.art.h * p.k;
  check("it keeps its own proportions",
    Math.abs((w / h) - (p.art.w / p.art.h)) < 1e-9, `${w}x${h}`);
  check("it fits inside the square", w <= 100 && h <= 100, `${w}x${h}`);
  check("...with room left for the edge", h <= 100 * (1 - STICKER_BORDER * 2) + 1e-6);
  check("it is centred", Math.abs((p.tx - 0) - (100 - w) / 2) < 1e-9);
  check("an unknown name places nothing rather than a hole",
    placeSticker(mark("unicorn")) === null);
}

console.log("\nthe page knows a sticker is on it");
{
  const box = contentBounds(page([mark("star", 40, 60, 80)]));
  check("a page of nothing but a sticker has a frame", box !== null);
  check("...which is where the sticker is",
    box?.x === 40 && box?.y === 60 && box?.w === 80, JSON.stringify(box));

  const doc = page([mark("flag", 10, 10, 30)]);
  const tied = objectBounds({ strokes: [], stickers: doc.stickers }, "k-flag");
  check("an arrow can find a sticker to tie to", tied?.w === 30, JSON.stringify(tied));
  check("...and gets null for one that is gone",
    objectBounds({ strokes: [], stickers: doc.stickers }, "k-gone") === null);
}

console.log("\n(3) a sticker never reaches the recogniser");
{
  const doc = page([mark("fire")]);
  const seen = toSvg(doc, { mode: "viewing", text: true });
  const read = toSvg(doc, { mode: "recognition" });
  check("a person looking at the page sees it", seen.includes("paint-order"));
  check("a model reading the page does not", !read.includes("paint-order"), read.slice(0, 200));
  check("...and there is no path of it either", !read.includes(STICKER_ART.fire!.d.slice(0, 40)));
}

console.log("\n(2) the white edge sits BEHIND the picture, not over it");
{
  const svg = toSvg(page([mark("fire")]), { mode: "viewing", text: true });
  check("the die-cut attribute is there", svg.includes('paint-order="stroke fill"'));
  check("...and it is a white stroke", svg.includes('stroke="#FFFFFF"'));

  const withEdge = await count(svg, isRed);
  // The same drawing with the one attribute removed: the stroke then paints
  // OVER the fill and thins the glyph from the outside in.
  const overIt = await count(svg.replace(/ paint-order="stroke fill"/g, ""), isRed);

  check("the flame is actually drawn", withEdge > 2000, String(withEdge));
  check("the edge does NOT eat into the artwork", withEdge > overIt,
    `behind: ${withEdge} red px, over: ${overIt} red px`);
  check("...by a visible margin, not a rounding error",
    withEdge - overIt > withEdge * 0.1,
    `behind: ${withEdge}, over: ${overIt}`);
}

console.log("\nevery sticker in the set renders");
{
  const svg = toSvg(
    page(STICKER_NAMES.map((name, i) => mark(name, (i % 10) * 120, Math.floor(i / 10) * 120, 100))),
    { mode: "viewing", text: true },
  );
  const drawn = (svg.match(/paint-order="stroke fill"/g) ?? []).length;
  check("all of them are in the picture", drawn === STICKER_NAMES.length,
    `${drawn} of ${STICKER_NAMES.length}`);
  const png = await svgToPng(svg);
  check("and the whole sheet rasterises", png.length > 1000, `${png.length} bytes`);
}

console.log(failures === 0
  ? "\nsticker art smoke: all checks passed"
  : `\nsticker art smoke: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
