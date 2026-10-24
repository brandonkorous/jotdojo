import { withActor } from "@jotacular/db";
import type { Actor } from "./actor";
import { actorExists, defaultSpaceId, getToolbarSide, type ToolbarSide } from "./spaces";
import { createNote, getNote, listNotes, type NoteDetail } from "./notes";
import { listNoteComments, type CommentView } from "./comments";
import { hasInk } from "./ink-layer";

export type CanvasLoad = {
  note: NoteDetail;
  comments: CommentView[];
  hasInk: boolean;
  toolbar: ToolbarSide;
};

/**
 * Everything the landing canvas reads, in ONE transaction.
 *
 * Each domain call opens its own transaction unless one is already open for the
 * actor, so wrapping them here turns seven round trips into one. Null means the
 * session names a user who is gone.
 */
export async function loadCanvas(actor: Actor): Promise<CanvasLoad | null> {
  return withActor(actor.userId, async () => {
    if (!(await actorExists(actor))) return null;

    const spaceId = await defaultSpaceId(actor);
    const recent = await listNotes(actor, spaceId, 1);
    // Reuse the most recent note rather than stacking up empties on every visit.
    const note = recent[0] ? await getNote(actor, recent[0].id) : await createNote(actor, spaceId, "");

    return {
      note,
      comments: await listNoteComments(actor, note.id),
      hasInk: await hasInk(actor, note.id),
      toolbar: await getToolbarSide(actor),
    };
  });
}
