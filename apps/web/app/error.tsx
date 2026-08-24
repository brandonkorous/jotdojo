"use client";

import Link from "next/link";
import { Fallback } from "@/components/Fallback";

/**
 * Any error thrown while rendering a route. ADR-106.
 *
 * Without this the reader gets Next's own screen, which says "a server-side
 * exception has occurred" and offers nothing to do about it.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Fallback
      title="Something went wrong"
      reference={error.digest}
      actions={
        <>
          <button type="button" onClick={reset} className="btn btn-primary">
            Try again
          </button>
          <Link href="/" className="btn btn-ghost">Back to the canvas</Link>
        </>
      }
    >
      This one is ours, not yours. Trying again often clears it. Nothing you
      wrote has been lost.
    </Fallback>
  );
}
