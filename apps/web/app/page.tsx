import {
  listNotes, getNote, createNote, defaultSpaceId, getToolbarSide, hasInk,
  listNoteComments,
} from "@jotdojo/domain";
import { requireActor, currentUser } from "@/lib/session";
import { Canvas } from "@/components/Canvas";
import { CanvasStage } from "@/components/CanvasStage";

// The canvas must reflect what was just written, never a cached shell.
export const dynamic = "force-dynamic";

/**
 * The landing page is the canvas. ADR-008.
 *
 * If there is content it is here; if there is not, the surface is blank and
 * says "Start jotting". Either way the cursor is live with zero clicks.
 */
export default async function Home() {
  const actor = await requireActor();
  const user = await currentUser();

  const spaceId = await defaultSpaceId(actor);
  const recent = await listNotes(actor, spaceId, 1);

  // Reuse the most recent note rather than stacking up empties on every visit.
  const note = recent[0]
    ? await getNote(actor, recent[0].id)
    : await createNote(actor, spaceId, "");

  const preference = await getToolbarSide(actor);

  return (
    <main>
      {/* The landing page is the canvas, so this is where "open the app and
          see what your agent noticed" actually has to happen. docs/12, M5. */}
      <CanvasStage comments={await listNoteComments(actor, note.id)}>
        <Canvas
          noteId={note.id}
          initialBody={note.body}
          initialRevision={note.revision}
          hasInk={hasInk(note)}
          user={user}
          toolbarPreference={preference}
        />
      </CanvasStage>
    </main>
  );
}
