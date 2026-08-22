/**
 * The OAuth 2.1 HTTP surface, over real HTTP.
 *
 * The domain-level suite (packages/domain/scripts/smoke-oauth.ts) proves the
 * logic. This proves the wiring: discovery, registration, the consent screen's
 * refusals, and the token endpoint's error contract. Requires the web app
 * running -- pnpm dev.
 */
export {}; // top-level await needs this file to be a module

const WEB = process.env.APP_URL ?? "http://localhost:3400";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
};

// --- discovery -----------------------------------------------------------

const metaRes = await fetch(`${WEB}/.well-known/oauth-authorization-server`);
check("AS metadata is served at the RFC 8414 path", metaRes.ok, String(metaRes.status));
const meta = await metaRes.json() as Record<string, unknown>;

check("advertises an authorization endpoint", typeof meta.authorization_endpoint === "string");
check("advertises a registration endpoint", typeof meta.registration_endpoint === "string");
check("advertises S256 ONLY (no plain)",
  Array.isArray(meta.code_challenge_methods_supported) &&
  meta.code_challenge_methods_supported.length === 1 &&
  meta.code_challenge_methods_supported[0] === "S256");
check("does NOT advertise the implicit grant",
  Array.isArray(meta.grant_types_supported) && !meta.grant_types_supported.includes("implicit"));
check("advertises RFC 8707 resource indicators", meta.resource_indicators_supported === true);
check("advertises no jwks_uri (tokens are opaque by design)", meta.jwks_uri === undefined);

// --- dynamic client registration ----------------------------------------

const reg = await fetch(`${WEB}/oauth/register`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    client_name: "HTTP Smoke Client",
    redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
  }),
});
check("DCR returns 201", reg.status === 201, String(reg.status));
const client = await reg.json() as { client_id?: string };
check("DCR returns a client_id", typeof client.client_id === "string");

const badReg = await fetch(`${WEB}/oauth/register`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ client_name: "Bad", redirect_uris: ["javascript:alert(1)"] }),
});
check("DCR rejects a javascript: redirect_uri", badReg.status === 400, String(badReg.status));

// --- token endpoint contract --------------------------------------------

const post = (body: Record<string, string>) =>
  fetch(`${WEB}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });

const noResource = await post({
  grant_type: "authorization_code", client_id: client.client_id!,
  code: "x", code_verifier: "y", redirect_uri: "https://claude.ai/api/mcp/auth_callback",
});
check("token endpoint REQUIRES resource (RFC 8707)", noResource.status === 400);
check("...and names the reason invalid_target",
  ((await noResource.json()) as { error?: string }).error === "invalid_target");

const badGrant = await post({
  grant_type: "password", client_id: client.client_id!, resource: "http://localhost:3402/mcp",
});
check("password grant is refused",
  ((await badGrant.json()) as { error?: string }).error === "unsupported_grant_type");

const badCode = await post({
  grant_type: "authorization_code", client_id: client.client_id!,
  code: "not-a-real-code", code_verifier: "v",
  redirect_uri: "https://claude.ai/api/mcp/auth_callback",
  resource: "http://localhost:3402/mcp",
});
check("an unknown code is invalid_grant",
  ((await badCode.json()) as { error?: string }).error === "invalid_grant");

check("revocation of an unknown token still returns 200 (RFC 7009)",
  (await fetch(`${WEB}/oauth/revoke`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: "nonexistent" }).toString(),
  })).status === 200);

// --- the consent screen's refusals ---------------------------------------
// These must render an error page rather than redirect: sending an error to an
// unverified redirect_uri would make us an open redirector.

const authorize = async (params: Record<string, string>) => {
  const res = await fetch(`${WEB}/oauth/authorize?${new URLSearchParams(params)}`, {
    redirect: "manual",
  });
  return { status: res.status, body: await res.text().catch(() => "") };
};

const base = {
  response_type: "code",
  client_id: client.client_id!,
  redirect_uri: "https://claude.ai/api/mcp/auth_callback",
  code_challenge: "abc",
  code_challenge_method: "S256",
  resource: "http://localhost:3402/mcp",
};

const noPkce = await authorize({ ...base, code_challenge: "", code_challenge_method: "" });
check("authorize refuses a request without PKCE", noPkce.body.includes("PKCE is required"));

const plainPkce = await authorize({ ...base, code_challenge_method: "plain" });
check("authorize refuses code_challenge_method=plain", plainPkce.body.includes("PKCE is required"));

const noResourceAuth = await authorize({ ...base, resource: "" });
check("authorize refuses a request without a resource",
  noResourceAuth.body.includes("resource parameter is required"));

const badRedirect = await authorize({ ...base, redirect_uri: "https://evil.example/cb" });
check("authorize refuses an unregistered redirect_uri (no open redirect)",
  badRedirect.body.includes("not registered") && badRedirect.status !== 302);

const unknownClient = await authorize({ ...base, client_id: "jd_client_does_not_exist" });
check("authorize refuses an unknown client", unknownClient.body.includes("Unknown client"));

const implicit = await authorize({ ...base, response_type: "token" });
check("authorize refuses response_type=token", implicit.body.includes("response_type=code"));

console.log(failures === 0 ? "\noauth http smoke: all checks passed" : `\noauth http smoke: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
