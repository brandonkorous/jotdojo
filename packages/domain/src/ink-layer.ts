import { and, asc, eq, sql } from "drizzle-orm";
import { withActor, blocks, mediaAssets } from "@jotacular/db";
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
      transcriptSource: blocks.transcriptSource,
      confidence: blocks.confidence,
      width: mediaAssets.width,
      height: mediaAssets.height,
      version: mediaAssets.strokesVersion,
      strokeCount: sql<number>`jsonb_array_length(${mediaAssets.strokes} -> 'strokes')`,
      // Counted here rather than fetched, because the canvas only needs to know
      // WHETHER to read the page -- and a page with text and no strokes still
      // has one. ADR-065.
      textCount: sql<number>`coalesce(jsonb_array_length(${mediaAssets.strokes} -> 'texts'), 0)`,
      imageCount: sql<number>`coalesce(jsonb_array_length(${mediaAssets.strokes} -> 'images'), 0)`,
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
      textCount: Number(row.textCount ?? 0),
      imageCount: Number(row.imageCount ?? 0),
      version: Number(row.version ?? 0),
      canvas: { w: row.width ?? 0, h: row.height ?? 0 },
      transcript: row.transcript,
      transcriptState: row.transcriptState,
      transcriptSource: row.transcriptSource,
      confidence: row.confidence,
    };
  });
}

/**
 * Whether a note has anything ON its canvas -- strokes, typed boxes or
 * photographs. ADR-103.
 *
 * It used to be "does a block of kind `ink` exist", which was the same answer
 * while the layer was only created when somebody reached for the pen. ADR-102
 * mounts the layer on every page, so every note has that block and the old test
 * answers yes for a page nobody has touched -- which would silently take away
 * the "Start jotting." prompt that ADR-094 exists to keep.
 *
 * Asked of the page itself, so it cannot drift from what is drawn again.
 */
export async function hasInk(actor: Actor, noteId: string): Promise<boolean> {
  const block = await findInkBlock(actor, noteId);
  if (!block) return false;
  return block.strokeCount > 0 || block.textCount > 0 || block.imageCount > 0;
}
