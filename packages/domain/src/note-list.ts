import { eq, sql } from "drizzle-orm";
import { withActor, notes } from "@jotacular/db";
import { canReachSpace, type Actor } from "./actor";
import { Forbidden, NotFound } from "./errors";
import { previewOf, audit } from "./note-body";
import { windowSql, afterSql, type Cursor, type TimeWindow } from "./time-window";
import type { NoteSummary } from "./notes";

/**
 * The list beside the canvas.
 *
 * Split out of notes.ts at the size limit: reaching a note you do NOT have open
 * is a different job from editing the one you do.
 */

export type ListOptions = TimeWindow & {
  limit?: number;
  /** Where the last page stopped. Keyset, not OFFSET. See time-window.ts. */
  after?: Cursor;
};

/** The cursor for the page after this one, or null when there is no more. A
 *  caller should never have to know which columns the order is built from. */
export function nextCursor(page: NoteSummary[], limit: number): Cursor | null {
  if (page.length < limit) return null;
  const last = page[page.length - 1]!;
  return { updatedAt: last.updatedAt, id: last.id, pinned: last.pinned };
}

export async function listNotes(
  actor: Actor, spaceId: string, options: ListOptions | number = {},
): Promise<NoteSummary[]> {
  // A number is the old signature -- `listNotes(actor, space, 25)`. Kept
  // working rather than chased through every caller at once.
  const opts: ListOptions = typeof options === "number" ? { limit: options } : options;
  const limit = opts.limit ?? 50;

  if (!canReachSpace(actor, spaceId)) throw new Forbidden("This connection cannot reach that space");

  return withActor(actor.userId, async (tx) => {
    // The FIRST BLOCK WITH SOMETHING IN IT, not the block at position 0.
    //
    // createNote always makes a text block at position 0, so a note that is
    // nothing but handwriting has an empty one sitting in front of its ink.
    // Joining on position 0 previewed those notes as blank -- a page someone
    // had written on by hand appeared in their list as an untitled empty row,
    // and there was no way to tell it apart from a note they had abandoned.
    //
    // The ORDER BY ends with `id` so the order is TOTAL. Two notes saved in the
    // same millisecond are ordinary, and without a tiebreak a keyset page
    // boundary lands in the middle of them and drops one. ADR-063.
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
         ${windowSql(opts)}
         ${afterSql(opts.after)}
       ORDER BY n.pinned DESC, n.updated_at DESC, n.id DESC
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

/** Soft delete, always. Nothing in jotacular is destroyed. */
export async function deleteNote(actor: Actor, noteId: string): Promise<void> {
  await withActor(actor.userId, async (tx) => {
    const rows = await tx.select({ spaceId: notes.spaceId }).from(notes)
      .where(eq(notes.id, noteId)).limit(1);
    if (!rows[0]) throw new NotFound();
    await tx.update(notes).set({ deletedAt: new Date() }).where(eq(notes.id, noteId));
    await audit(tx, actor, rows[0].spaceId, "note.delete", noteId);
  });
}
