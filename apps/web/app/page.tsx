import { loadCanvas } from "@jotacular/domain";
import { signedInActor, currentUser, redirectStale } from "@/lib/session";
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
  const actor = await signedInActor();
  const user = await currentUser();

  // One transaction for every read, which also proves the user still exists.
  const canvas = await loadCanvas(actor);
  if (!canvas) return redirectStale();
  const { note, comments, toolbar } = canvas;

  return (
    <main>
      {/* The landing page is the canvas, so this is where "open the app and
          see what your agent noticed" actually has to happen. docs/12, M5. */}
      <CanvasStage noteId={note.id} comments={comments}>
        <Canvas
          noteId={note.id}
          initialBody={note.body}
          initialRevision={note.revision}
          hasInk={canvas.hasInk}
          user={user}
          toolbarPreference={toolbar}
        />
      </CanvasStage>
    </main>
  );
}
