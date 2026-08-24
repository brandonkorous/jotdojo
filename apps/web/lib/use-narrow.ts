"use client";

import { useEffect, useState } from "react";

/**
 * Whether the chrome has to collapse. ADR-101.
 *
 * The BREAKPOINT lives in chrome.css and is the authority; this hook exists
 * only so a tap can MEAN something different when the rail is collapsed, which
 * no media query can express. Keep the two numbers in step.
 */
export const NARROW = "(max-width: 30rem)";

/**
 * False until mounted, deliberately. The server has no viewport, and a hook
 * that guessed would render the wide answer on a phone and correct it a frame
 * later -- a visible flinch on the one device this exists for. The visuals are
 * CSS and are right immediately; only the tap semantics wait.
 */
export function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(NARROW);
    const read = () => setNarrow(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);

  return narrow;
}
