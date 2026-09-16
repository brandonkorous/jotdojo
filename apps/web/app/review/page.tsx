import Link from "next/link";
import { listAgentChanges } from "@jotacular/domain";
import { requireActor } from "@/lib/session";
import { ReviewList } from "@/components/ReviewList";

export const dynamic = "force-dynamic";

/**
 * What agents have done to your notes. ADR-004, ADR-037, issue 029.
 *
 * `/oauth/authorize` promises "nothing an agent does to your notes is
 * permanent", and until this page existed that promise had nowhere to land:
 * `listAgentChanges` and `revertRevision` were complete, tested and called only
 * by a smoke script.
 *
 * Every space, not one — an agent may be granted several, and "what has this
 * thing been doing" is not a question anybody asks a space at a time.
 */
export default async function Review() {
  const actor = await requireActor();
  const changes = await listAgentChanges(actor, { limit: 100 });

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <header className="mb-8 flex items-baseline gap-4">
        <h1 className="font-head text-3xl">What agents did</h1>
        <Link href="/" className="btn btn-ghost btn-sm ml-auto">Back to the canvas</Link>
      </header>

      <p className="mb-6 text-sm jd-quiet">
        Every note an agent wrote or added to, newest first. Reverting puts the note
        back as it was and leaves a record that it happened.
      </p>

      <ReviewList changes={changes} />
    </main>
  );
}
