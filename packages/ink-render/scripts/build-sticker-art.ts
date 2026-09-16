import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { STICKER_NAMES } from "@jotacular/domain";

/**
 * Turn the sticker list into path data this package can draw. ADR-115.
 *
 * `packages/ink-render` runs in the worker, where there is no Font Awesome and
 * no npm token -- infra/docker/web.Dockerfile mounts that secret for apps/web
 * alone. So the artwork is EXTRACTED ONCE and checked in, and this is what
 * does the extracting.
 *
 * Run it on a laptop that has the kit installed:
 *
 *     pnpm --filter @jotacular/ink-render stickers:build
 *
 * It reads the names from `@jotacular/domain` and REFUSES to write anything if
 * the kit has no icon for one of them. That refusal is the point: it is the
 * only thing stopping the two lists drifting into a page that draws a hole.
 */

const ROOT = resolve(import.meta.dirname, "../../..");
const OUT = resolve(import.meta.dirname, "../src/sticker-art.ts");
const FAMILY = "whiteboard-semibold";

/**
 * Where the kit unpacked to. `@awesome.me+kit-abc@1.0.2` in the pnpm store is
 * the package `@awesome.me/kit-abc` -- strip the version, swap the separator.
 */
function kitIcons(): string {
  const store = join(ROOT, "node_modules/.pnpm");
  if (!existsSync(store)) fail(`no pnpm store at ${store}. Run pnpm install first.`);
  const dir = readdirSync(store).find((d) => d.startsWith("@awesome.me+kit-"));
  if (!dir) fail("no @awesome.me kit installed. This needs FONTAWESOME_NPM_TOKEN.");
  const pkg = dir!.replace(/@[^@]+$/, "").replace("+", "/");
  const icons = join(store, dir!, "node_modules", pkg, "icons/svgs", FAMILY);
  if (!existsSync(icons)) fail(`no ${FAMILY} icons at ${icons}`);
  return icons;
}

/** A kit SVG is one viewBox and one path. Parsed rather than imported, because
 *  importing it would make this package depend on the kit. */
function artFor(icons: string, name: string): { w: number; h: number; d: string } {
  const file = join(icons, `${name}.svg`);
  if (!existsSync(file)) fail(`${FAMILY} has no icon called "${name}"`);
  const svg = readFileSync(file, "utf8");
  const box = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(svg);
  const path = /<path[^>]*\sd="([^"]+)"/.exec(svg);
  if (!box || !path) fail(`${name}.svg is not the shape this script expects`);
  return { w: Number(box![1]), h: Number(box![2]), d: path![1]! };
}

function fail(why: string): never {
  console.error(`\nsticker art: ${why}\n`);
  process.exit(1);
}

const icons = kitIcons();
const entries = STICKER_NAMES.map((name) => {
  const { w, h, d } = artFor(icons, name);
  return `  "${name}": { w: ${w}, h: ${h}, d: ${JSON.stringify(d)} },`;
});

const header = `// GENERATED FILE -- do not edit by hand.
// Run: pnpm --filter @jotacular/ink-render stickers:build
//
// Font Awesome Pro 7.3.1, ${FAMILY}, (c) Fonticons, Inc. Extracted from the
// kit because the worker has neither the package nor the token. ADR-115.

/** One sticker's artwork: its own viewBox, and the single path that draws it. */
export type StickerArt = { readonly w: number; readonly h: number; readonly d: string };

export const STICKER_ART: Readonly<Record<string, StickerArt>> = {
`;

writeFileSync(OUT, `${header}${entries.join("\n")}\n};\n`, "utf8");
console.log(`sticker art: wrote ${entries.length} icons to src/sticker-art.ts`);
