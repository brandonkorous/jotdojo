/**
 * One tap instead of a URL. ADR-069, docs/18-app-directories.md.
 *
 * Copying an address out of a help page and finding the right settings screen
 * is a developer's onboarding flow, and two of our three audiences will simply
 * stop. Claude takes a prefilled install link: the dialog opens already filled
 * in, and the person confirms and signs in.
 *
 * The link only PREFILLS. It grants nothing the user has not confirmed, and a
 * signed-out visitor is asked to sign in and lands back on the dialog.
 */
import { brand } from "@/lib/brand";

const CLAUDE_INSTALL = "https://claude.ai/customize/connectors?modal=add-custom-connector";

export function ConnectToClaude(
  { mcpUrl, mayWrite }: { mcpUrl: string; mayWrite: boolean },
) {
  const href = `${CLAUDE_INSTALL}&connectorName=${encodeURIComponent(brand.name)}`
    + `&connectorUrl=${encodeURIComponent(mcpUrl)}`;

  return (
    <section>
      <h2 className="font-head text-xl">Let an assistant read your notes</h2>
      <p className="mb-4 mt-1 text-sm jd-quiet">
        Then you can ask it what the vet said, what the quote was, or what you
        wrote down on Tuesday — without opening Jotacular at all.
        {/* The fence is real and checked at use time, so saying "it can add to
            your notes" to somebody on free is a promise the server refuses the
            first time their agent tries. Issue 017. */}
        {mayWrite
          ? " It can add to your notes and leave comments. It can never change or delete what you wrote."
          : " On your plan it can only read. It can never change or delete what you wrote, and adding a note or a comment comes with a paid plan."}
      </p>

      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="btn btn-primary"
      >
        Connect to Claude
      </a>

      {/*
        The address is still here for anyone whose assistant is not Claude.
        Tucked into a disclosure, because it is the answer to a question most
        people will never ask.
      */}
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer jd-quiet">
          Using something else?
        </summary>
        <p className="mt-2 jd-quiet">
          Any assistant that can connect to an address will work. Give it this
          one, and it will ask you to sign in:
        </p>
        <code className="mt-2 block select-all break-all rounded bg-base-200 p-2 text-xs">
          {mcpUrl}
        </code>
      </details>
    </section>
  );
}
