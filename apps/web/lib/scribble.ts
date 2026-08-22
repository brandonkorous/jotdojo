/**
 * Apple Scribble is the free handwriting tier, and almost nobody knows it works
 * on the web. docs/08-ink.md, ADR-034.
 */

const KEY = "jotdojo.scribble-hint.dismissed";

/**
 * iPadOS 13 and later report themselves as macOS, deliberately. The only
 * reliable separator left is touch: a real Mac has no touch points.
 */
export function isIpad(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPad/.test(ua)) return true;
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

/**
 * Storage can throw outright in a locked-down Safari, not merely return null,
 * so both directions are guarded. A hint that cannot be remembered should show
 * again, never break the page.
 */
export function hintDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissHint(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // A hint shown twice is a smaller problem than a canvas that will not load.
  }
}
