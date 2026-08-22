import { notFound } from "next/navigation";
import {
  getNote, getToolbarSide, hasInk, listNoteComments, NotFound,
} from "@jotdojo/domain";
import { requireActor, currentUser } from "@/lib/session";
import { Canvas } from "@/components/Canvas";
import { Notices } from "@/components/Notices";

export const dynamic = "force-dynamic";

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  const user = await currentUser();

  try {
    const note = await getNote(actor, id);
    return (
      <main>
        <Canvas
          noteId={note.id}
          initialBody={note.body}
          initialRevision={note.revision}
          hasInk={hasInk(note)}
          user={user}
          toolbarPreference={await getToolbarSide(actor)}
        />
        {/* Outside the Canvas on purpose. The canvas is a writing surface and
            has a size limit for a reason; a remark is a visitor to it. */}
        <Notices comments={await listNoteComments(actor, note.id)} />
      </main>
    );
  } catch (err) {
    if (err instanceof NotFound) notFound();
    throw err;
  }
}
