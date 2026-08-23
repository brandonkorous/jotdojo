import Link from "next/link";
import { appOrigin } from "@/lib/hosts";
import { formatDate } from "@/lib/format-date";
import type { LegalDoc } from "@/lib/legal";

/**
 * The privacy policy and the terms, in one shape.
 *
 * The plain-language summary sits ABOVE the policy rather than instead of it:
 * a page somebody can actually read is the point, and a summary that replaces
 * the text is just a policy nobody agreed to. docs/13-security-and-privacy.md.
 */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  const other = doc.slug === "privacy"
    ? { href: "/terms", label: "Terms" }
    : { href: "/privacy", label: "Privacy" };

  return (
    <main className="jd-site-main">
      <section className="jd-band jd-legal-head">
        <h1 className="font-head">{doc.title}</h1>
        <p className="jd-legal-updated">Last updated {formatDate(doc.updated)}</p>
        <p className="jd-lede">{doc.summary}</p>
      </section>

      <article className="jd-band jd-prose jd-legal-body">
        {/* Ours, from a markdown file in this repository. */}
        <div dangerouslySetInnerHTML={{ __html: doc.html }} />
      </article>

      <section className="jd-band jd-band-quiet">
        <h2 className="font-head">Still yours, whenever you want it</h2>
        <p>
          Export everything as markdown any time, from your account. Nothing here
          is trained on, and nothing reads your notes on a schedule unless you
          switched it on.
        </p>
        <p className="jd-plan-cta">
          <a className="btn btn-primary" href={appOrigin()}>Open the app</a>
          <Link href={other.href}>{other.label}</Link>
        </p>
      </section>
    </main>
  );
}
