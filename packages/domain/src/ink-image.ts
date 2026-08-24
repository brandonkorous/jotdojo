import { DomainError } from "./errors";

/**
 * A photograph, ON the canvas rather than in a tray beside it. ADR-103.
 *
 * Photos were `blocks` rows and nothing else, so a picture somebody took landed
 * in a strip along the bottom of the page: it could not be moved, could not be
 * drawn on, could not be put next to the note it was about, and it ate 40% of a
 * phone screen to say so.
 *
 * THE BYTES STAY IN THE BLOCK. This is only WHERE the picture sits, and the
 * split is the whole design: `blocks` owns the file, the upload, the vision
 * transcript and the search index, and none of that wants to be re-uploaded
 * because somebody nudged a photo two centimetres left.
 *
 * The placement lives in the LAYER DOCUMENT beside the strokes and the text
 * boxes, which is what makes it move, scale, lasso and merge -- ADR-065 gives
 * the reasoning in full, and every word of it applies here. A `blocks` row per
 * placement would put N objects on one optimistic counter, which is the
 * conflict machine that ADR explicitly refused.
 */
export type ImageOnPage = {
  /** The PLACEMENT's identity, not the picture's. One photo may be put on a
   *  page twice, and dragging one copy must not drag the other. */
  id: string;
  /** The `blocks` row holding the bytes and the caption. */
  blockId: string;
  /** Top-left, in DOCUMENT units -- the same space strokes live in. */
  x: number;
  y: number;
  w: number;
  h: number;
};

export const MAX_IMAGES = 500;
/** Far above a real page, and a guard against a runaway client rather than a
 *  product limit -- the same call ink-doc.ts makes about strokes. */
const MAX_SIDE = 100_000;

export function validateImages(input: unknown): ImageOnPage[] {
  if (!Array.isArray(input)) {
    throw new DomainError("images must be an array", "bad_images", 400);
  }
  if (input.length > MAX_IMAGES) {
    throw new DomainError("too many images", "bad_images", 400);
  }
  return input.map((raw, i) => one(raw, `image ${i}`));
}

function one(raw: unknown, where: string): ImageOnPage {
  const p = raw as Partial<ImageOnPage>;
  if (!p || typeof p !== "object") {
    throw new DomainError(`${where}: not an object`, "bad_images", 400);
  }
  for (const key of ["x", "y", "w", "h"] as const) {
    const v = p[key];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      throw new DomainError(`${where}: ${key} must be a finite number`, "bad_images", 400);
    }
  }
  if (p.w! <= 0 || p.h! <= 0 || p.w! > MAX_SIDE || p.h! > MAX_SIDE) {
    throw new DomainError(`${where}: implausible size`, "bad_images", 400);
  }
  return {
    id: shortId(p.id, `${where}: id`),
    // NOT optional and never minted here: a placement with no block behind it
    // is a hole on the page that nothing can ever fill in.
    blockId: shortId(p.blockId, `${where}: blockId`, false),
    x: p.x!, y: p.y!, w: p.w!, h: p.h!,
  };
}

function shortId(given: unknown, where: string, mint = true): string {
  if ((given === undefined || given === null) && mint) return crypto.randomUUID();
  if (typeof given !== "string" || given.length === 0 || given.length > 64) {
    throw new DomainError(`${where} must be a short string`, "bad_images", 400);
  }
  return given;
}
