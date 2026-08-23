import { and, asc, eq, sql } from "drizzle-orm";
import { withActor, blocks, mediaAssets } from "@jotdojo/db";
import { canReachSpace, type Actor } from "./actor";
import { createInkBlock, type InkBlock } from "./ink-block";

/**
 * The ink layer of a note: the one that already exists, or a new one. ADR-047.
 *
 * `createInkBlock` does exactly what it says and makes a NEW block every time,
 * which is right for a model that allows several. It is the wrong thing for the
 * canvas, which has one writing surface per note -- and calling it on every
 * mount is how a page of handwriting stops being rendered: a second, empty
 * block is created, the canvas draws that one, and the strokes are still in the
 * database attached to a block nothing looks at.
 *
 * Nothing is lost when that happens, and that is exactly what makes it bad: it
 * looks like loss, to the person who drew it, and "never lose a thought" is not
 * a promise about rows.
 */
export async function ensureInkBlock(
  actor: Actor, noteId: string, canvas: { w: number; h: number },
): Promise<InkBlock> {
  const existing = await findInkBlock(actor, noteId);
  return existing ?? createInkBlock(actor, noteId, canvas);
}

/**
 * The note's first ink block, if it has one.
 *
 * Ordered by position so "first" means the same thing every time, rather than
 * whichever row the planner happened to return.
 */
export async function findInkBlock(actor: Actor, noteId: string): Promise<InkBlock | null> {
  return withActor(actor.userId, async (tx) => {
    const rows = await tx.select({
      blockId: blocks.id,
      artifactId: mediaAssets.id,
      noteId: blocks.noteId,
      spaceId: blocks.spaceId,
      transcript: blocks.transcript,
      transcriptState: blocks.transcriptState,
      confidence: blocks.confidence,
      width: mediaAssets.width,
      height: mediaAssets.height,
      strokeCount: sql<number>`jsonb_array_length(${mediaAssets.strokes} -> 'strokes')`,
    })
      .from(blocks)
      .innerJoin(mediaAssets, eq(mediaAssets.id, blocks.artifactId))
      .where(and(eq(blocks.noteId, noteId), eq(blocks.kind, "ink")))
      .orderBy(asc(blocks.position))
      .limit(1);

    const row = rows[0];
    if (!row || !canReachSpace(actor, row.spaceId)) return null;

    return {
      blockId: row.blockId,
      artifactId: row.artifactId,
      noteId: row.noteId,
      spaceId: row.spaceId,
      strokeCount: Number(row.strokeCount ?? 0),
      canvas: { w: row.width ?? 0, h: row.height ?? 0 },
      transcript: row.transcript,
      transcriptState: row.transcriptState,
      confidence: row.confidence,
    };
  });
}

/** Whether a note has handwriting on it, so a canvas can mount its ink layer
 *  BEFORE somebody reaches for the pen rather than after. */
export const hasInk = (note: { blocks?: { kind: string }[] }): boolean =>
  note.blocks?.some((b) => b.kind === "ink") ?? false;
