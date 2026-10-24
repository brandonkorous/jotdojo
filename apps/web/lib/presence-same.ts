import type { Presence } from "@jotacular/domain";

/** Is this the same crowd? Keeps a quiet heartbeat from re-rendering the canvas. */
export function samePresence(a: Presence[], b: Presence[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((p, i) => {
    const q = b[i]!;
    return p.userId === q.userId && p.deviceId === q.deviceId && p.writing === q.writing
      && p.self === q.self && p.displayName === q.displayName && p.avatarUrl === q.avatarUrl;
  });
}
