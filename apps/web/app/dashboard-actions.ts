"use server";

/**
 * What the dashboard does to a LIST -- the only place somebody can act on
 * something they are not looking at. Split out of actions.ts at the limit.
 *
 * Renaming a space is issue 003; removing a note and putting it back is 013.
 */

import { revalidatePath } from "next/cache";
import { renameSpace, deleteNote, restoreNote } from "@jotacular/domain";
import { requireActor } from "@/lib/session";

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
