"use client";

import { useEffect, useState } from "react";
import { dismissHint, hintDismissed, isIpad } from "@/lib/scribble";

/**
 * Tells an iPad owner, once, that their Pencil already writes into the text
 * field. docs/08-ink.md calls this Tier 1: free, day one, and invisible unless
 * someone says so. ADR-034.
 */
export function ScribbleHint({ visible }: { visible: boolean }) {
  // Starts false and is decided in an effect: `navigator` does not exist during
  // the server render, and guessing would mean a hydration mismatch.
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isIpad() && !hintDismissed()) setShow(true);
  }, []);

  if (!show || !visible) return null;

  return (
    <aside className="jd-chrome jd-scribble-hint" role="note">
      <p>
        Write here with your Pencil. Apple Scribble turns it into text — no setup,
        nothing to switch on.
      </p>
      <button
        type="button"
        onClick={() => { dismissHint(); setShow(false); }}
      >
        Got it
      </button>
    </aside>
  );
}
