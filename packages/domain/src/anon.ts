import { createHash, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { withActor, withoutActor } from "@jotacular/db";
import { asUser, type Actor } from "./actor";
import { DomainError, NotFound } from "./errors";

/**
 * Capture before you have an account. ADR-009, ADR-039.
 *
 * Server-side from the first keystroke, because iOS Safari evicts
 * script-writable storage under pressure and after disuse. An anonymous note
 * that lived only in IndexedDB WOULD be lost, and "never lose a thought" cannot
 * have an asterisk.
 */

const PREFIX = "jd_anon_";
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Abuse ceilings from docs/16-web-presence.md. Recognition costs money and
 *  abuse is free, so the limits are on what a stranger can accumulate. */
export const ANON_MAX_NOTES = 10;
export const ANON_MAX_CHARS = 50_000;
export const ANON_MAX_STROKES = 4_000;

export class AnonLimit extends DomainError {
  constructor(message: string, code: string) {
    super(message, code, 429);
  }
}

export type AnonSession = { token: string; spaceId: string; actor: Actor };

/**
 * Start or resume an anonymous session.
 *
 * Idempotent on the token: a browser retrying must not mint a second space and
 * strand the first. Runs without an actor because there is not one yet -- the
 * shadow user this creates is what everything afterwards acts as.
 */
export async function startAnonSession(existingToken?: string | null): Promise<AnonSession> {
  const token = existingToken?.startsWith(PREFIX)
    ? existingToken
    : PREFIX + randomBytes(24).toString("base64url");

  return withoutActor(async (tx) => {
    const spaceRows = await tx.execute(
      sql`SELECT app_create_anon_space(${hash(token)}) AS space_id`);
    const spaceId = String(
      (spaceRows as unknown as Array<Record<string, unknown>>)[0]?.space_id);

    const userRows = await tx.execute(
      sql`SELECT app_anon_user(${hash(token)}) AS user_id`);
    const userId = (userRows as unknown as Array<Record<string, unknown>>)[0]?.user_id;
    if (!userId) throw new Error("anon session has no shadow user");

    return { token, spaceId, actor: asUser(String(userId)) };
  });
}

/** Resolve a token the browser already holds. Null when unknown, swept or
 *  already claimed -- which reads as "start again", not as an error. */
export async function resumeAnonSession(token: string): Promise<AnonSession | null> {
  if (!token.startsWith(PREFIX)) return null;
  return withoutActor(async (tx) => {
    const rows = await tx.execute(sql`
      SELECT app_anon_space(${hash(token)}) AS space_id,
             app_anon_user(${hash(token)})  AS user_id
    `);
    const row = (rows as unknown as Array<Record<string, unknown>>)[0];
    if (!row?.space_id || !row?.user_id) return null;
    return {
      token, spaceId: String(row.space_id), actor: asUser(String(row.user_id)),
    };
  });
}

/**
 * How full a draft is, so the UI can say so before refusing.
 *
 * Counted rather than tracked: a counter column would drift the first time a
 * note was deleted, and this is not a hot path.
 */
export type AnonUsage = { notes: number; chars: number; strokes: number };

export async function anonUsage(session: AnonSession): Promise<AnonUsage> {
  return withActor(session.actor.userId, async (tx) => {
    const rows = await tx.execute(sql`
      SELECT (SELECT count(*) FROM notes
               WHERE space_id = ${session.spaceId}::uuid AND deleted_at IS NULL) AS notes,
             (SELECT COALESCE(sum(length(COALESCE(body, ''))), 0) FROM blocks
               WHERE space_id = ${session.spaceId}::uuid) AS chars,
             (SELECT COALESCE(sum(jsonb_array_length(a.strokes -> 'strokes')), 0)
                FROM blocks b JOIN media_assets a ON a.id = b.artifact_id
               WHERE b.space_id = ${session.spaceId}::uuid AND b.kind = 'ink') AS strokes
    `);
    const row = (rows as unknown as Array<Record<string, unknown>>)[0];
    return {
      notes: Number(row?.notes ?? 0),
      chars: Number(row?.chars ?? 0),
      strokes: Number(row?.strokes ?? 0),
    };
  });
}

/**
 * Ink has its own ceiling.
 *
 * Strokes are not text, so ANON_MAX_CHARS never sees them, and a page of
 * handwriting is orders of magnitude bigger than a paragraph. Without this a
 * stranger's abuse budget for the expensive artifact would be unbounded.
 */
export async function assertAnonInkRoom(session: AnonSession, adding = 0): Promise<void> {
  const { strokes } = await anonUsage(session);
  if (strokes + adding > ANON_MAX_STROKES) {
    throw new AnonLimit("Sign in to keep drawing — this draft is full", "anon_ink_limit");
  }
}

/** Refuse politely at the ceiling. The message is what the person reads. */
export async function assertAnonRoom(session: AnonSession, adding = 0): Promise<void> {
  const { notes, chars } = await anonUsage(session);
  if (notes >= ANON_MAX_NOTES) {
    throw new AnonLimit("Sign in to keep writing — this draft is full", "anon_note_limit");
  }
  if (chars + adding > ANON_MAX_CHARS) {
    throw new AnonLimit("Sign in to keep writing — this draft is full", "anon_char_limit");
  }
}

/**
 * Claim a draft at sign-in.
 *
 * A change of ownership, not a copy: nothing moves between tables, so nothing
 * can be lost in the moving and there is no merge logic to get wrong.
 */
export async function claimAnonSession(actor: Actor, token: string): Promise<string> {
  if (actor.type !== "user") throw new NotFound("No such draft");
  return withActor(actor.userId, async (tx) => {
    try {
      const rows = await tx.execute(
        sql`SELECT app_claim_anon_space(${hash(token)}, ${actor.userId}::uuid) AS space_id`);
      const row = (rows as unknown as Array<Record<string, unknown>>)[0];
      return String(row?.space_id);
    } catch (err) {
      if ((err as Error).message?.includes("no such draft")) throw new NotFound("No such draft");
      throw err;
    }
  });
}

/** Delete unclaimed drafts. The retention promise, as code rather than a
 *  sentence in a runbook. Returns how many went. */
export async function sweepAnonSpaces(days = 30): Promise<number> {
  return withoutActor(async (tx) => {
    const rows = await tx.execute(sql`SELECT app_sweep_anon_spaces(${days}::integer) AS gone`);
    return Number((rows as unknown as Array<Record<string, unknown>>)[0]?.gone ?? 0);
  });
}
