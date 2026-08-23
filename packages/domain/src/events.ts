import { publishRaw, subscribeRaw } from "@jotacular/db";

/**
 * What a live event means. ADR-058. The wire is @jotacular/db's `live.ts`.
 *
 * Every event is a POINTER: which note, which block, and how far along it now
 * is. None of them carries content. That is the property the whole feature
 * rests on -- a receiver reads the durable row for itself, through the same
 * row-level security as any other read, so the stream cannot leak a note to
 * somebody who lost access between the write and the delivery.
 *
 * It also removes the need for a sender id. A device ignores an event whose
 * counter it has already reached, which is exactly the test for "this is my own
 * write coming back", and the counters are the ones the write protocol already
 * had.
 */

export type LiveEvent = {
  spaceId: string;
  noteId: string;
  /** Epoch milliseconds, for ordering a burst and for the SSE event id. */
  at: number;
} & (
  | {
      /** Strokes landed. `version` also moves on erase, where the count falls. */
      kind: "ink";
      blockId: string;
      strokeCount: number;
      version: number;
    }
  /** The typed body was saved. A follower with nothing unsaved adopts it. */
  | { kind: "note"; revision: number }
  /** A worker finished reading a page, a photo or a recording. */
  | { kind: "block"; blockId: string; transcriptState: string }
  /** Somebody arrived, left, or started writing. Re-read the presence list. */
  | { kind: "presence" }
);

/**
 * Announce a change, after it is durable.
 *
 * Fire and forget on purpose: the capture contract puts a hard latency budget
 * on the write path (docs/02-product-spec.md), and a device hearing about a
 * stroke fifty milliseconds later is not worth spending any of it. `publishRaw`
 * never throws, so nothing is left unhandled.
 */
export function publish(event: LiveEvent): void {
  void publishRaw(JSON.stringify(event));
}

/**
 * Everything happening in one note.
 *
 * Filtered here rather than by LISTENing on a per-note channel, because that
 * would mean a LISTEN and an UNLISTEN every time a tab opened. At this size
 * every pod seeing every event costs nothing; if it ever stops being nothing,
 * shard the channel by space rather than by note.
 *
 * Awaited, so a caller is subscribed before it believes it is. See subscribeRaw.
 */
export function subscribeToNote(
  noteId: string, handler: (event: LiveEvent) => void,
): Promise<() => void> {
  return subscribeRaw((payload) => {
    const event = parse(payload);
    if (event && event.noteId === noteId) handler(event);
  });
}

function parse(payload: string): LiveEvent | null {
  try {
    const value = JSON.parse(payload) as LiveEvent;
    // A malformed payload is not worth a thrown error in a fan-out loop. It
    // means a deploy is half-rolled and the other half speaks a later dialect.
    return value && typeof value.noteId === "string" && typeof value.kind === "string"
      ? value
      : null;
  } catch {
    return null;
  }
}
