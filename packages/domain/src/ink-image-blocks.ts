import { and, asc, eq, isNotNull } from "drizzle-orm";
import { withActor, blocks, mediaAssets } from "@jotacular/db";
import { canReachSpace, type Actor } from "./actor";

/**
 * Every photograph attached to a note, with the size it actually is. ADR-103.
 *
 * This exists for ONE reason and it is worth stating plainly: photographs taken
 * before placements existed have a `blocks` row and nowhere to be. Without this
 * they are still stored, still transcribed and still searchable -- and
 * invisible on the page somebody took them for, which reads as loss whatever
 * the database says.
 *
 * The canvas asks once on mount, places whatever it has no placement for, and
 * from then on this returns nothing new.
 */
export type NoteImage = {
  blockId: string;
  /** Null on anything uploaded before the client measured its own photos. The
   *  canvas places those at a default and lets `object-fit` letterbox them
   *  rather than guessing an aspect ratio and stretching somebody's picture. */
  width: number | null;
  height: number | null;
};

export async function noteImages(actor: Actor, noteId: string): Promise<NoteImage[]> {
  return withActor(actor.userId, async (tx) => {
    const rows = await tx.select({
      blockId: blocks.id,
      spaceId: blocks.spaceId,
      width: mediaAssets.width,
      height: mediaAssets.height,
    })
      .from(blocks)
      .innerJoin(mediaAssets, eq(mediaAssets.id, blocks.artifactId))
      // FINALIZED ONLY. Asking for an upload slot writes the block and the
      // asset row before a single byte is sent, so a capture that failed on
      // the wire leaves one behind with no photograph in it. Adopting those
      // put empty rectangles on the page -- a picture of nothing, which is
      // worse than the tray this replaced. `byteSize` is set by
      // `finalizeMedia` and by nothing else, which makes it the honest test.
      .where(and(
        eq(blocks.noteId, noteId),
        eq(blocks.kind, "image"),
        isNotNull(mediaAssets.byteSize),
      ))
      .orderBy(asc(blocks.position));

    return rows
      .filter((r) => canReachSpace(actor, r.spaceId))
      .map((r) => ({ blockId: r.blockId, width: r.width, height: r.height }));
  });
}
