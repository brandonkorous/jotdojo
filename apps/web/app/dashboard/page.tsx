import Link from "next/link";
import { listNotes, defaultSpaceId, listSpaces, listDeletedNotes, DELETED_DAYS } from "@jotacular/domain";
import { requireActor } from "@/lib/session";
import { SpaceName } from "@/components/SpaceName";
import { RemoveNote, RestoreNote } from "@/components/NoteBin";

export const dynamic = "force-dynamic";

/**
 * The dashboard exists. It is simply not the landing page -- ADR-008.
 */
export default async function Dashboard() {
  const actor = await requireActor();
  const spaceId = await defaultSpaceId(actor);
  const [notes, spaces, binned] = await Promise.all([
    listNotes(actor, spaceId, 100),
    listSpaces(actor),
    listDeletedNotes(actor, spaceId),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <header className="mb-8 flex items-baseline gap-4">
        <h1 className="font-head text-3xl">Dashboard</h1>
        <Link href="/" className="btn btn-ghost btn-sm ml-auto">Back to the canvas</Link>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 font-head text-xl">Spaces</h2>
        <ul className="flex flex-wrap gap-2">
          {spaces.map((s) => (
            <li key={s.id}>
              <SpaceName id={s.id} name={s.name} owner={s.role === "owner"} ownedBy={s.ownedBy} />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 font-head text-xl">History</h2>
        {notes.length === 0 ? (
          <p className="jd-quiet">Nothing here yet. Go have a thought.</p>
        ) : (
          <ul className="divide-y divide-base-300">
            {notes.map((n) => (
              <li key={n.id} className="flex items-center gap-3">
                <Link href={`/n/${n.id}`} className="block flex-1 py-3 hover:bg-base-200">
                  <div className="font-head">{n.title ?? "Untitled"}</div>
                  <div className="mt-1 line-clamp-1 text-sm jd-quiet">{n.preview}</div>
                  <div className="mt-1 text-xs jd-quiet">
                    {n.updatedAt.toLocaleString()}
                  </div>
                </Link>
                <RemoveNote id={n.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {binned.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-1 font-head text-xl">Thrown away</h2>
          <p className="mb-3 text-sm jd-quiet">
            Kept for {DELETED_DAYS} days, then gone for good. Put one back any
            time before that.
          </p>
          <ul className="divide-y divide-base-300">
            {binned.map((n) => (
              <li key={n.id} className="flex items-center gap-3 py-3">
                <div className="flex-1">
                  <div className="font-head jd-quiet">{n.title ?? "Untitled"}</div>
                  <div className="mt-1 line-clamp-1 text-sm jd-quiet">{n.preview}</div>
                  <div className="mt-1 text-xs jd-quiet">
                    Thrown away {n.deletedAt.toLocaleString()}
                  </div>
                </div>
                <RestoreNote id={n.id} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
