import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  withActor, withoutActor, oauthClients, oauthAuthCodes, oauthTokens, mcpClients, spaces,
  type Tx,
} from "@jotdojo/db";
import type { Actor } from "./actor";
import { DomainError, Forbidden } from "./errors";
import { listSpaces } from "./spaces";

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export const SCOPES = ["notes:read", "notes:comment", "notes:append", "notes:edit"] as const;
export type Scope = (typeof SCOPES)[number];

/** Off by default. An agent gets edit rights only by a deliberate act. ADR-004. */
export const DEFAULT_SCOPES: Scope[] = ["notes:read", "notes:comment"];

const CODE_TTL_MS = 60_000;          // 1 minute. A code is exchanged immediately.
const ACCESS_TTL_MS = 60 * 60_000;   // 1 hour.
const REFRESH_TTL_MS = 30 * 24 * 60 * 60_000;

export class OAuthError extends DomainError {
  constructor(readonly oauthCode: string, description: string, status = 400) {
    super(description, oauthCode, status);
  }
}

// --- client registration -------------------------------------------------

export type ClientRecord = {
  clientId: string;
  clientName: string | null;
  redirectUris: string[];
  registrationSource: "dcr" | "cimd" | "preregistered";
};

export async function getClient(clientId: string): Promise<ClientRecord | null> {
  return withoutActor(async (tx) => {
    const rows = await tx.select().from(oauthClients)
      .where(eq(oauthClients.clientId, clientId)).limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      clientId: row.clientId,
      clientName: row.clientName,
      redirectUris: row.redirectUris,
      registrationSource: row.registrationSource as ClientRecord["registrationSource"],
    };
  });
}

async function saveClient(
  clientId: string, name: string | null, redirectUris: string[],
  source: ClientRecord["registrationSource"], metadata: unknown,
): Promise<void> {
  await withoutActor(async (tx) => {
    await tx.execute(sql`
      SELECT app_register_oauth_client(
        ${clientId}, ${name}, ${sql.raw(`ARRAY[${redirectUris.map((u) => `'${u.replace(/'/g, "''")}'`).join(",") || "NULL"}]::text[]`)},
        ${source}, ${JSON.stringify(metadata ?? null)}::jsonb
      )
    `);
  });
}

/**
 * Dynamic Client Registration (RFC 7591).
 *
 * Still the compatibility path most MCP clients use, though it has been
 * downgraded to MAY and now carries a deprecation warning in favour of Client
 * ID Metadata Documents. We support both and record which was used, so the
 * migration is visible in our own data before we retire this. docs/06-auth.md.
 */
export async function registerClient(input: {
  client_name?: string;
  redirect_uris?: string[];
}): Promise<{ client_id: string; client_name: string | null; redirect_uris: string[] }> {
  const redirectUris = (input.redirect_uris ?? []).filter(isValidRedirectUri);
  if (redirectUris.length === 0) {
    throw new OAuthError("invalid_redirect_uri", "At least one https or loopback redirect_uri is required");
  }

  const clientId = `jd_client_${randomBytes(16).toString("hex")}`;
  await saveClient(clientId, input.client_name ?? null, redirectUris, "dcr", input);
  return { client_id: clientId, client_name: input.client_name ?? null, redirect_uris: redirectUris };
}

function isValidRedirectUri(uri: string): boolean {
  try {
    const u = new URL(uri);
    // https anywhere, or http only on loopback (native clients).
    if (u.protocol === "https:") return true;
    if (u.protocol === "http:" && (u.hostname === "127.0.0.1" || u.hostname === "localhost")) return true;
    // Custom scheme for native apps, e.g. claude://oauth/callback
    return /^[a-z][a-z0-9+.-]*:$/.test(u.protocol) && !["javascript:", "data:", "file:"].includes(u.protocol);
  } catch {
    return false;
  }
}

/**
 * Client ID Metadata Documents: the client_id IS an https URL to a JSON
 * document we fetch. This is where the ecosystem is going, and it removes the
 * write-endpoint that DCR requires.
 *
 * The fetch is driven by a URL the caller supplies, which makes it SSRF-shaped.
 * Guarded accordingly: https only, no credentials, DNS resolved and checked
 * against private ranges before we connect, size and time capped, and the
 * result cached so a hostile host cannot be probed repeatedly through us.
 */
