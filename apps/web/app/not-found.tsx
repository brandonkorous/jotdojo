import Link from "next/link";
import { headers } from "next/headers";
import { isMarketingHost, requestHost } from "@/lib/hosts";
import { Fallback } from "@/components/Fallback";

/**
 * One 404 for two hosts. ADR-040, ADR-106.
 *
 * An unmatched path on the apex is rewritten under `/site` and still lands
 * here, not on `app/site/not-found.tsx` -- a segment boundary only catches a
 * `notFound()` raised inside it, never a URL that matched no route at all.
 */
export default async function NotFound() {
  const marketing = isMarketingHost(requestHost(await headers()));

  return (
    <Fallback
      title="That page is not here"
      actions={
        <Link href="/" className="btn btn-primary">
          {marketing ? "Back to the start" : "Back to the canvas"}
        </Link>
      }
    >
      The link may be old, or it may have a typo in it.
      {marketing ? "" : " Nothing you wrote is affected."}
    </Fallback>
  );
}
