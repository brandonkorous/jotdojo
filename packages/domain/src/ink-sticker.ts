import { DomainError } from "./errors";

/**
 * A sticker: one small picture, stuck on the page. ADR-115.
 *
 * The FIFTH array in the layer document and by far the cheapest. A sticker is
 * a name and a place -- no bytes, no upload, no `blocks` row behind it -- so
 * putting one down costs six fields and nothing else. That is the whole reason
 * it is not an `ImageOnPage`: ink-image.ts requires a `blockId` and says why,
 * and a sticker has nothing to put there.
 *
 * The art is Font Awesome Whiteboard Semibold, the face the whole product
 * already draws in (ADR-083), so a sticker is marked in the same hand as the
 * pen that wrote around it.
 *
 * REACHABLE AS `@jotacular/domain/stickers`, and that subpath is not a
 * convenience. The tray is a client component and needs these names as VALUES,
 * not as types -- and importing the package barrel pulls `export.ts`, then
 * `@jotacular/storage`, then `node:path` into the browser bundle, which fails
 * the build. This file imports `./errors` and nothing else.
 * `@jotacular/ink-render/raster` exists for the same reason.
 *
 * THE NAMES ARE HERE AND THE PATHS ARE NOT. `@jotacular/ink-render` holds the
 * artwork and depends on this package, so the dependency cannot run the other
 * way. Its generator reads this list and refuses to finish if the kit has no
 * icon for a name on it, which is what keeps the two in step.
 */

/**
 * Every sticker the product offers, grouped the way the tray shows them.
 *
 * Named for the PICTURE rather than for a job, which is the opposite of the
 * rule lib/icons.ts follows -- and deliberately. An icon in the chrome is a
 * button whose artwork may be swapped; a sticker IS its picture, and somebody
 * reaching for fire wants fire.
 */
export const STICKER_GROUPS = {
  /** Say something about a thing already on the page. */
  mark: [
    "circle-check", "circle-exclamation", "circle-question", "circle-info",
    "xmark", "flag", "star", "heart", "thumbs-up", "thumbs-down", "fire",
    "bolt", "lightbulb", "clock", "eye", "bookmark", "thumbtack", "lock",
  ],
  /** All four the family has. Whiteboard is a 492-icon face, not Classic, and
   *  it has no clap, no party and no hundred. docs/10-design-system.md. */
  face: ["face-smile", "face-laugh", "face-meh", "face-frown"],
  win: [
    "trophy", "crown", "rocket-launch", "sparkles", "key",
    "bug", "bomb", "skull", "ghost", "poop",
  ],
  work: [
    "money-bill", "circle-dollar", "chart-simple", "chart-pie", "calendar-check",
    "envelope", "phone", "comment", "users", "briefcase", "clipboard-check",
    "file-check", "gear", "code",
  ],
  life: [
    "coffee", "burger", "cake-candles", "martini-glass", "car", "plane-up",
    "sun", "moon", "cloud", "snowflake", "leaf", "flower", "music", "paw",
  ],
  /** Plain shapes, for ringing a region or labelling a key. */
  shape: ["circle", "square", "triangle", "diamond", "rectangle-wide"],
} as const;

export type StickerGroup = keyof typeof STICKER_GROUPS;
export type StickerName = typeof STICKER_GROUPS[StickerGroup][number];

export const STICKER_NAMES: readonly StickerName[] =
  Object.values(STICKER_GROUPS).flat() as StickerName[];

const KNOWN: ReadonlySet<string> = new Set(STICKER_NAMES);

export const isStickerName = (v: unknown): v is StickerName =>
  typeof v === "string" && KNOWN.has(v);