export async function resolveCimdClient(clientIdUrl: string): Promise<ClientRecord> {
  const cached = await getClient(clientIdUrl);
  if (cached) return cached;

  let url: URL;
  try {
    url = new URL(clientIdUrl);
  } catch {
    throw new OAuthError("invalid_client", "client_id is not a valid URL");
  }

  if (url.protocol !== "https:") {
    throw new OAuthError("invalid_client", "A Client ID Metadata Document must be https");
  }
  if (url.username || url.password) {
    throw new OAuthError("invalid_client", "client_id must not carry credentials");
  }
  await assertPublicHost(url.hostname);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  let body: string;
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "error", // A redirect could hop to a private address post-check.
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new OAuthError("invalid_client", `Metadata document returned ${res.status}`);
    body = (await res.text()).slice(0, 64_000);
  } catch (err) {
    if (err instanceof OAuthError) throw err;
    throw new OAuthError("invalid_client", "Could not fetch the Client ID Metadata Document");
  } finally {
    clearTimeout(timer);
  }

  let doc: { client_name?: string; redirect_uris?: string[]; client_id?: string };
  try {
    doc = JSON.parse(body);
  } catch {
    throw new OAuthError("invalid_client", "Metadata document is not valid JSON");
  }

  // The document must claim the same identity it was fetched from, or a
  // document could impersonate another client.
  if (doc.client_id && doc.client_id !== clientIdUrl) {
    throw new OAuthError("invalid_client", "Metadata document client_id does not match its URL");
  }

  const redirectUris = (doc.redirect_uris ?? []).filter(isValidRedirectUri);
  if (redirectUris.length === 0) {
    throw new OAuthError("invalid_client", "Metadata document lists no usable redirect_uris");
  }

  await saveClient(clientIdUrl, doc.client_name ?? null, redirectUris, "cimd", doc);
  return {
    clientId: clientIdUrl,
    clientName: doc.client_name ?? null,
    redirectUris,
    registrationSource: "cimd",
  };
}

/** Blocks loopback, link-local, and RFC1918 destinations before we connect. */
async function assertPublicHost(hostname: string): Promise<void> {
  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true }).catch(() => []);

  if (addresses.length === 0) {
    throw new OAuthError("invalid_client", "Could not resolve the client_id host");
  }

  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new OAuthError("invalid_client", "client_id host resolves to a private address");
    }
  }
}

