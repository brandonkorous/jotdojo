import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

/**
 * The app icons, generated once and committed.
 *
 *     node scripts/make-icons.mjs
 *
 * A one-shot generator rather than a build step: these are the same four bytes
 * every time, and a home screen icon that depends on a font being installed on
 * whichever machine ran the build is a home screen icon that will one day come
 * out blank. The PNGs are the artifact; this file is the record of how.
 *
 * The mark is the seal from docs/10-design-system.md -- vermillion, one per
 * screen, and the only place the accent colour is allowed to be a whole shape.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WEB = join(ROOT, "apps", "web");

const VERMILLION = "#E0432F";
const PAPER = "#FBFAF6";
const GLYPH = "覚";

/** Whatever this machine has that can draw the glyph. Windows first, because
 *  that is where it was generated; the rest are for anyone regenerating it. */
const FONTS = "Yu Gothic, Meiryo, MS Gothic, Hiragino Sans, "
  + "Noto Sans CJK JP, Noto Sans JP, sans-serif";

/**
 * The glyph alone, trimmed to its own ink.
 *
 * Centring by `dominant-baseline` puts the mark wherever the font's metrics
 * happen to sit -- with the first font this reached, noticeably high and left.
 * Rendering it big, cropping to the pixels it actually drew, and centring THAT
 * is font-independent, which matters for a file somebody may regenerate on a
 * different machine years from now.
 */
async function glyph(box) {
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">`
    + `<text x="50%" y="50%" font-family="${FONTS}" font-size="620"`
    + ` fill="${PAPER}" text-anchor="middle" dominant-baseline="central">${GLYPH}</text>`
    + `</svg>`,
  );
  const inked = await sharp(svg).png().trim({ threshold: 1 }).toBuffer();
  const { width, height } = await sharp(inked).metadata();
  if (!width || !height) throw new Error(`no font here can draw ${GLYPH}`);
  // Set well inside the 1024 canvas above, because a glyph drawn at the size
  // of its own canvas gets CLIPPED by it -- and the trim then crops tight to
  // the clipped shape, which quietly loses the two strokes over the head.
  if (width > 900 || height > 900) throw new Error("the mark is clipping its canvas");
  // Fit the longer side to the box, so a glyph that is not square keeps its
  // proportions and still sits inside the space it was given.
  return sharp(inked)
    .resize({ width: box, height: box, fit: "inside" })
    .png()
    .toBuffer();
}

/** One square: vermillion ground, the mark centred on it. */
async function seal(size, { radius, scale }) {
  const r = Math.round(size * radius);
  const ground = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">`
    + `<rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${VERMILLION}"/>`
    + `</svg>`,
  );
  const mark = await glyph(Math.round(size * scale));
  return sharp(ground)
    .composite([{ input: mark, gravity: "centre" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

const ICONS = [
  // The manifest's three. `any` keeps the rounded square it has everywhere else
  // in the product; `maskable` gives the launcher a full bleed to cut into.
  { path: ["public", "icon-192.png"], size: 192, radius: 0.225, scale: 0.52 },
  { path: ["public", "icon-512.png"], size: 512, radius: 0.225, scale: 0.52 },
  { path: ["public", "icon-maskable-512.png"], size: 512, radius: 0, scale: 0.4 },
  // Next's file conventions: the browser tab and the iOS home screen.
  { path: ["app", "icon.png"], size: 64, radius: 0.225, scale: 0.62 },
  { path: ["app", "apple-icon.png"], size: 180, radius: 0, scale: 0.52 },
];

for (const icon of ICONS) {
  const out = join(WEB, ...icon.path);
  await mkdir(dirname(out), { recursive: true });
  const png = await seal(icon.size, icon);

  // A missing font draws the ground and silently drops the mark, which looks
  // like a plain red square and is only obvious to somebody who opens the file.
  const { channels } = await sharp(png).stats();
  if (channels.every((c) => c.stdev < 1)) {
    throw new Error(`${icon.path.join("/")} came out flat -- the mark did not draw`);
  }

  await writeFile(out, png);
  console.log(`  ${icon.path.join("/")}  ${icon.size}px  ${png.length} bytes`);
}
