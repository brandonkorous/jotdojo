import Link from "next/link";
import { listNotes, defaultSpaceId, listSpaces } from "@jotdojo/domain";
import { requireActor } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * The dashboard exists. It is simply not the landing page -- ADR-008.
 */
export default async function Dashboard() {
  const actor = await requireActor();
  const spaceId = await defaultSpaceId(actor);
  const [notes, spaces] = await Promise.all([
    listNotes(actor, spaceId, 100),
    listSpaces(actor),
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
            <li key={s.id} className="badge badge-neutral">{s.name}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 font-head text-xl">History</h2>
        {notes.length === 0 ? (
          <p className="opacity-60">Nothing here yet.</p>
        ) : (
          <ul className="divide-y divide-base-300">
            {notes.map((n) => (
              <li key={n.id}>
                <Link href={`/n/${n.id}`} className="block py-3 hover:bg-base-200">
                  <div className="font-head">{n.title ?? "Untitled"}</div>
                  <div className="mt-1 line-clamp-1 text-sm opacity-60">{n.preview}</div>
                  <div className="mt-1 text-xs opacity-40">
                    {n.updatedAt.toLocaleString()}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
