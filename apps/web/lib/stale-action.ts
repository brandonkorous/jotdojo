const KEY = "jotacular:stale-action-reload";
/** One reload per this long, so a server that keeps refusing cannot loop the page. */
const WINDOW_MS = 60_000;

/** Is this Next's "that server action does not exist in this build" error? */
export function isStaleAction(err: unknown): boolean {
  const e = err as { name?: string; message?: string } | null;
  return e?.name === "UnrecognizedActionError"
    || /Server Action .* was not found on the server/.test(e?.message ?? "");
}

/** Reload once to pick up the new build. Returns false when it already did a moment ago. */
export function reloadOnce(now = Date.now()): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (now - last < WINDOW_MS) return false;
    sessionStorage.setItem(KEY, String(now));
  } catch {
    // Storage blocked: reloading without a guard could loop, so do not.
    return false;
  }
  window.location.reload();
  return true;
}
