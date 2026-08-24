"use client";

import { Fallback } from "@/components/Fallback";
import "./globals.css";

/**
 * The last resort: an error thrown by the root layout itself. ADR-106.
 *
 * This REPLACES the root layout, so it carries its own `html` and `body` and
 * imports the stylesheet the layout would have. The webfont link does not come
 * with it, and that is fine -- the fallback stack is legible and this page is
 * the one place where robustness beats typography.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" data-theme="paper">
      <body className="bg-base-300 text-base-content font-sans antialiased">
        <Fallback
          title="Something went wrong"
          reference={error.digest}
          actions={
            <>
              <button type="button" onClick={reset} className="btn btn-primary">
                Try again
              </button>
              {/* A hard navigation, not next/link: the root layout is what
                  just threw, so the router is the thing least worth trusting. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" className="btn btn-ghost">Back to the canvas</a>
            </>
          }
        >
          This one is ours, not yours. Trying again often clears it. Nothing you
          wrote has been lost.
        </Fallback>
      </body>
    </html>
  );
}
