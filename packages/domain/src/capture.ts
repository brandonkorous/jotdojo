import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import {
  withActor, withoutActor, captureTokens, captureRequests, spaces, type Tx,
} from "@jotdojo/db";
import type { Actor } from "./actor";
import { Forbidden, NotFound } from "./errors";
import { assertMember } from "./spaces";
import { createNote, type NoteDetail } from "./notes";
import { captureText, type Shared } from "./capture-text";

const PREFIX = "jd_cap_";

/** Tokens are compared by hash, so the plaintext never reaches the database. */
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export type CaptureTokenSummary = {
  id: string; name: string; spaceId: string; spaceName: string;
  lastUsedAt: Date | null; createdAt: Date;
};

/**
 * Mint a capture token.
 *
 * The plaintext is returned exactly once and never stored -- only its SHA-256.
 * A database read therefore cannot reconstruct a working credential, and we
 * cannot show it to the user again later, which is the honest trade.
 */
export async function createCaptureToken(
  actor: Actor, spaceId: string, name: string,
): Promise<{ token: string; id: string }> {
  if (actor.type !== "user") throw new Forbidden("Only a signed-in person can mint a token");

  const token = PREFIX + randomBytes(32).toString("base64url");

  const id = await withActor(actor.userId, async (tx) => {
    await assertMember(tx, actor, spaceId);
    const rows = await tx.insert(captureTokens).values({
      userId: actor.userId,
      spaceId,
      name: name.trim() || "Shortcut",
      tokenHash: hash(token),
    }).returning({ id: captureTokens.id });
    return rows[0]!.id;
  });

  return { token, id };
}

export async function listCaptureTokens(actor: Actor): Promise<CaptureTokenSummary[]> {
  if (actor.type !== "user") throw new Forbidden();
  return withActor(actor.userId, async (tx) => {
    return tx.select({
      id: captureTokens.id,
      name: captureTokens.name,
      spaceId: captureTokens.spaceId,
      spaceName: spaces.name,
      lastUsedAt: captureTokens.lastUsedAt,
      createdAt: captureTokens.createdAt,
    })
      .from(captureTokens)
      .innerJoin(spaces, eq(spaces.id, captureTokens.spaceId))
      .where(and(eq(captureTokens.userId, actor.userId), isNull(captureTokens.revokedAt)))
      .orderBy(desc(captureTokens.createdAt));
  });
}

export async function revokeCaptureToken(actor: Actor, tokenId: string): Promise<void> {
  if (actor.type !== "user") throw new Forbidden();
  await withActor(actor.userId, async (tx) => {
    await tx.update(captureTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(captureTokens.id, tokenId), eq(captureTokens.userId, actor.userId)));
  });
}

/**
 * Resolve a presented token to an actor.
 *
 * Runs without an actor because the token is what establishes who the actor is
 * -- the same chicken-and-egg as sign-in, and the same answer: one narrow
 * SECURITY DEFINER function rather than a blanket grant. See
 * migrations/0004_capture_tokens.sql.
 */
export async function resolveCaptureToken(token: string): Promise<Actor | null> {
  if (!token.startsWith(PREFIX)) return null;

  return withoutActor(async (tx) => {
    const rows = await tx.execute(sql`
      SELECT token_id, user_id, space_id FROM app_resolve_capture_token(${hash(token)})
    `);
    const row = (rows as unknown as Array<Record<string, unknown>>)[0];
    if (!row) return null;

    return {
      type: "capture" as const,
      userId: String(row.user_id),
      tokenId: String(row.token_id),
      spaceId: String(row.space_id),
    };
  });
}

/** Per-token ceiling. Generous for a human, a wall for a loop or a leaked token. */
const RATE_LIMIT_PER_MINUTE = 60;

export class RateLimited extends Forbidden {
  constructor() {
    super("Too many captures in a short window");
  }
}

/**
 * The capture endpoint's whole job.
 *
 * Target is well under 300ms: a Shortcut that hangs feels broken and gets
 * deleted, and a deleted Shortcut is a lost capture habit. Nothing here calls a
 * model, touches blob storage, or waits on recognition -- see the capture
 * contract in docs/02-product-spec.md.
 */
export async function captureNote(
  actor: Actor,
  input: Shared & { requestId?: string | null; source?: string | null },
): Promise<{ note: NoteDetail | null; noteId: string; deduplicated: boolean }> {
  if (actor.type !== "capture") throw new Forbidden("Not a capture credential");

  // The same formatting the Android share target uses, because a link sent from
  // a phone's share sheet and the same link sent by a Shortcut should not
  // produce two different notes. ADR-064.
  const text = captureText(input);
  if (!text) throw new NotFound("Nothing to capture");

  const existingOrLimited = await withActor(actor.userId, async (tx) => {
    // Idempotency first: a retry must never produce a second note. A duplicated
    // thought is a small betrayal of trust in a capture app.
    if (input.requestId) {
      const prior = await tx.select({ noteId: captureRequests.noteId })
        .from(captureRequests)
        .where(and(
          eq(captureRequests.tokenId, actor.tokenId),
          eq(captureRequests.requestId, input.requestId),
        ))
        .limit(1);
      if (prior[0]?.noteId) return { kind: "dedup" as const, noteId: prior[0].noteId };
    }

    const since = new Date(Date.now() - 60_000);
    const counted = await tx.select({ n: sql<number>`count(*)::int` })
      .from(captureRequests)
      .where(and(
        eq(captureRequests.tokenId, actor.tokenId),
        gt(captureRequests.createdAt, since),
      ));
    if ((counted[0]?.n ?? 0) >= RATE_LIMIT_PER_MINUTE) return { kind: "limited" as const };

    return { kind: "proceed" as const };
  });

  if (existingOrLimited.kind === "dedup") {
    return { note: null, noteId: existingOrLimited.noteId, deduplicated: true };
  }
  if (existingOrLimited.kind === "limited") throw new RateLimited();

  const note = await createNote(actor, actor.spaceId, text);

  await withActor(actor.userId, async (tx) => {
    await tx.insert(captureRequests).values({
      tokenId: actor.tokenId,
      requestId: input.requestId ?? crypto.randomUUID(),
      noteId: note.id,
    }).onConflictDoNothing();
  });

  return { note, noteId: note.id, deduplicated: false };
}
