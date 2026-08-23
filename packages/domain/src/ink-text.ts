import { and, eq, isNotNull, sql } from "drizzle-orm";
import { blocks, type Tx } from "@jotacular/db";
import { DomainError } from "./errors";
import { queueEmbedding } from "./note-body";

/**
 * Typed text, on the canvas rather than under it. ADR-065.
 *
 * A text box lives in the note's LAYER DOCUMENT, beside the strokes, and not as
 * a `blocks` row. The obvious choice is the row, and it breaks live
 * collaboration: `useNoteBody`'s `adopt()` refuses a remote revision while
 * dirty, and with N boxes sharing one `notes.revision`, "dirty" means *any box
 * is mid-edit*. Somebody moving box A is silently dropped because you are
 * typing in box B. N objects contending on one optimistic counter is a conflict
 * machine.
 *
 * In the layer they inherit ADR-058 whole: id-named objects, commutative
 * deltas, one version, one subscription, `mergePages` folding the upload queue
 * back in.
 *
 * A SECOND ARRAY, not one polymorphic list. `toSvg` renders `doc.strokes`, so
 * typed text cannot reach the recogniser by accident -- and if it did, the
 * model would read it back as handwriting and replace a certainty with a
 * confidence-scored guess. Keeping the arrays apart makes that impossible
 * rather than merely unlikely.
 */

export type TextBox = {
  id: string;
  /** Top-left, in DOCUMENT units -- the same space strokes live in. */
  x: number;
  y: number;
  /** Width in document units. */
  w: number;
  /**
   * Height in document units, when somebody drew one. Absent means "whatever
   * the text needs", which is what every box before ADR-078 stored.
   *
   * AUTHORITATIVE WHEN PRESENT, and that is the point of it. Without a height
   * the browser and the renderer each estimate one from a character-width
   * guess, and they are free to disagree -- invisibly, until something is drawn
   * at the box's edge. A stored height is one number both of them read.
   *
   * It is a FLOOR, never a ceiling: text that outgrows it grows the box. A
   * capture surface may not hide a word somebody typed behind an overflow.
   */
  h?: number;
  text: string;
  /** Size in document units at k=1, so a box keeps its size as the camera moves. */
  size: number;
  color: string;
  /**
   * The card colour behind the words, when there is one. ADR-079.
   *
   * Absent is a plain note on the canvas -- transparent, exactly as every box
   * before ADR-079. Set makes it a card, and the ink is DERIVED from this by
   * luminance rather than stored, so a card can never be saved with text
   * nobody can read on it.
   *
   * A field on the same object rather than a second kind of object: a card is
   * a text box with a colour behind it, and giving it its own kind would
   * duplicate the reading order, the delta protocol and the export path to say
   * so.
   */
  fill?: string;
};

export const MAX_TEXTS = 2_000;
const MAX_TEXT_LENGTH = 20_000;
const COLOR = /^#[0-9a-fA-F]{6}$/;

export function validateTexts(input: unknown): TextBox[] {
  if (!Array.isArray(input)) throw new DomainError("texts must be an array", "bad_texts", 400);
  if (input.length > MAX_TEXTS) throw new DomainError("too many text boxes", "bad_texts", 400);

  return input.map((raw, i) => {
    const t = raw as Partial<TextBox>;
    const where = `text ${i}`;
    if (!t || typeof t !== "object") throw new DomainError(`${where}: not an object`, "bad_texts", 400);
    if (typeof t.text !== "string" || t.text.length > MAX_TEXT_LENGTH) {
      throw new DomainError(`${where}: text must be a string under ${MAX_TEXT_LENGTH}`, "bad_texts", 400);
    }
    if (typeof t.color !== "string" || !COLOR.test(t.color)) {
      throw new DomainError(`${where}: color must be #rrggbb`, "bad_texts", 400);
    }
    for (const key of ["x", "y", "w", "size"] as const) {
      const v = t[key];
      if (typeof v !== "number" || !Number.isFinite(v)) {
        throw new DomainError(`${where}: ${key} must be a finite number`, "bad_texts", 400);
      }
    }
    if (t.w! <= 0 || t.size! <= 0 || t.size! > 2_000) {
      throw new DomainError(`${where}: implausible size`, "bad_texts", 400);
    }
    // Optional, because every box written before ADR-078 has no height at all.
    // Rejecting those would make an old page unreadable rather than unstyled.
    const h = optionalHeight(t.h, where);
    // Same shape as `color`, and optional for the same reason `h` is: a plain
    // note has no card behind it and never did.
    if (t.fill !== undefined && t.fill !== null
      && (typeof t.fill !== "string" || !COLOR.test(t.fill))) {
      throw new DomainError(`${where}: fill must be #rrggbb`, "bad_texts", 400);
    }
    return {
      id: textId(t.id, where),
      x: t.x!, y: t.y!, w: t.w!, size: t.size!,
      ...(h === undefined ? {} : { h }),
      ...(t.fill ? { fill: t.fill } : {}),
      text: t.text, color: t.color,
    };
  });
}

