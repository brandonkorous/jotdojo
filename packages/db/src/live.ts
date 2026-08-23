import postgres from "postgres";
import { sql } from "drizzle-orm";
import { db } from "./client";

/**
 * The live channel: one Postgres LISTEN/NOTIFY topic the whole product shares.
 * ADR-058. What an event MEANS lives in @jotdojo/domain; this file only knows
 * how to get a string from one process to all the others.
 *
 * NOTIFY and not a broker, for the same reason the outbox is not Kafka (ADR-002):
 * the database is already there. NOTIFY and not an in-process emitter, because
 * the web deployment surges to two pods on every rolling update, and an event
 * that reached one of them would look like live updates that work most of the
 * time -- the worst way for this to fail.
 *
 * THIS CHANNEL IS NOT DURABLE, AND THAT IS A DESIGN CHOICE, NOT A SHORTFALL.
 *
 * There is no ack, no retry and no dead letter. An event sent while a pod is
 * restarting is gone. That is safe for exactly one kind of payload -- a pointer
 * to a row that is already committed -- and unsafe for every other kind.
 *
 * So: NOTHING MAY BE PUBLISHED HERE THAT WOULD BE MISSED IF IT VANISHED.
 * Work that must happen goes in the OUTBOX, which acknowledges, retries and
 * records its failures. Sibling advice, dearly bought: sparx lost events for
 * weeks after a cloud migration silently selected a fire-and-forget transport
 * while every publish reported success. The defence is not vigilance, it is
 * that this channel cannot carry anything worth losing -- see LiveEvent in
 * packages/domain/src/events.ts, which is ids and counters and nothing else.
 */

const CHANNEL = "jotdojo_live";

/** Postgres caps a notification payload at 8000 bytes. Ours are ids and
 *  counters, so this guards a future field rather than a present risk. */
const MAX_PAYLOAD = 7_900;

/**
 * Send an event. Never throws, and never runs inside the caller's transaction.
 *
 * Both halves are deliberate. Inside the transaction, a full notification queue
 * -- one stuck listener is enough -- would roll back the write that triggered
 * it, and that write is somebody's handwriting. After the commit the strokes
 * are already durable, so the worst a failure here costs is a second device
 * finding out late.
 *
 * The direction of that risk is the whole design: an event carries ids, never
 * content, and every receiver reads the durable row itself. A duplicate event
 * costs a wasted read, a lost one costs a delay, and neither can corrupt a
 * page. That is what makes it safe to treat this channel as a hint.
 */
export async function publishRaw(payload: string): Promise<void> {
  try {
    if (Buffer.byteLength(payload, "utf8") > MAX_PAYLOAD) return;
    await db.execute(sql`SELECT pg_notify(${CHANNEL}, ${payload})`);
  } catch {
    // Swallowed on purpose. See above: the write already happened.
  }
}

type Handler = (payload: string) => void;

const handlers = new Set<Handler>();
let listening: Promise<void> | null = null;

/**
 * Receive every event this database emits, for the life of the process.
 *
 * AWAITED, and it has to be: `LISTEN` is a round trip, and a subscriber that
 * returned before it completed would silently miss anything published in its
 * own first few milliseconds. That is a small window and a real one -- opening
 * a note somebody else is actively drawing on lands squarely inside it.
 *
 * Returns an unsubscribe for the handler. The CONNECTION is never torn down: it
 * is one per process, deliberately outside the pool, and reopening it per
 * subscriber would spend the shared connection budget on churn.
 * docs/17-shared-infrastructure.md is why that budget is a real number.
 */
export async function subscribeRaw(handler: Handler): Promise<() => void> {
  handlers.add(handler);
  try {
    listening ??= startListening();
    await listening;
  } catch (err) {
    // A failed LISTEN must not leave a handler registered against a channel
    // that will never speak, and the caller has to know it is deaf rather than
    // merely in a quiet note.
    handlers.delete(handler);
    listening = null;
    throw err;
  }
  return () => { handlers.delete(handler); };
}

function startListening(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set; the live channel cannot listen");

  // Its own client, not the pool. A LISTEN connection is held open forever, so
  // borrowing one from a pool of five would quietly cost the app a fifth of its
  // capacity to talk to the database.
  const client = postgres(url, {
    max: 1,
    idle_timeout: 0,
    connection: { application_name: "jotdojo-live" },
  });

  // postgres.js re-issues LISTEN after a dropped connection. Events sent during
  // the gap are gone -- NOTIFY has no durability -- and that is survivable
  // precisely because a client resyncs from the database when its own stream
  // reconnects. Nothing here is a source of truth.
  return client.listen(CHANNEL, fanOut).then(() => undefined);
}

/**
 * Dispatch, synchronously and without I/O.
 *
 * A slow listener is what fills the notification queue server-wide, so this is
 * allowed to do exactly one thing. Handlers that need to read the database do
 * it on their own time.
 */
function fanOut(payload: string) {
  for (const handler of handlers) {
    try { handler(payload); } catch { /* one bad subscriber must not deafen the rest */ }
  }
}
