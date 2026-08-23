import { SCOPES } from "@jotacular/domain";

/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414).
 *
 * This is how an MCP client discovers where to register and where to send the
 * user. apps/mcp points here from its RFC 9728 protected-resource metadata.
 *
 * No `jwks_uri`: our tokens are opaque, not JWTs. Revoking a JWT means keeping
 * a denylist anyway, and we already read the database per request for the
 * grant — so a JWT would buy nothing and cost a key-rotation story.
 */
export async function GET() {
  const issuer = process.env.APP_URL ?? "http://localhost:3400";

  return Response.json(
    {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      registration_endpoint: `${issuer}/oauth/register`,
      revocation_endpoint: `${issuer}/oauth/revoke`,
      scopes_supported: SCOPES,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      // S256 only. No plain, no implicit grant, no password grant.
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      // RFC 8707. Clients MUST send `resource`; we bind tokens to it.
      resource_indicators_supported: true,
      // RFC 7591 for now, Client ID Metadata Documents for what comes next.
      client_id_metadata_document_supported: true,
    },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
