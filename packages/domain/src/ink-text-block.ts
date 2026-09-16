import { and, eq, isNotNull, sql } from "drizzle-orm";
import { blocks, type Tx } from "@jotacular/db";
import { boxNames, flattenTexts, type TextBox } from "./ink-text";
import { flattenLinks, type Link } from "./ink-link";
import { queueEmbedding } from "./note-body";

/**
 * The searchable row that shadows the canvas. ADR-065, ADR-108.
 *
 * Split from ink-text.ts when arrows gave the page a second kind of thing to
 * say in words, and the seam is real: ink-text.ts is what a text box IS, and
 * this is the `blocks` row that makes what is on the plane reachable by search,
 * by an embedding and by an agent. Only one of the two touches a database.
 */

/** What the companion row is attached to. */
export type InkPageRef = { noteId: string; spaceId: string; artifactId: string };

/**
 * Keep the searchable copy of the page in step.
 *
 * `blocks.searchable` is `GENERATED ALWAYS AS to_tsvector(coalesce(body, transcript))`,
 * so text living only in jsonb is invisible to lexical search, to embeddings,
 * to `inferTitle` and to `renderBlock`. A companion row makes all four work
 * with no new paths at all.
 *
 * It is identified by its `artifact_id`, which is what separates it from the
 * note's typed SPINE -- the block at position 0 that `readBody` returns and the
 * editor writes back. That distinction is load bearing; see readBody.
 */
export async function syncTextBlock(
  tx: Tx, page: InkPageRef,
  boxes: readonly TextBox[], links: readonly Link[] = [],
): Promise<void> {
  const body = pageText(boxes, links);

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

/**
 * The page in words: what it says, then how it is wired. ADR-108.
 *
 * The arrows come AFTER the notes and are labelled, so a reader is never left
 * to guess whether `Deposit -> Survey` is something somebody typed or something
 * this file worked out from two coordinates.
 */
export function pageText(boxes: readonly TextBox[], links: readonly Link[]): string {
  const words = flattenTexts(boxes);
  const wiring = flattenLinks(links, boxNames(boxes));
  if (!wiring) return words;
  return words ? `${words}\n\n${wiring}` : wiring;
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
