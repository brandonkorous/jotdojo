import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { withActor, notes, blocks } from "@jotdojo/db";
import { canReachSpace, hasScope, type Actor } from "./actor";
import { Forbidden, NotFound } from "./errors";
import { assertMember } from "./spaces";
import { previewOf, audit } from "./note-body";
import type { NoteSummary } from "./notes";

/**
 * The list beside the canvas.
 *
 * Split out of notes.ts at the size limit: reaching a note you do NOT have open
 * is a different job from editing the one you do.
 */

export async function listNotes(
  actor: Actor, spaceId: string, limit = 50,
): Promise<NoteSummary[]> {
  if (!canReachSpace(actor, spaceId)) throw new Forbidden("This connection cannot reach that space");

  return withActor(actor.userId, async (tx) => {
    // The FIRST BLOCK WITH SOMETHING IN IT, not the block at position 0.
    //
    // createNote always makes a text block at position 0, so a note that is
    // nothing but handwriting has an empty one sitting in front of its ink.
    // Joining on position 0 previewed those notes as blank -- a page someone
    // had written on by hand appeared in their list as an untitled empty row,
    // and there was no way to tell it apart from a note they had abandoned.
    const rows = await tx.execute(sql`
      SELECT n.id, n.title, n.pinned, n.updated_at, n.revision,
             coalesce(first_block.content, '') AS preview
        FROM notes n
        LEFT JOIN LATERAL (
          SELECT coalesce(b.body, b.transcript) AS content
            FROM blocks b
           WHERE b.note_id = n.id
             AND coalesce(b.body, b.transcript, '') <> ''
           ORDER BY b.position
           LIMIT 1
        ) first_block ON true
       WHERE n.space_id = ${spaceId}
         AND n.deleted_at IS NULL
         AND n.archived_at IS NULL
       ORDER BY n.pinned DESC, n.updated_at DESC
       LIMIT ${limit}
    `);

    return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      title: (r.title as string | null) ?? null,
      preview: previewOf(String(r.preview ?? "")),
      pinned: Boolean(r.pinned),
      updatedAt: new Date(String(r.updated_at)),
      revision: Number(r.revision),
    }));
  });
}

/** Soft delete, always. Nothing in jotdojo is destroyed. */
export async function deleteNote(actor: Actor, noteId: string): Promise<void> {
  await withActor(actor.userId, async (tx) => {
    const rows = await tx.select({ spaceId: notes.spaceId }).from(notes)
      .where(eq(notes.id, noteId)).limit(1);
    if (!rows[0]) throw new NotFound();
    await tx.update(notes).set({ deletedAt: new Date() }).where(eq(notes.id, noteId));
    await audit(tx, actor, rows[0].spaceId, "note.delete", noteId);
  });
}
