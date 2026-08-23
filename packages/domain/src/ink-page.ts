import { sql } from "drizzle-orm";
import { type Tx } from "@jotdojo/db";
import { NotFound } from "./errors";
import { type Stroke } from "./ink-doc";

/**
 * Taking hold of an ink page, and putting it back. docs/08-ink.md, ADR-058.
 *
 * Both write paths -- appending strokes and applying a delta -- are a
 * read-modify-write on one jsonb document, and two devices drawing on one page
 * is now the expected case rather than an edge one. The row lock is what makes
 * that safe, and it lives here so neither path can forget it.
 */

export type LockedPage = {
  blockId: string;
  spaceId: string;
  noteId: string;
  artifactId: string;
  /** How many strokes the page holds. Cheap: read without the document. */
  count: number;
  version: number;
};

/**
 * Lock the page and report its size, WITHOUT reading the strokes.
 *
 * The append path runs every two seconds while somebody writes, and a page of
 * handwriting is tens of kilobytes. Pulling the whole document across the wire
 * to learn its length would make the commonest write the most expensive one.
 */
export async function lockPageCount(tx: Tx, blockId: string): Promise<LockedPage> {
  const rows = await tx.execute(sql`
    SELECT b.id AS block_id, b.space_id, b.note_id, a.id AS artifact_id,
           a.strokes_version AS version,
           jsonb_array_length(a.strokes -> 'strokes') AS count
      FROM blocks b
      JOIN media_assets a ON a.id = b.artifact_id
     WHERE b.id = ${blockId} AND b.kind = 'ink'
       FOR UPDATE OF a
  `);
  return shape(rows);
}

/** Lock the page and read it. For edits, which have to see what they change. */
export async function lockPage(tx: Tx, blockId: string): Promise<LockedPage & { strokes: Stroke[] }> {
  const rows = await tx.execute(sql`
    SELECT b.id AS block_id, b.space_id, b.note_id, a.id AS artifact_id,
           a.strokes_version AS version,
           jsonb_array_length(a.strokes -> 'strokes') AS count,
           a.strokes -> 'strokes' AS page
      FROM blocks b
      JOIN media_assets a ON a.id = b.artifact_id
     WHERE b.id = ${blockId} AND b.kind = 'ink'
       FOR UPDATE OF a
  `);
  const page = shape(rows);
  const row = (rows as unknown as Array<Record<string, unknown>>)[0]!;
  return { ...page, strokes: (row.page as Stroke[] | null) ?? [] };
}

/**
 * Lock the page and prove the caller may touch it.
 *
 * The reach check is separate from row-level security and cannot be dropped: an
 * agent granted one space must not write to another the same person happens to
 * belong to. Same 404 either way -- a different error would confirm the block
 * exists.
 */
export async function lockReachable(
  tx: Tx, actor: { userId: string }, blockId: string,
  reaches: (spaceId: string) => boolean,
): Promise<LockedPage> {
  const page = await lockPageCount(tx, blockId);
  if (!reaches(page.spaceId)) {
    throw new NotFound("That ink block does not exist, or you cannot reach it");
  }
  return page;
}

/**
 * Every stroke id on the page.
 *
 * Only read on the rare path where a batch arrives behind the page -- two
 * devices writing at once -- so it is allowed to scan. The common append never
 * calls it.
 */
export async function pageIds(tx: Tx, artifactId: string): Promise<Set<string>> {
  const rows = await tx.execute(sql`
    SELECT coalesce(array_agg(s ->> 'id'), '{}') AS ids
      FROM media_assets a, jsonb_array_elements(a.strokes -> 'strokes') s
     WHERE a.id = ${artifactId}
  `);
  const ids = (rows as unknown as Array<{ ids: string[] | null }>)[0]?.ids ?? [];
  return new Set(ids.filter(Boolean));
}

/** Add to the end. The version moves even though the count is enough to
 *  describe the change, so followers have one number to compare. */
export async function appendToPage(
  tx: Tx, artifactId: string, strokes: Stroke[],
): Promise<number> {
  return write(tx, artifactId, sql`(strokes -> 'strokes') || ${JSON.stringify(strokes)}::jsonb`);
}

/** Replace the page wholesale. Erase, move, recolour, and clearing it. */
export async function bumpPage(
  tx: Tx, artifactId: string, strokes: Stroke[],
): Promise<number> {
  return write(tx, artifactId, sql`${JSON.stringify(strokes)}::jsonb`);
}

async function write(tx: Tx, artifactId: string, next: ReturnType<typeof sql>): Promise<number> {
  const rows = await tx.execute(sql`
    UPDATE media_assets
       SET strokes = jsonb_set(strokes, '{strokes}', ${next}),
           strokes_version = strokes_version + 1
     WHERE id = ${artifactId}
    RETURNING strokes_version AS version
  `);
  return Number((rows as unknown as Array<{ version: number }>)[0]?.version ?? 0);
}

function shape(rows: unknown): LockedPage {
  const row = (rows as Array<Record<string, unknown>>)[0];
  if (!row) throw new NotFound("That ink block does not exist, or you cannot reach it");
  return {
    blockId: String(row.block_id),
    spaceId: String(row.space_id),
    noteId: String(row.note_id),
    artifactId: String(row.artifact_id),
    count: Number(row.count ?? 0),
    version: Number(row.version ?? 0),
  };
}