function isPrivateAddress(ip: string): boolean {
  if (ip.includes(":")) {
    const v6 = ip.toLowerCase();
    return v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
  }
  const parts = ip.split(".").map(Number);
  const [a = 0, b = 0] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

// --- authorization code --------------------------------------------------

export async function issueAuthCode(input: {
  actor: Actor;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: Scope[];
  spaceIds: string[];
  resource: string;
}): Promise<string> {
  if (input.actor.type !== "user") throw new Forbidden("Only a signed-in person can grant access");

  // You can only grant what you have. The consent form's space list is
  // client-supplied, so a tampered submission could otherwise mint a grant for
  // a space the user does not belong to -- RLS would not catch it, because
  // space_ids is just an array column on the code row, not a foreign key the
  // policies see.
  const reachable = new Set((await listSpaces(input.actor)).map((s) => s.id));
  for (const spaceId of input.spaceIds) {
    if (!reachable.has(spaceId)) {
      throw new Forbidden("You are not a member of one of those spaces");
    }
  }

  const code = randomBytes(32).toString("base64url");
  const userId = input.actor.userId;

  await withActor(userId, async (tx) => {
    await tx.insert(oauthAuthCodes).values({
      codeHash: sha256(code),
      clientId: input.clientId,
      userId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      scopes: input.scopes,
      spaceIds: input.spaceIds,
      resource: input.resource,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    });
  });

  return code;
}

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
 * stops a jotdojo code becoming a kanninja token, which with a live sibling on
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

/**
 * Validate a bearer token and produce an agent actor.
 *
 * The audience check is the confused-deputy defence: a token minted for
 * kanninja must not work here, and vice versa. RFC 8707.
 */
export async function verifyAccessToken(
  token: string, expectedAudience: string,
): Promise<Actor | null> {
  const rows = await withoutActor(async (tx) =>
    tx.execute(sql`SELECT * FROM app_resolve_oauth_token(${sha256(token)}, 'access')`));

  const row = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!row || row.was_reused === true) return null;
  if (String(row.audience) !== expectedAudience) return null;

  return {
    type: "agent",
    userId: String(row.user_id),
    clientId: String(row.client_id),
    clientRecordId: String(row.mcp_client_id),
    scopes: (row.scopes as string[]) ?? [],
    spaceIds: (row.space_ids as string[]) ?? [],
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

export type Connection = {
  clientId: string;
  clientName: string | null;
  scopes: string[];
  spaceIds: string[];
  /** Resolved so the page can say "your family notes", not a uuid. */
  spaceNames: string[];
  lastUsedAt: Date | null;
  createdAt: Date;
};

/**
 * What the account page shows: every agent that can reach your notes.
 *
 * docs/13-security-and-privacy.md promises people can see and revoke this. A
 * promise with no page behind it is not a control, so this is the query that
 * page runs.
 *
 * Grouped by client, because refresh rotation issues a new token on every use
 * and one connection would otherwise appear as a long list of itself. The
 * union of scopes and spaces across a client's live tokens is what that client
 * can actually reach, which is the honest thing to display.
 */
export async function listConnections(actor: Actor): Promise<Connection[]> {
  if (actor.type !== "user") throw new Forbidden();
  return withActor(actor.userId, async (tx) => {
    const rows = await tx.select({
      clientId: oauthTokens.clientId,
      clientName: oauthClients.clientName,
      scopes: oauthTokens.scopes,
      spaceIds: oauthTokens.spaceIds,
      lastUsedAt: oauthTokens.lastUsedAt,
      createdAt: oauthTokens.createdAt,
    })
      .from(oauthTokens)
      .leftJoin(oauthClients, eq(oauthClients.clientId, oauthTokens.clientId))
      .where(and(
        eq(oauthTokens.userId, actor.userId),
        eq(oauthTokens.kind, "refresh"),
        isNull(oauthTokens.revokedAt),
      ));

    const merged = new Map<string, Connection>();
    for (const row of rows) {
      const existing = merged.get(row.clientId);
      if (!existing) {
        merged.set(row.clientId, {
          clientId: row.clientId,
          clientName: row.clientName ?? null,
          scopes: [...(row.scopes ?? [])],
          spaceIds: [...(row.spaceIds ?? [])],
          spaceNames: [],
          lastUsedAt: row.lastUsedAt,
          createdAt: row.createdAt,
        });
        continue;
      }
      for (const scope of row.scopes ?? []) {
        if (!existing.scopes.includes(scope)) existing.scopes.push(scope);
      }
      for (const id of row.spaceIds ?? []) {
        if (!existing.spaceIds.includes(id)) existing.spaceIds.push(id);
      }
      // Oldest grant, newest use: "connected in March, last used an hour ago"
      // is the sentence someone auditing their account wants to read.
      if (row.createdAt < existing.createdAt) existing.createdAt = row.createdAt;
      if (row.lastUsedAt && (!existing.lastUsedAt || row.lastUsedAt > existing.lastUsedAt)) {
        existing.lastUsedAt = row.lastUsedAt;
      }
    }

    const connections = [...merged.values()];
    const wanted = [...new Set(connections.flatMap((c) => c.spaceIds))];
    if (wanted.length > 0) {
      // RLS scopes this to spaces the user is in, so a space id that somehow
      // does not belong to them resolves to nothing rather than leaking a name.
      const names = new Map(
        (await tx.select({ id: spaces.id, name: spaces.name }).from(spaces)
          .where(inArray(spaces.id, wanted)))
          .map((r) => [r.id, r.name]),
      );
      for (const c of connections) {
        c.spaceNames = c.spaceIds.map((id) => names.get(id) ?? "a space you have left");
      }
    }

    return connections.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  });
}

export async function revokeConnection(actor: Actor, clientId: string): Promise<void> {
  if (actor.type !== "user") throw new Forbidden();
  await withActor(actor.userId, async (tx) => {
    await tx.update(oauthTokens).set({ revokedAt: new Date() })
      .where(and(eq(oauthTokens.userId, actor.userId), eq(oauthTokens.clientId, clientId)));
  });
}
