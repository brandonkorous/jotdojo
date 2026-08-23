import { Icon } from "@/components/Icon";

/**
 * Take it with you. ADR-067.
 *
 * Deliberately on the account page rather than buried behind a support email.
 * The promise is that nothing written here is trapped here, and a promise that
 * needs an email to collect on is a slower version of no.
 */
export function ExportSection({
  spaces,
}: {
  spaces: { id: string; name: string; kind: string }[];
}) {
  return (
    <section>
      <h2 className="font-head text-xl">Take it with you</h2>
      <p className="mb-3 mt-1 text-sm opacity-60">
        A zip of everything in a space: one markdown file per note, your
        handwriting as SVG you can open in any browser, and every photo and
        recording exactly as it arrived. Nothing is deleted by exporting it.
      </p>

      <ul className="flex flex-col gap-2">
        {spaces.map((space) => (
          <li key={space.id}>
            <a
              href={`/export/space/${space.id}`}
              className="btn btn-ghost btn-sm"
            >
              <Icon name="download" />
              {space.name}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
