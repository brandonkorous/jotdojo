import { saveNote, RevisionConflict, asUser, type Actor } from "@jotacular/domain";
import { auth } from "@/auth";
import { currentDraft } from "@/lib/draft";

/**
 * Last-gasp save when a tab is hidden or closed mid-thought.
 *
 * sendBeacon gives us no response to act on, so this is best effort by design:
 * a conflict here is not an error worth reporting, because the canvas will
 * reconcile on next load. Losing the final few characters of a thought is the
 * thing we are actually preventing.
 *
 * An anonymous draft gets the same treatment. The promise does not have an
 * asterisk for people who have not signed in. ADR-039.
 */
export async function POST(request: Request) {
  const actor = await beaconActor();
  if (!actor) return new Response(null, { status: 401 });

  try {
    const { noteId, body, revision } = await request.json();
    await saveNote(actor, String(noteId), String(body), Number(revision));
  } catch (err) {
    if (!(err instanceof RevisionConflict)) {
      console.error("capture-beacon failed", err);
    }
  }
  return new Response(null, { status: 204 });
}

/** No redirect: a beacon has nowhere to be sent and nothing to follow one. */
async function beaconActor(): Promise<Actor | null> {
  const session = await auth();
  if (session?.user?.id) return asUser(session.user.id);
  return (await currentDraft())?.actor ?? null;
}
