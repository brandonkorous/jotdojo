import { DomainError } from "./errors";

/**
 * What an ink document IS, and what a client is allowed to send. docs/08-ink.md.
 *
 * Vectors are the truth and are never flattened to a raster. Strokes are small
 * -- a page of handwriting is tens of kilobytes -- and keeping them means a
 * better recognizer can be run over old notes later, so handwriting from a year
 * ago silently improves. A PNG is a one-way door.
 *
 * Split from ink.ts, which stores these: the shape of a stroke and the storage
 * of a block are different jobs, and only one of them touches a database.
 */

/** [x, y, t, pressure, tiltX, tiltY]. Flat arrays, not objects per point: a
 *  page is thousands of points and the payload difference is large. `t` is
 *  milliseconds from the start of the stroke. */
export type Point = [number, number, number, number, number, number];

export type Stroke = {
  /**
   * Stable identity, so an edit can NAME a stroke. ADR-058.
   *
   * Without it the only way to say "remove this one" is to resend the whole
   * page, which discards anything a second device drew in the meantime. Minted
   * by the client where there is one, and by validateStrokes otherwise, so
   * every stroke in storage has one.
   */
  id: string;
  tool: "pen" | "highlighter";
  color: string;
  width: number;
  pts: Point[];
};

/**
 * A stroke as a CLIENT may send it: the id is optional, and validateStrokes
 * mints one when it is absent.
 *
 * Only a client that intends to edit a stroke later needs to choose its own id,
 * and only the canvas does. The Shortcuts endpoint and the MCP server write
 * strokes too, and neither has any business knowing that erase needs identity.
 */
export type StrokeInput = Omit<Stroke, "id"> & { id?: string };

export type InkDocument = {
  v: 1;
  canvas: { w: number; h: number };
  strokes: Stroke[];
};

/** Generous, and far above a real page. A guard against a runaway client, not
 *  a product limit -- if anyone legitimately hits it, raise it. */
export const MAX_STROKES = 20_000;
const MAX_POINTS_PER_STROKE = 10_000;
export const MAX_BATCH = 200;

const TOOLS = new Set(["pen", "highlighter"]);
const COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * Validate strokes at the boundary rather than trusting the client.
 *
 * These land in a jsonb column that a recognizer, a renderer and eventually a
 * VLM prompt all read. A NaN coordinate or a 40MB point array is not a
 * theoretical problem: it is a rendering crash or a bill, arriving from a
 * device we do not control.
 */
export function validateStrokes(input: unknown): Stroke[] {
  if (!Array.isArray(input)) throw new DomainError("strokes must be an array", "bad_strokes", 400);
  if (input.length > MAX_BATCH) {
    throw new DomainError(`at most ${MAX_BATCH} strokes per batch`, "bad_strokes", 400);
  }

  return input.map((raw, i) => {
    const s = raw as Partial<Stroke>;
    const where = `stroke ${i}`;
    if (!s || typeof s !== "object") throw new DomainError(`${where}: not an object`, "bad_strokes", 400);
    if (!TOOLS.has(String(s.tool))) throw new DomainError(`${where}: unknown tool`, "bad_strokes", 400);
    if (typeof s.color !== "string" || !COLOR.test(s.color)) {
      throw new DomainError(`${where}: color must be #rrggbb`, "bad_strokes", 400);
    }
    if (typeof s.width !== "number" || !Number.isFinite(s.width) || s.width <= 0 || s.width > 200) {
      throw new DomainError(`${where}: implausible width`, "bad_strokes", 400);
    }
    if (!Array.isArray(s.pts) || s.pts.length === 0) {
      throw new DomainError(`${where}: no points`, "bad_strokes", 400);
    }
    if (s.pts.length > MAX_POINTS_PER_STROKE) {
      throw new DomainError(`${where}: too many points`, "bad_strokes", 400);
    }
    for (const p of s.pts) {
      if (!Array.isArray(p) || p.length !== 6 || p.some((n) => typeof n !== "number" || !Number.isFinite(n))) {
        throw new DomainError(`${where}: each point is six finite numbers`, "bad_strokes", 400);
      }
    }
    return {
      id: strokeId(s.id, where),
      tool: s.tool as Stroke["tool"], color: s.color, width: s.width, pts: s.pts as Point[],
    };
  });
}

/**
 * A stroke's id, minted here when the caller did not supply one.
 *
 * Optional on the wire on purpose: the Shortcuts endpoint and the MCP server
 * both write strokes, and neither has any reason to know that erase needs
 * identity. Only a client that intends to EDIT a stroke later needs to choose
 * its own id, and the canvas does.
 */
function strokeId(given: unknown, where: string): string {
  if (given === undefined || given === null) return crypto.randomUUID();
  if (typeof given !== "string" || given.length === 0 || given.length > 64) {
    throw new DomainError(`${where}: id must be a short string`, "bad_strokes", 400);
  }
  return given;
}
