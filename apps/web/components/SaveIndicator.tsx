"use client";

import { useEffect, useState } from "react";
import { usePublish } from "@/lib/live-feed";
import type { SaveState } from "@/lib/save-state";

/**
 * What the autosave loop is doing, said on the live line. ADR-060, ADR-061.
 *
 * It was a line of small text centred over the foot of the page, and it never
 * returned to idle -- so from the first save onward "Saved" simply sat on the
 * washi, at the weight of the writing, in the same column. It read as something
 * somebody had jotted there.
 */

/** A save lands every time typing pauses. Waiting out a beat of quiet means a
 *  burst of keys is one flash rather than one per keystroke. */
const SETTLE_MS = 1200;

const TROUBLE = {
  retrying: "That did not send \u2014 it is safe here and will retry",
  conflict: "This note changed somewhere else \u2014 your text is still here",
};

export function SaveIndicator({ state }: { state: SaveState }) {
  /**
   * The save that has actually settled, which is not the same as the last one
   * to land. Publishing every `saved` would put a flash on the line every time
   * somebody paused to think.
   */
  const [settled, setSettled] = useState(0);

  useEffect(() => {
    if (state !== "saved") return;
    const timer = setTimeout(() => setSettled((n) => n + 1), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [state]);

  const trouble = state === "retrying" || state === "conflict";

  usePublish(
    "save-trouble",
    trouble ? { tone: "trouble", line: TROUBLE[state as keyof typeof TROUBLE] } : null,
    [trouble, state],
  );

  usePublish(
    "save",
    settled === 0 ? null : { tone: "transient", line: "Jot saved." },
    [settled],
  );

  return null;
}
