/**
 * The OAuth 2.1 authorization server, exercised at the domain level.
 *
 * Every check here is a control that would look identical to a working one if
 * it were silently broken -- PKCE, audience binding, single-use codes, refresh
 * rotation, per-space grants. ADR-019's lesson, applied to the hardest code in
 * the project.
 */
import { createHash, randomBytes } from "node:crypto";
import {
  upsertUserFromGoogle, asUser, createNote, defaultSpaceId, listSpaces, listNotes,
  registerClient, issueAuthCode, exchangeAuthCode, refreshTokens, verifyAccessToken,
  revokeToken, listConnections, revokeConnection, getNote, DomainError,
} from "../src/index";

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}`);
  if (!ok) failures++;
};
/**
 * Asserts a DELIBERATE refusal, not merely that something went wrong.
 *
 * An earlier version accepted any thrown value, and passed for months of
 * nothing -- a SQL error inside the refresh-reuse path looked exactly like the
 * security check firing. A test that cannot tell a refusal from a crash is not
 * testing the refusal.
 */
const refused = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
    return false;
  } catch (err) {
    if (err instanceof DomainError) return true;
    console.log(`        (crashed rather than refused: ${(err as Error).message})`);
    return false;
  }
};

const RESOURCE = "https://mcp.jotdojo.com/mcp";
const OTHER_RESOURCE = "https://mcp.kanninja.com/mcp";
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";

const verifier = randomBytes(32).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");

const stamp = Date.now();
const u = await upsertUserFromGoogle({
  googleSub: `oauth-${stamp}`, email: `oauth-${stamp}@example.test`, displayName: "O",
});
const A = asUser(u.id);
const personal = await defaultSpaceId(A);
await createNote(A, personal, "the vet is on Tuesday");

const client = await registerClient({ client_name: "Claude Test", redirect_uris: [REDIRECT] });
check("DCR issues a client_id", client.client_id.startsWith("jd_client_"));
check("DCR rejects a client with no usable redirect_uri",
  await refused(() => registerClient({ client_name: "bad", redirect_uris: ["javascript:alert(1)"] })));

const mint = () => issueAuthCode({
  actor: A, clientId: client.client_id, redirectUri: REDIRECT, codeChallenge: challenge,
  scopes: ["notes:read", "notes:comment"], spaceIds: [personal], resource: RESOURCE,
});

check("wrong PKCE verifier is rejected", await refused(async () => exchangeAuthCode({
  code: await mint(), codeVerifier: "not-the-verifier",
  clientId: client.client_id, redirectUri: REDIRECT, resource: RESOURCE,
})));

check("mismatched redirect_uri is rejected", await refused(async () => exchangeAuthCode({
  code: await mint(), codeVerifier: verifier,
  clientId: client.client_id, redirectUri: "https://evil.example/cb", resource: RESOURCE,
})));

// RFC 8707. With a live sibling product this is not hypothetical.
check("a code for jotdojo cannot be exchanged for a kanninja token",
  await refused(async () => exchangeAuthCode({
    code: await mint(), codeVerifier: verifier,
    clientId: client.client_id, redirectUri: REDIRECT, resource: OTHER_RESOURCE,
  })));

const reuse = await mint();
const tokens = await exchangeAuthCode({
  code: reuse, codeVerifier: verifier, clientId: client.client_id,
  redirectUri: REDIRECT, resource: RESOURCE,
});
check("valid exchange returns a token set", Boolean(tokens.access_token && tokens.refresh_token));
check("access token expires in an hour", tokens.expires_in === 3600);
check("an authorization code is single use", await refused(() => exchangeAuthCode({
  code: reuse, codeVerifier: verifier, clientId: client.client_id,
  redirectUri: REDIRECT, resource: RESOURCE,
})));

const agent = await verifyAccessToken(tokens.access_token, RESOURCE);
check("access token resolves to an agent actor", agent?.type === "agent");
check("agent carries its granted scopes",
  agent?.type === "agent" && agent.scopes.includes("notes:read"));
check("token minted for jotdojo is REJECTED at kanninja's audience",
  (await verifyAccessToken(tokens.access_token, OTHER_RESOURCE)) === null);
check("a garbage token resolves to nothing",
  (await verifyAccessToken("nonsense", RESOURCE)) === null);

check("agent can read the granted space", (await listNotes(agent!, personal)).length === 1);
check("agent sees only granted spaces", (await listSpaces(agent!)).length === 1);
check("agent WITHOUT notes:append cannot create",
  await refused(() => createNote(agent!, personal, "should be refused")));

// A grant for one space must not reach another the user also belongs to.
const narrowed = { ...agent!, spaceIds: [] as string[] };
check("agent with no granted space cannot list",
  await refused(() => listNotes(narrowed, personal)));
const note = (await listNotes(agent!, personal))[0]!;
check("agent with no granted space cannot read a note by id",
  await refused(() => getNote(narrowed, note.id)));

// A tampered consent submission must not be able to grant a space the user
// does not belong to.
const stranger = await upsertUserFromGoogle({
  googleSub: `oauth-stranger-${stamp}`, email: `oauth-stranger-${stamp}@example.test`, displayName: "S",
});
const strangerSpace = await defaultSpaceId(asUser(stranger.id));
check("cannot grant a space you are not a member of", await refused(() => issueAuthCode({
  actor: A, clientId: client.client_id, redirectUri: REDIRECT, codeChallenge: challenge,
  scopes: ["notes:read"], spaceIds: [strangerSpace], resource: RESOURCE,
})));

const rotated = await refreshTokens({
  refreshToken: tokens.refresh_token, clientId: client.client_id, resource: RESOURCE,
});
check("refresh returns a NEW access token", rotated.access_token !== tokens.access_token);
check("refresh rotates the refresh token", rotated.refresh_token !== tokens.refresh_token);
check("the old access token is still valid until it expires",
  (await verifyAccessToken(tokens.access_token, RESOURCE)) !== null);

// Replaying a rotated-away refresh token means the chain leaked.
check("replaying the old refresh token is refused", await refused(() => refreshTokens({
  refreshToken: tokens.refresh_token, clientId: client.client_id, resource: RESOURCE,
})));
check("...and that revokes the whole family", await refused(() => refreshTokens({
  refreshToken: rotated.refresh_token, clientId: client.client_id, resource: RESOURCE,
})));

const fresh = await exchangeAuthCode({
  code: await mint(), codeVerifier: verifier, clientId: client.client_id,
  redirectUri: REDIRECT, resource: RESOURCE,
});
check("connection is listed on the account", (await listConnections(A)).length >= 1);
await revokeToken(fresh.access_token);
check("revocation kills the access token",
  (await verifyAccessToken(fresh.access_token, RESOURCE)) === null);

const again = await exchangeAuthCode({
  code: await mint(), codeVerifier: verifier, clientId: client.client_id,
  redirectUri: REDIRECT, resource: RESOURCE,
});
await revokeConnection(A, client.client_id);
check("revoking a connection kills its tokens",
  (await verifyAccessToken(again.access_token, RESOURCE)) === null);

console.log(failures === 0 ? "\noauth smoke: all checks passed" : `\noauth smoke: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