const MAX_BOX = 100_000;

function optionalHeight(given: unknown, where: string): number | undefined {
  if (given === undefined || given === null) return undefined;
  if (typeof given !== "number" || !Number.isFinite(given) || given <= 0 || given > MAX_BOX) {
    throw new DomainError(`${where}: h must be a positive number under ${MAX_BOX}`, "bad_texts", 400);
  }
  return given;
}

function textId(given: unknown, where: string): string {
  if (given === undefined || given === null) return crypto.randomUUID();
  if (typeof given !== "string" || given.length === 0 || given.length > 64) {
    throw new DomainError(`${where}: id must be a short string`, "bad_texts", 400);
  }
  return given;
}

/**
 * Which box comes first, on a surface where nothing comes first.
 *
 * Scattered boxes have no inherent order, so one is derived: top to bottom,
 * then left to right, with ROW BANDING so a two-column layout does not
 * interleave into nonsense. `tiles.ts` solves the same problem for recognition
 * and this follows its rule rather than inventing a second one.
 *
 * The band is a multiple of the box's own text size, so it scales with how big
 * somebody was writing rather than with an absolute that means different things
 * at different zooms.
 */
export function readingOrder(boxes: readonly TextBox[]): TextBox[] {
  if (boxes.length === 0) return [];
  const band = Math.max(...boxes.map((b) => b.size)) * 1.5;
  return [...boxes].sort((a, b) => {
    const rowA = Math.floor(a.y / band);
    const rowB = Math.floor(b.y / band);
    if (rowA !== rowB) return rowA - rowB;
    if (a.x !== b.x) return a.x - b.x;
    // A total order, so two boxes at the same point do not swap between reads
    // and rewrite the flattened block for no reason.
    return a.id < b.id ? -1 : 1;
  });
}

/**
 * The boxes as one string, with the order said out loud.
 *
 * This codebase never presents a derived fact as an authored one -- `partOf()`
 * marks coverage, `> [handwritten, confidence 0.82]` marks provenance -- so the
 * flattened text says once, at the top, that the sequence is spatial and not
 * something anybody chose.
 */
export function flattenTexts(boxes: readonly TextBox[]): string {
  const ordered = readingOrder(boxes).map((b) => b.text.trim()).filter(Boolean);
  if (ordered.length === 0) return "";
  if (ordered.length === 1) return ordered[0]!;
  return `_[${ordered.length} text boxes, read top to bottom and left to right]_\n\n`
    + ordered.join("\n\n");
}

/**
 * Keep the searchable copy of the boxes in step. ADR-065.
 *
 * `blocks.searchable` is `GENERATED ALWAYS AS to_tsvector(coalesce(body, transcript))`,
 * so text living only in jsonb is invisible to lexical search, to embeddings,
 * to `inferTitle` and to `renderBlock`. A companion row makes all four work with
 * no new paths at all.
 *
 * It is identified by its `artifact_id`, which is what separates it from the
 * note's typed SPINE -- the block at position 0 that `readBody` returns and the
 * editor writes back. That distinction is load bearing; see readBody.
 */
export async function syncTextBlock(
  tx: Tx, page: { noteId: string; spaceId: string; artifactId: string },
  boxes: readonly TextBox[],
): Promise<void> {
  const body = flattenTexts(boxes);

  const existing = await tx.select({ id: blocks.id }).from(blocks)
    .where(and(
      eq(blocks.noteId, page.noteId),
      eq(blocks.kind, "text"),
      eq(blocks.artifactId, page.artifactId),
    )).limit(1);

  if (existing[0]) {
    await tx.update(blocks).set({ body }).where(eq(blocks.id, existing[0].id));
  } else {
    // Nothing to index and nothing to create. A row whose body is empty would
    // still be joined by readBlocks and rendered as a blank paragraph.
    if (!body) return;
    const position = await nextPosition(tx, page.noteId);
    await tx.insert(blocks).values({
      noteId: page.noteId, spaceId: page.spaceId, position, kind: "text",
      artifactId: page.artifactId, body, transcriptState: "ready",
    });
  }

  // Same coalesced queue the typed spine uses. Without this the boxes are
  // findable lexically and invisible to semantic search, which looks like a
  // ranking quirk rather than a missing row.
  if (body) await queueEmbedding(tx, page.noteId, 0);
}

async function nextPosition(tx: Tx, noteId: string): Promise<number> {
  const rows = await tx.execute(
    sql`SELECT coalesce(max(position), -1) + 1 AS next FROM blocks WHERE note_id = ${noteId}`,
  );
  return Number((rows as unknown as Array<{ next: number }>)[0]?.next ?? 0);
}

/** Whether a note has any canvas text at all, for callers deciding whether to
 *  mount the object plane before somebody reaches for it. */
export const hasTextBlocks = async (tx: Tx, noteId: string): Promise<boolean> =>
  (await tx.select({ id: blocks.id }).from(blocks)
    .where(and(eq(blocks.noteId, noteId), eq(blocks.kind, "text"), isNotNull(blocks.artifactId)))
    .limit(1)).length > 0;