export type Sticker = {
  id: string;
  /** Which picture, from STICKER_NAMES. An unknown name is refused rather than
   *  stored, because a page holding one would draw a hole for ever. */
  name: StickerName;
  /** Top-left, in DOCUMENT units -- the same space strokes live in. */
  x: number;
  y: number;
  /**
   * The side of the square it occupies. ONE number, not a width and a height.
   *
   * Whiteboard glyphs are rarely square -- `fire` is 448x512 -- so the art is
   * fitted inside this box and keeps its own proportions. A sticker that could
   * be squashed would be the one object on the canvas that can be drawn wrong.
   */
  size: number;
  /** The colour of the art. The white border round it is not stored: it is
   *  what makes a sticker a sticker, so it is never off. ADR-115. */
  color: string;
};

/** Cheap enough that this is a guard against a runaway client rather than a
 *  product limit -- the call ink-doc.ts makes about strokes. */
export const MAX_STICKERS = 1_000;
const MAX_SIZE = 10_000;
const MAX_COORD = 1_000_000;
const COLOR = /^#[0-9a-fA-F]{6}$/;

export function validateStickers(input: unknown): Sticker[] {
  if (!Array.isArray(input)) {
    throw new DomainError("stickers must be an array", "bad_stickers", 400);
  }
  if (input.length > MAX_STICKERS) {
    throw new DomainError("too many stickers", "bad_stickers", 400);
  }
  return input.map((raw, i) => one(raw, `sticker ${i}`));
}

function one(raw: unknown, where: string): Sticker {
  const s = raw as Partial<Sticker>;
  if (!s || typeof s !== "object") {
    throw new DomainError(`${where}: not an object`, "bad_stickers", 400);
  }
  if (!isStickerName(s.name)) {
    throw new DomainError(`${where}: unknown sticker "${String(s.name)}"`, "bad_stickers", 400);
  }
  for (const key of ["x", "y"] as const) {
    const v = s[key];
    if (typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > MAX_COORD) {
      throw new DomainError(`${where}: ${key} must be a finite number`, "bad_stickers", 400);
    }
  }
  if (typeof s.size !== "number" || !Number.isFinite(s.size)
    || s.size <= 0 || s.size > MAX_SIZE) {
    throw new DomainError(`${where}: implausible size`, "bad_stickers", 400);
  }
  if (typeof s.color !== "string" || !COLOR.test(s.color)) {
    throw new DomainError(`${where}: color must be #rrggbb`, "bad_stickers", 400);
  }
  return {
    id: shortId(s.id, `${where}: id`),
    name: s.name, x: s.x!, y: s.y!, size: s.size, color: s.color,
  };
}

function shortId(given: unknown, where: string): string {
  if (given === undefined || given === null) return crypto.randomUUID();
  if (typeof given !== "string" || given.length === 0 || given.length > 64) {
    throw new DomainError(`${where} must be a short string`, "bad_stickers", 400);
  }
  return given;
}

/**
 * A word for each sticker, so an arrow tied to one can be read back.
 *
 * `boxNames` does this for typed boxes and `flattenLinks` consumes both. "fire"
 * alone would read as a note somebody wrote, so the kind is said out loud --
 * this codebase never presents a derived fact as an authored one.
 */
export function stickerNames(stickers: readonly Sticker[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const sticker of stickers) names.set(sticker.id, `${sticker.name} sticker`);
  return names;
}

/**
 * The stickers as one line, for the searchable copy an agent reads.
 *
 * Tallied rather than listed, because a page marked with nine fires should say
 * so once. This is what makes "which notes did I flag" a search that works.
 */
export function flattenStickers(stickers: readonly Sticker[]): string {
  if (stickers.length === 0) return "";
  const tally = new Map<StickerName, number>();
  for (const s of stickers) tally.set(s.name, (tally.get(s.name) ?? 0) + 1);
  const parts = [...tally].map(([name, n]) => (n === 1 ? name : `${name} x${n}`));
  const count = stickers.length === 1 ? "1 sticker" : `${stickers.length} stickers`;
  return `_[${count} on the page: ${parts.join(", ")}]_`;
}
