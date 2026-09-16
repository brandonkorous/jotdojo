import { usePublish } from "./live-feed";
import type { SyncState } from "./ink-sync";

/**
 * What ink has to say on the live line. ADR-061.
 *
 * Only trouble. "Saving ink" was true for a tenth of a second at a time and
 * told nobody anything they could act on; a stroke that has not reached the
 * server is worth interrupting somebody for.
 */
export function useInkTrouble(state: SyncState, error: string | null) {
  usePublish(
    "ink",
    error
      ? { tone: "trouble", line: `Ink could not start: ${error}` }
      : state === "retrying"
        // Not only strokes: the same queue carries text boxes, arrows, stickers
        // and photos, and "strokes" is our word rather than theirs (docs/11).
        // Somebody in a tunnel needs to know the PAGE is safe. Issue 034.
        ? { tone: "trouble", line: "Saved on this device. It will send when the connection is back" }
        : null,
    [error, state],
  );
}
