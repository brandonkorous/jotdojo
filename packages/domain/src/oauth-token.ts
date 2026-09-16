/**
 * What a bearer token is worth, and why it is not. Split out of oauth.ts,
 * ADR-117.
 */

import { eq, sql } from "drizzle-orm";
import { withActor, withoutActor, oauthTokens } from "@jotacular/db";
import type { Actor } from "./actor";
import { sha256 } from "./oauth";

/**
 * Why a token was refused. The two answers are opposite, so they are two
 * answers: `wrong_server` means fix the address and try again, `not_current`
 * means stop asking with this one. Issue 024.
 */
export type TokenRefusal = "wrong_server" | "not_current";

export type TokenCheck =
  | { ok: true; actor: Actor }
  | { ok: false; why: TokenRefusal };

/**
 * Validate a bearer token and produce an agent actor.
 *
 * The audience check is the confused-deputy defence: a token minted for
 * kanninja must not work here, and vice versa. RFC 8707.
 */
export async function verifyAccessToken(
  token: string, expectedAudience: string,
): Promise<TokenCheck> {
  const rows = await withoutActor(async (tx) =>
    tx.execute(sql`SELECT * FROM app_resolve_oauth_token(${sha256(token)}, 'access')`));

  const row = (rows as unknown as Array<Record<string, unknown>>)[0];
  // Revoked, expired and never-issued all arrive as no row, and are not told
  // apart here because they have one answer: do not retry with this token.
  if (!row || row.was_reused === true) return { ok: false, why: "not_current" };
  if (String(row.audience) !== expectedAudience) return { ok: false, why: "wrong_server" };

  return {
    ok: true,
    actor: {
      type: "agent",
      userId: String(row.user_id),
      clientId: String(row.client_id),
      clientRecordId: String(row.mcp_client_id),
      scopes: (row.scopes as string[]) ?? [],
      spaceIds: (row.space_ids as string[]) ?? [],
    },
  };
}

export async function revokeToken(token: string): Promise<void> {
  // Try both kinds; revocation is unauthenticated per RFC 7009 and must not
  // reveal which kind (or whether) the token existed.
  for (const kind of ["access", "refresh"] as const) {
    const rows = await withoutActor(async (tx) =>
      tx.execute(sql`SELECT * FROM app_resolve_oauth_token(${sha256(token)}, ${kind})`));
    const row = (rows as unknown as Array<Record<string, unknown>>)[0];
    if (!row) continue;
    await withActor(String(row.user_id), async (tx) => {
      await tx.update(oauthTokens).set({ revokedAt: new Date() })
        .where(eq(oauthTokens.familyId, String(row.family_id)));
    });
    return;
  }
}
