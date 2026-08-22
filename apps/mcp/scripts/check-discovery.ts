/**
 * Walk the discovery chain exactly as an MCP client does, against any origin.
 *
 * The chain that has to hold before Claude can reach jotdojo is five hops long
 * and every hop is a URL one service asserts about another:
 *
 *   1. GET /mcp with no token       -> 401 + WWW-Authenticate: resource_metadata=...
 *   2. GET that metadata URL        -> { resource, authorization_servers: [as] }
 *   3. GET as/.well-known/oauth-authorization-server -> endpoints
 *   4. every endpoint is on the issuer and actually answers
 *   5. the whole thing is https, because clients refuse plaintext
 *
 * When one of those URLs is wrong the client does not say so. It says the
 * server is unreachable, or it loops on authorization, or every tool call
 * returns 401 with no explanation -- because a token minted for
 * `http://localhost:3402/mcp` is simply not valid for
 * `https://something.trycloudflare.com/mcp`, and the audience check doing its
 * job looks identical to the server being broken.
 *
 * So: run this against localhost now, and against the tunnel or the cluster the
 * moment it exists. It answers in two seconds what would otherwise be an
 * evening of reading client logs that do not contain the reason.
 *
 *   pnpm mcp:check                             # whatever .env points at
 *   pnpm mcp:check https://mcp.jotdojo.com     # a deployed origin
 */
// Nothing is imported here on purpose -- this script must behave exactly like
// an outside client, so it uses only fetch. `export {}` makes it a module so
// top-level await is legal.
export {};

const base = (process.argv[2] ?? process.env.MCP_RESOURCE ?? "http://localhost:3402/mcp")
  .replace(/\/+$/, "");
const mcpUrl = base.endsWith("/mcp") ? base : `${base}/mcp`;
const mcpOrigin = new URL(mcpUrl).origin;

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const isLocal = (u: string) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(u);

async function get(url: string, headers: Record<string, string> = {}) {
  try {
    const res = await fetch(url, { headers, redirect: "manual" });
    return { res, error: null as string | null };
  } catch (err) {
    return { res: null, error: (err as Error).message };
  }
}

console.log(`\nchecking ${mcpUrl}\n`);
console.log("hop 1 -- the unauthenticated challenge");

const probe = await get(mcpUrl);
check("the MCP endpoint answers at all", probe.res !== null, probe.error ?? undefined);
if (!probe.res) {
  console.log("\nNothing else can be checked until the endpoint responds.");
  process.exit(1);
}
check("it refuses an unauthenticated request with 401",
  probe.res.status === 401, `got ${probe.res.status}`);

const challenge = probe.res.headers.get("www-authenticate") ?? "";
check("the 401 carries a WWW-Authenticate header", challenge.length > 0);

const advertised = /resource_metadata="([^"]+)"/.exec(challenge)?.[1];
check("...naming resource_metadata, which is how a client finds the rest",
  Boolean(advertised), challenge || "(no header)");
if (!advertised) {
  console.log("\nA client cannot begin authorization without this. Stopping.");
  process.exit(1);
}

// The pointer must live on the host the client actually reached. Advertising a
// metadata URL on a different origin is the single most common way a tunnelled
// or reverse-proxied deployment fails: the client follows it, lands somewhere
// unreachable, and reports the SERVER as broken.
check("the metadata URL is on the origin the client just called",
  new URL(advertised).origin === mcpOrigin,
  `advertised ${new URL(advertised).origin}, client reached ${mcpOrigin}`);

console.log("\nhop 2 -- protected resource metadata (RFC 9728)");

const prmRes = await get(advertised);
check("the metadata document is fetchable", prmRes.res?.ok === true,
  prmRes.error ?? `status ${prmRes.res?.status}`);
if (!prmRes.res?.ok) process.exit(1);

const prm = await prmRes.res.json() as { resource?: string; authorization_servers?: string[] };

/**
 * The audience trap, and the reason this script exists.
 *
 * `resource` is the value the client will send as the RFC 8707 resource
 * indicator, and the value the token is minted against. verifyAccessToken then
 * compares it to the server's own MCP_RESOURCE. If the advertised `resource` is
 * not the URL the client actually reached, every authorized call fails a
 * confused-deputy check that is working perfectly -- and the client reports it
 * as a plain 401 with no reason attached.
 */
check("`resource` matches the URL the client called",
  prm.resource === mcpUrl,
  `advertised "${prm.resource}", client called "${mcpUrl}" -- set MCP_RESOURCE to the public URL`);

const as = prm.authorization_servers?.[0];
check("an authorization server is named", Boolean(as));
if (!as) process.exit(1);

console.log("\nhop 3 -- authorization server metadata (RFC 8414)");

const asMetaUrl = `${as.replace(/\/+$/, "")}/.well-known/oauth-authorization-server`;
const asRes = await get(asMetaUrl);
check(`AS metadata is fetchable at ${asMetaUrl}`, asRes.res?.ok === true,
  asRes.error ?? `status ${asRes.res?.status}`);
if (!asRes.res?.ok) {
  console.log("\nThe web app is not reachable from here. A client will fail the same way.");
  process.exit(1);
}

const meta = await asRes.res.json() as Record<string, unknown>;

// RFC 8414 requires issuer to equal the URL the metadata was fetched from,
// minus the well-known suffix. Clients enforce it; a mismatch is rejected as a
// possible mix-up attack rather than tolerated.
check("`issuer` matches where the metadata was found",
  meta.issuer === as.replace(/\/+$/, ""),
  `issuer "${meta.issuer}" vs "${as}"`);

check("S256 PKCE is offered",
  Array.isArray(meta.code_challenge_methods_supported)
  && (meta.code_challenge_methods_supported as string[]).includes("S256"));

check("resource indicators are advertised (RFC 8707)",
  meta.resource_indicators_supported === true);

console.log("\nhop 4 -- the endpoints it names");

const endpoints = [
  ["authorization_endpoint", meta.authorization_endpoint],
  ["token_endpoint", meta.token_endpoint],
  ["registration_endpoint", meta.registration_endpoint],
  ["revocation_endpoint", meta.revocation_endpoint],
] as const;

for (const [name, value] of endpoints) {
  if (typeof value !== "string") {
    check(`${name} is present`, false);
    continue;
  }
  check(`${name} is on the issuer origin`,
    new URL(value).origin === new URL(as).origin,
    `${value} is not on ${new URL(as).origin}`);

  // A 404 here means the route does not exist. Anything else -- 400, 405, even
  // a redirect to sign-in -- means it is there and objecting to how it was
  // called, which is what an unauthenticated GET deserves.
  const probeRes = await get(value);
  check(`${name} actually answers`,
    probeRes.res !== null && probeRes.res.status !== 404,
    probeRes.error ?? `status ${probeRes.res?.status}`);
}

console.log("\nhop 5 -- transport");

const origins = [mcpUrl, as];
const insecure = origins.filter((u) => u.startsWith("http://") && !isLocal(u));
check("every origin is https, or localhost",
  insecure.length === 0,
  `plaintext and not local: ${insecure.join(", ")} -- MCP clients refuse these`);

if (origins.every(isLocal)) {
  console.log("\n  note  Everything is on localhost. That is correct for development and");
  console.log("        cannot be reached by a hosted Claude client -- run this again");
  console.log("        against the tunnel or cluster origin before trying to connect.");
}

console.log(failures === 0
  ? "\ndiscovery chain: all checks passed"
  : `\ndiscovery chain: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
