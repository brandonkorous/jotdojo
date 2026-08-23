import { eq, sql } from "drizzle-orm";
import { withActor, type Tx } from "@jotacular/db";
import { type Actor } from "./actor";
import { Forbidden } from "./errors";
import { loadNote } from "./ink-block";
import { publish } from "./events";

/**
 * Who has this note open, and who is writing in it. ADR-058.
 *
 * This is the honest half of shipping live updates without a CRDT. Two people
 * typing into one paragraph still ends in a revision conflict -- that decision
 * stands -- but they can SEE each other before it happens, which turns a
 * surprise into a choice. A warning you can act on is worth more here than a
 * merge algorithm nobody can predict.
 */

export type Presence = {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  deviceId: string;
  /** Actively writing right now, not merely present. */
  writing: boolean;
  /** Another window of the reader's own account. Shown differently: "your
   *  iPad" is information, "somebody is here" is an alarm. */
  self: boolean;
};

/** A heartbeat every 15s, so this outlives two missed ones before expiring. */
const TTL_SECONDS = 45;
/** How long one keystroke claims the writing flag for. */
const WRITING_SECONDS = 6;

/**
 * Say "still here", and get back who else is.
 *
 * One round trip does both because the client needs both on the same cadence,
 * and because a heartbeat that returned nothing would need a second call to be
 * useful.
 */
export async function heartbeat(
  actor: Actor, noteId: string, deviceId: string, writing: boolean,
): Promise<Presence[]> {
  if (actor.type !== "user") throw new Forbidden("Only a signed-in person has presence");
  const device = deviceId.slice(0, 64);

  return withActor(actor.userId, async (tx) => {
    const note = await loadNote(tx, actor, noteId);
    await sweep(tx);

    // The prior state has to be read in the same statement as the upsert, and
    // from a CTE rather than from RETURNING: RETURNING hands back the row as it
    // now is, which would report every writer as having always been writing.
    const rows = await tx.execute(sql`
      WITH prior AS (
        SELECT writing_until FROM note_presence
         WHERE note_id = ${noteId} AND user_id = ${actor.userId} AND device_id = ${device}
      ), upsert AS (
        INSERT INTO note_presence (note_id, space_id, user_id, device_id, last_seen_at, writing_until)
        VALUES (${noteId}, ${note.spaceId}, ${actor.userId}, ${device}, now(),
                ${writing ? sql`now() + make_interval(secs => ${WRITING_SECONDS})` : sql`NULL`})
        ON CONFLICT (note_id, user_id, device_id) DO UPDATE
          SET last_seen_at  = now(),
              -- An existing claim is never shortened by a quiet heartbeat: a
              -- pause between words is not the end of writing.
              writing_until = GREATEST(note_presence.writing_until, EXCLUDED.writing_until)
        RETURNING 1
      )
      SELECT NOT EXISTS (SELECT 1 FROM prior) AS arrived,
             coalesce((SELECT writing_until IS NULL OR writing_until < now() FROM prior), true)
               AS was_idle
    `);

    const row = (rows as unknown as Array<Record<string, unknown>>)[0];
    // Announced on arrival and on starting to write, never on a plain
    // heartbeat -- otherwise every open tab would notify every fifteen seconds
    // for the rest of the afternoon.
    if (row?.arrived || (writing && row?.was_idle)) {
      publish({ kind: "presence", spaceId: note.spaceId, noteId, at: Date.now() });
    }

    return readPresence(tx, actor, noteId);
  });
}

/** Everyone currently in the note. What a `presence` event tells you to re-read. */
export async function whoIsHere(actor: Actor, noteId: string): Promise<Presence[]> {
  if (actor.type !== "user") return [];
  return withActor(actor.userId, async (tx) => {
    await loadNote(tx, actor, noteId);
    return readPresence(tx, actor, noteId);
  });
}

/**
 * Leave deliberately, rather than waiting to expire.
 *
 * Sent on `pagehide`, which is best effort by nature -- the TTL is what
 * actually guarantees somebody stops being shown as present.
 */
export async function leave(actor: Actor, noteId: string, deviceId: string): Promise<void> {
  if (actor.type !== "user") return;
  await withActor(actor.userId, async (tx) => {
    const note = await loadNote(tx, actor, noteId);
    await tx.execute(sql`
      DELETE FROM note_presence
       WHERE note_id = ${noteId} AND user_id = ${actor.userId}
         AND device_id = ${deviceId.slice(0, 64)}
    `);
    publish({ kind: "presence", spaceId: note.spaceId, noteId, at: Date.now() });
  });
}

async function readPresence(tx: Tx, actor: Actor, noteId: string): Promise<Presence[]> {
  const rows = await tx.execute(sql`
    SELECT p.user_id, p.device_id, u.display_name, u.avatar_url,
           (p.writing_until IS NOT NULL AND p.writing_until > now()) AS writing
      FROM note_presence p
      JOIN users u ON u.id = p.user_id
     WHERE p.note_id = ${noteId}
       AND p.last_seen_at > now() - make_interval(secs => ${TTL_SECONDS})
     ORDER BY u.display_name NULLS LAST, p.device_id
  `);

  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    userId: String(r.user_id),
    displayName: (r.display_name as string | null) ?? null,
    avatarUrl: (r.avatar_url as string | null) ?? null,
    deviceId: String(r.device_id),
    writing: Boolean(r.writing),
    self: String(r.user_id) === actor.userId,
  }));
}

/**
 * Drop what has expired, on the way past.
 *
 * No scheduled job: presence is only ever read by somebody who is themselves
 * heartbeating, so the sweep runs exactly when it is needed and never on a note
 * nobody has open. The index on last_seen_at is what keeps it free.
 */
async function sweep(tx: Tx): Promise<void> {
  await tx.execute(sql`
    DELETE FROM note_presence WHERE last_seen_at < now() - make_interval(secs => ${TTL_SECONDS})
  `);
}
