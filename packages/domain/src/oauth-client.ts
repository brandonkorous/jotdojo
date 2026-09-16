/**
 * Who is asking: an application registers itself, or publishes a document that
 * says who it is. Split out of oauth.ts, ADR-117.
 */

import { randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { eq, sql } from "drizzle-orm";
import { withoutActor, oauthClients } from "@jotacular/db";
import { OAuthError } from "./oauth";

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
