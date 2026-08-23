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
        ? { tone: "trouble", line: "Strokes are safe here and will retry" }
        : null,
    [error, state],
  );
}
