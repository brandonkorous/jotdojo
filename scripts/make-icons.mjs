import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

/**
 * The app icons and the wordmark, generated once and committed. ADR-072.
 *
 *     pnpm icons
 *
 * Source is the vector in `assets/brand/`, so every raster here is derived
 * rather than drawn twice. The wordmark ships as SVG -- it is set at six
 * different sizes across the site and a bitmap would be soft at five of them.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WEB = join(ROOT, "apps", "web");
const SRC = join(ROOT, "assets", "brand");

/** The ink in the artwork. Both marks are drawn dark-on-transparent, which is
 *  the LIGHT variant; the dark variant repaints just the ink. Mint and violet
 *  are never touched -- they are the identifying cues in both directions. */
const INK = { icon: "#14171e", wordmark: "#14181d" };
const TILE = "#111418";

const svg = (name) => readFile(join(SRC, `${name}.svg`), "utf8");

/** Repaint the ink white, leaving the accents alone. A string swap rather than
 *  a pixel pass, because the source is vector and the ink is one exact value. */
const inked = (text, from, to) => text.replaceAll(from, to).replaceAll(from.toUpperCase(), to);

/** The artwork fitted into a box, keeping its proportions. Density is set high
 *  so librsvg rasterises from the vector at size rather than upscaling. */
const raster = (text, box) =>
  sharp(Buffer.from(text), { density: 384 })
    .resize({ width: box, height: box, fit: "inside" })
    .png()
    .toBuffer();

/** One icon: a charcoal ground with the white mark centred on it. */
async function icon(markSvg, size, { radius, scale }) {
  const r = Math.round(size * radius);
  const ground = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">`
    + `<rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${TILE}"/></svg>`,
  );
  const mark = await raster(markSvg, Math.round(size * scale));
  return sharp(ground)
    .composite([{ input: mark, gravity: "centre" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

const ICONS = [
  // The manifest's three. `any` keeps the rounded square the mark has
  // everywhere else; `maskable` gives the launcher a full bleed to cut into,
  // so the mark sits well inside the safe zone.
  { path: ["public", "icon-192.png"], size: 192, radius: 0.225, scale: 0.62 },
  { path: ["public", "icon-512.png"], size: 512, radius: 0.225, scale: 0.62 },
  { path: ["public", "icon-maskable-512.png"], size: 512, radius: 0, scale: 0.46 },
  // Next's file conventions: the browser tab, and the iOS home screen (which
  // applies its own mask, so this one is drawn square).
  { path: ["app", "icon.png"], size: 64, radius: 0.225, scale: 0.66 },
  { path: ["app", "apple-icon.png"], size: 180, radius: 0, scale: 0.62 },
];

/** Open Graph. Charcoal ground, the wordmark, nothing else -- no text is drawn,
 *  so nothing here depends on a font being installed. */
async function opengraph(wordmarkWhite) {
  const [w, h] = [1200, 630];
  const ground = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`
    + `<rect width="${w}" height="${h}" fill="${TILE}"/></svg>`,
  );
  const mark = await sharp(Buffer.from(wordmarkWhite), { density: 384 })
    .resize({ width: 700 }).png().toBuffer();
  return sharp(ground)
    .composite([{ input: mark, gravity: "centre" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function put(parts, buf) {
  const out = join(WEB, ...parts);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, buf);
  console.log(`  ${parts.join("/")}  ${buf.length} bytes`);
}

const iconLight = await svg("icon");
const iconWhite = inked(iconLight, INK.icon, "#ffffff");

for (const spec of ICONS) {
  const png = await icon(iconWhite, spec.size, spec);
  // A source that failed to load would composite nothing and leave a flat
  // charcoal square -- obvious only to somebody who opens the file.
  const { channels } = await sharp(png).stats();
  if (channels.every((c) => c.stdev < 1)) {
    throw new Error(`${spec.path.join("/")} came out flat -- the mark did not draw`);
  }
  await put(spec.path, png);
}

// The wordmark, both ways round, as vector. The mint dot is untouched in each,
// which is the whole identifying cue.
const wordLight = await svg("wordmark");
const wordWhite = inked(wordLight, INK.wordmark, "#ffffff");
await put(["public", "brand", "wordmark.svg"], Buffer.from(wordLight));
await put(["public", "brand", "wordmark-dark.svg"], Buffer.from(wordWhite));
await put(["public", "brand", "mark.svg"], Buffer.from(iconLight));
await put(["app", "opengraph-image.png"], await opengraph(wordWhite));
