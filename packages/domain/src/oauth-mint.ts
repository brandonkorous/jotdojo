/**
 * Turning a grant into a pair of tokens, and rotating that pair safely.
 * Split out of oauth.ts, ADR-117.
 */

import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import {
  withActor, withoutActor, oauthClients, oauthTokens, mcpClients, type Tx,
} from "@jotacular/db";
import { ACCESS_TTL_MS, OAuthError, REFRESH_TTL_MS, sha256 } from "./oauth";

export type TokenSet = {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
};

/**
 * This user's connection to an application, created on first grant.
 *
 * Distinct from the application itself: attribution should name the connection
 * a person granted, so that revoking one person's Claude leaves another
 * person's agent comments intact and correctly attributed.
 */
async function linkConnection(
  tx: Tx, userId: string, clientId: string,
): Promise<string> {
  const existing = await tx.select({ id: mcpClients.id }).from(mcpClients)
    .where(and(eq(mcpClients.userId, userId), eq(mcpClients.clientId, clientId)))
    .limit(1);
  if (existing[0]) return existing[0].id;

  const named = await tx.select({ name: oauthClients.clientName }).from(oauthClients)
    .where(eq(oauthClients.clientId, clientId)).limit(1);

  const rows = await tx.insert(mcpClients).values({
    userId,
    clientId,
    clientName: named[0]?.name ?? null,
    registrationSource: clientId.startsWith("https://") ? "cimd" : "dcr",
  }).returning({ id: mcpClients.id });

  return rows[0]!.id;
}

async function mintTokens(
  tx: Tx, args: {
    clientId: string; userId: string; scopes: string[]; spaceIds: string[];
    audience: string; familyId: string; rotatedFrom?: string;
  },
): Promise<TokenSet> {
  const mcpClientId = await linkConnection(tx, args.userId, args.clientId);
  const access = randomBytes(32).toString("base64url");
  const refresh = randomBytes(32).toString("base64url");

  await tx.insert(oauthTokens).values([
    {
      tokenHash: sha256(access), kind: "access", clientId: args.clientId, userId: args.userId,
      scopes: args.scopes, spaceIds: args.spaceIds, audience: args.audience,
      familyId: args.familyId, rotatedFrom: args.rotatedFrom ?? null,
      mcpClientId,
      expiresAt: new Date(Date.now() + ACCESS_TTL_MS),
    },
    {
      tokenHash: sha256(refresh), kind: "refresh", clientId: args.clientId, userId: args.userId,
      scopes: args.scopes, spaceIds: args.spaceIds, audience: args.audience,
      familyId: args.familyId, rotatedFrom: args.rotatedFrom ?? null,
      mcpClientId,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  ]);

  return {
    access_token: access,
    refresh_token: refresh,
    token_type: "Bearer",
    expires_in: Math.floor(ACCESS_TTL_MS / 1000),
    scope: args.scopes.join(" "),
  };
}

/**
 * Exchange an authorization code.
 *
 * Every check here is load-bearing: PKCE proves the exchanger is the same party
 * that started the flow, the redirect_uri must match exactly, and the resource
 * indicator must match what the code was minted for -- that last one is what
 * stops a jotacular code becoming a kanninja token, which with a live sibling on
 * the same account is not hypothetical.
 */
export async function exchangeAuthCode(input: {
  code: string;
  codeVerifier: string;
  clientId: string;
  redirectUri: string;
  resource: string;
}): Promise<TokenSet> {
  const rows = await withoutActor(async (tx) =>
    tx.execute(sql`SELECT * FROM app_consume_auth_code(${sha256(input.code)})`));

  const row = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!row) throw new OAuthError("invalid_grant", "That code is expired, already used, or unknown");

  if (String(row.client_id) !== input.clientId) {
    throw new OAuthError("invalid_grant", "Code was issued to a different client");
  }
  if (String(row.redirect_uri) !== input.redirectUri) {
    throw new OAuthError("invalid_grant", "redirect_uri does not match the authorization request");
  }
  if (String(row.resource) !== input.resource) {
    throw new OAuthError("invalid_target", "resource does not match the authorization request");
  }

  // PKCE S256 only. Compared in constant time -- the challenge is public but
  // the habit is cheap and the alternative is a subtle mistake to make twice.
  const expected = Buffer.from(String(row.code_challenge));
  const actual = Buffer.from(
    createHash("sha256").update(input.codeVerifier).digest("base64url"),
  );
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new OAuthError("invalid_grant", "PKCE verification failed");
  }

  const userId = String(row.user_id);
  const scopes = (row.scopes as string[]) ?? [];
  const spaceIds = (row.space_ids as string[]) ?? [];

  return withActor(userId, (tx) => mintTokens(tx, {
    clientId: input.clientId, userId, scopes, spaceIds,
    audience: String(row.resource), familyId: randomUUID(),
  }));
}

/**
 * Refresh, with rotation.
 *
 * The old refresh token is revoked and a new pair issued. If a revoked refresh
 * token is ever presented again, app_resolve_oauth_token revokes the entire
 * family -- a replayed refresh token means the chain leaked, and the safe
 * assumption is that both copies are now untrustworthy.
 */
export async function refreshTokens(input: {
  refreshToken: string;
  clientId: string;
  resource: string;
}): Promise<TokenSet> {
  const rows = await withoutActor(async (tx) =>
    tx.execute(sql`SELECT * FROM app_resolve_oauth_token(${sha256(input.refreshToken)}, 'refresh')`));

  const row = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!row) throw new OAuthError("invalid_grant", "That refresh token is not valid");

  if (row.was_reused === true) {
    throw new OAuthError("invalid_grant", "This refresh token was already used. All sessions for it have been revoked.");
  }
  if (String(row.client_id) !== input.clientId) {
    throw new OAuthError("invalid_grant", "Token was issued to a different client");
  }
  if (String(row.audience) !== input.resource) {
    throw new OAuthError("invalid_target", "resource does not match the token audience");
  }

  const userId = String(row.user_id);
  const tokenId = String(row.token_id);

  return withActor(userId, async (tx) => {
    await tx.update(oauthTokens).set({ revokedAt: new Date() })
      .where(eq(oauthTokens.id, tokenId));

    return mintTokens(tx, {
      clientId: input.clientId,
      userId,
      scopes: (row.scopes as string[]) ?? [],
      spaceIds: (row.space_ids as string[]) ?? [],
      audience: String(row.audience),
      familyId: String(row.family_id),
      rotatedFrom: tokenId,
    });
  });
}
