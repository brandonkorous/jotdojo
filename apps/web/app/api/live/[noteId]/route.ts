import { auth } from "@/auth";
import { asUser, subscribeToNote, getNote, type LiveEvent } from "@jotacular/domain";

/**
 * The live stream for one note. ADR-058.
 *
 * Server-sent events, not a WebSocket. Writes already have a perfectly good
 * path -- server actions -- so the only thing missing was a way DOWN, and a
 * one-way stream is half the machinery for all of the benefit. EventSource also
 * reconnects on its own, which is the behaviour that would otherwise have to be
 * written, tested and got wrong on flaky mobile connections.
 *
 * The stream carries ids and counters, never content. A device hearing that a
 * page grew fetches the page for itself, through the same row-level security as
 * any other read -- so a member removed from a space mid-stream cannot be sent
 * anything, whatever this route forgets to check.
 */

/** Nothing about this is cacheable, and Next must not try. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Comment frames, to keep proxies and phone radios from calling it idle. */
const KEEPALIVE_MS = 25_000;

export async function GET(
  request: Request, { params }: { params: Promise<{ noteId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Not signed in", { status: 401 });

  const { noteId } = await params;
  const actor = asUser(session.user.id);

  // Reachability is proven by reading the note, which is the same check every
  // other read makes. An anonymous draft never gets here: it is one device by
  // construction, because its cookie is host-only and httpOnly.
  try {
    await getNote(actor, noteId);
  } catch {
    return new Response("No such note", { status: 404 });
  }

  // Subscribed BEFORE the response exists, so a database that is refusing
  // connections becomes a plain 503 instead of a stream that dies mid-pipe.
  // The page works without a live channel, and EventSource comes back by itself.
  const relay: Relay = { send: () => {} };
  let unsubscribe: () => void;
  try {
    unsubscribe = await subscribeToNote(noteId, (event) => relay.send(frame(event)));
  } catch {
    return new Response("The live channel is unavailable", { status: 503 });
  }

  return new Response(stream(relay, unsubscribe, request.signal), {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Caddy does not buffer, but this costs one header and saves an
      // afternoon the first time something else is put in front of it.
      "X-Accel-Buffering": "no",
    },
  });
}

/** Where a frame goes until the stream exists to carry it. */
type Relay = { send: (chunk: string) => void };

/**
 * `start` runs as the stream is constructed and `fanOut` cannot interleave with
 * it, so nothing published after LISTEN falls into the gap.
 */
function stream(
  relay: Relay, unsubscribe: () => void, signal: AbortSignal,
): ReadableStream<Uint8Array> {
  const encode = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      let open = true;
      const send = (chunk: string) => {
        if (!open) return;
        try { controller.enqueue(encode.encode(chunk)); } catch { close(); }
      };
      relay.send = send;

      // A first frame immediately, so the client's `onopen` is not waiting on
      // somebody else to do something before it believes it is connected.
      send(": open\n\n");

      const keepalive = setInterval(() => send(": keepalive\n\n"), KEEPALIVE_MS);

      function close() {
        if (!open) return;
        open = false;
        clearInterval(keepalive);
        unsubscribe();
        try { controller.close(); } catch { /* already closed by the runtime */ }
      }

      // An already-aborted signal never fires, and the LISTEN handler would
      // outlive a request nobody is reading.
      if (signal.aborted) close();
      else signal.addEventListener("abort", close);
    },
  });
}

/**
 * One SSE frame.
 *
 * The event id is the timestamp, which the browser sends back as
 * `Last-Event-ID` on reconnect. Nothing reads it: replay is the client's job
 * and it does it by comparing counters against the database, which is the only
 * account of what happened that survives a dropped connection anyway.
 */
function frame(event: LiveEvent): string {
  return `id: ${event.at}\nevent: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`;
}
