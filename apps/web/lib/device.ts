/**
 * This browser tab, named. ADR-058.
 *
 * Per TAB rather than per browser, and that is the useful granularity: two tabs
 * on one laptop really are two places the same note is open, and presence that
 * merged them would hide exactly the collision it exists to warn about.
 *
 * `sessionStorage` so a reload is the same device and a new tab is not. Every
 * access is guarded because Safari throws on storage in some private contexts,
 * and a thrown presence lookup must never be what stops a page rendering.
 */
const KEY = "jd_device";

let cached: string | null = null;

export function deviceId(): string {
  if (cached) return cached;
  try {
    const stored = sessionStorage.getItem(KEY);
    if (stored) return (cached = stored);
  } catch { /* storage is unavailable; a per-load id is still a valid answer */ }

  cached = globalThis.crypto?.randomUUID?.()
    ?? `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  try { sessionStorage.setItem(KEY, cached); } catch { /* see above */ }
  return cached;
}
