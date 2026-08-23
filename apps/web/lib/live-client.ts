import type { LiveEvent } from "@jotacular/domain";

/**
 * The browser end of the live stream. ADR-058.
 *
 * An `EventSource`, deliberately: it reconnects with backoff on its own, and
 * that is the part of a hand-rolled socket that gets written once and then
 * quietly fails on a train.
 *
 * Everything here treats the stream as a HINT. Events carry counters, never
 * content, and a reconnect is assumed to have lost some -- so the interesting
 * callback is not any of the event handlers, it is `onResync`, which says
 * "compare yourself against the server, because I cannot promise you heard
 * everything."
 */

export type LiveHandlers = {
  onInk?: (event: Extract<LiveEvent, { kind: "ink" }>) => void;
  onNote?: (event: Extract<LiveEvent, { kind: "note" }>) => void;
  onBlock?: (event: Extract<LiveEvent, { kind: "block" }>) => void;
  onPresence?: () => void;
  /** Connected, or reconnected after a gap. Anything may have been missed. */
  onResync?: () => void;
};

/** Live updates are an enhancement; the app is whole without them. After this
 *  many failures in a row we stop asking and let the page work as it always
 *  did, rather than retrying into a hole for the rest of the afternoon. */
const MAX_FAILURES = 6;

function openLiveNote(noteId: string, handlers: LiveHandlers): () => void {
  let source: EventSource | null = null;
  let failures = 0;
  let closed = false;

  const on = <K extends LiveEvent["kind"]>(
    kind: K, handle: (event: Extract<LiveEvent, { kind: K }>) => void,
  ) => {
    source?.addEventListener(kind, (message) => {
      const parsed = parse((message as MessageEvent<string>).data);
      if (parsed?.kind === kind) handle(parsed as Extract<LiveEvent, { kind: K }>);
    });
  };

  const connect = () => {
    if (closed) return;
    source = new EventSource(`/api/live/${noteId}`);

    source.onopen = () => {
      failures = 0;
      // Every open is a resync, first one included: the page was rendered on
      // the server some milliseconds ago and somebody may have written since.
      handlers.onResync?.();
    };

    source.onerror = () => {
      // EventSource retries by itself. This only decides when to stop it.
      if (source?.readyState !== EventSource.CLOSED) return;
      if (++failures >= MAX_FAILURES) return void stop();
      setTimeout(connect, Math.min(1000 * 2 ** failures, 30_000));
    };

    if (handlers.onInk) on("ink", handlers.onInk);
    if (handlers.onNote) on("note", handlers.onNote);
    if (handlers.onBlock) on("block", handlers.onBlock);
    if (handlers.onPresence) on("presence", () => handlers.onPresence!());
  };

  function stop() {
    closed = true;
    source?.close();
    source = null;
  }

  connect();
  return stop;
}

function parse(data: string): LiveEvent | null {
  try {
    return JSON.parse(data) as LiveEvent;
  } catch {
    return null;
  }
}

/**
 * One stream per note, however many parts of the page want it.
 *
 * The canvas wants ink events and the shell wants everything else, and two
 * EventSources for one note would be two connections, two keepalives and two
 * LISTEN fan-outs to say the same thing. Ref-counted: the first subscriber
 * opens it, the last one closes it.
 */
const rooms = new Map<string, { close: () => void; members: Set<LiveHandlers> }>();

export function subscribeLive(noteId: string, handlers: LiveHandlers): () => void {
  let room = rooms.get(noteId);
  if (!room) {
    const members = new Set<LiveHandlers>();
    const each = (call: (h: LiveHandlers) => void) => { for (const h of members) call(h); };
    const close = openLiveNote(noteId, {
      onInk: (e) => each((h) => h.onInk?.(e)),
      onNote: (e) => each((h) => h.onNote?.(e)),
      onBlock: (e) => each((h) => h.onBlock?.(e)),
      onPresence: () => each((h) => h.onPresence?.()),
      onResync: () => each((h) => h.onResync?.()),
    });
    room = { close, members };
    rooms.set(noteId, room);
  }

  const open = room;
  open.members.add(handlers);
  return () => {
    open.members.delete(handlers);
    if (open.members.size > 0) return;
    open.close();
    if (rooms.get(noteId) === open) rooms.delete(noteId);
  };
}
