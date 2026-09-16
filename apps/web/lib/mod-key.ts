"use client";

import { useEffect, useState } from "react";

/**
 * The modifier key THIS machine has, for anything the customer is told to press.
 *
 * `use-canvas-keys.ts` already accepts either key -- what was wrong is the
 * label. A Windows or Android reader was shown `⌘K` for a shortcut whose key is
 * Ctrl, which is an instruction that does not work. Issue 011.
 *
 * Ctrl on the server and on the first paint, so the markup matches and only a
 * Mac corrects itself afterwards.
 */
export function useModKey(): string {
  const [mod, setMod] = useState("Ctrl+");
  useEffect(() => {
    if (isApple()) setMod("⌘");
  }, []);
  return mod;
}

function isApple(): boolean {
  const ua = navigator.userAgent;
  // `platform` is deprecated and still the only reliable answer on desktop
  // Safari; the user agent covers iPadOS, which reports itself as a Mac.
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || ua);
}
