"use server";

/**
 * What the dashboard does to a LIST -- the only place somebody can act on
 * something they are not looking at. Split out of actions.ts at the limit.
 *
 * Renaming a space is issue 003; removing a note and putting it back is 013.
 */

import { revalidatePath } from "next/cache";
import {
  renameSpace, deleteNote, restoreNote, listNotes, nextCursor,
  type Cursor, type ListedNote,
} from "@jotacular/domain";
import { requireActor } from "@/lib/session";

// A "use server" module may only export async functions, so the page size is a
// plain local rather than an export.
const OLDER_PAGE = 50;

export async function renameSpaceAction(spaceId: string, name: string) {
  const renamed = await renameSpace(await requireActor(), spaceId, name);
  revalidatePath("/dashboard");
  return renamed;
}

export async function deleteNoteAction(noteId: string) {
  await deleteNote(await requireActor(), noteId);
  revalidatePath("/dashboard");
}

export async function restoreNoteAction(noteId: string) {
  await restoreNote(await requireActor(), noteId);
  revalidatePath("/dashboard");
}

/**
 * The page after the one on screen. Issue 053.
 *
 * `nextCursor` and `ListOptions.after` have existed since ADR-063 and no screen
 * had ever called them, so a space past the dashboard's limit simply ended.
 */
export async function olderNotesAction(
  spaceId: string, after: Cursor,
): Promise<{ notes: ListedNote[]; cursor: Cursor | null }> {
  const notes = await listNotes(await requireActor(), spaceId, {
    limit: OLDER_PAGE, after,
  });
  return { notes, cursor: nextCursor(notes, OLDER_PAGE) };
}
