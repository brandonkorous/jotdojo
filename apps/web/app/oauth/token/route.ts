import { exchangeAuthCode, refreshTokens, OAuthError } from "@jotdojo/domain";

const fail = (code: string, description: string, status = 400) =>
  Response.json({ error: code, error_description: description }, {
    status,
    headers: { "cache-control": "no-store" },
  });

/**
 * Token endpoint.
 *
 * Public clients only (`token_endpoint_auth_method: none`), so there is no
 * client secret to check — PKCE is what proves the exchanger started the flow.
 */
export async function POST(request: Request) {
  let form: URLSearchParams;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    form = contentType.includes("application/json")
      ? new URLSearchParams(Object.entries(await request.json()).map(([k, v]) => [k, String(v)]))
      : new URLSearchParams(await request.text());
  } catch {
    return fail("invalid_request", "Body could not be parsed");
  }

  const grantType = form.get("grant_type");
  const clientId = form.get("client_id");
  const resource = form.get("resource");

  if (!clientId) return fail("invalid_client", "client_id is required");

  // RFC 8707. Required, not optional: without it a token has no audience and
  // could be replayed at another resource server.
  if (!resource) {
    return fail("invalid_target", "resource is required (RFC 8707)");
  }

  try {
    if (grantType === "authorization_code") {
      const code = form.get("code");
      const verifier = form.get("code_verifier");
      const redirectUri = form.get("redirect_uri");
      if (!code || !verifier || !redirectUri) {
        return fail("invalid_request", "code, code_verifier and redirect_uri are required");
      }

      const tokens = await exchangeAuthCode({
        code, codeVerifier: verifier, clientId, redirectUri, resource,
      });
      return Response.json(tokens, { headers: { "cache-control": "no-store" } });
    }

    if (grantType === "refresh_token") {
      const refreshToken = form.get("refresh_token");
      if (!refreshToken) return fail("invalid_request", "refresh_token is required");

      const tokens = await refreshTokens({ refreshToken, clientId, resource });
      return Response.json(tokens, { headers: { "cache-control": "no-store" } });
    }

    return fail("unsupported_grant_type", `grant_type ${grantType} is not supported`);
  } catch (err) {
    if (err instanceof OAuthError) return fail(err.oauthCode, err.message);
    console.error("token endpoint failed", err);
    return fail("server_error", "Something went wrong", 500);
  }
}
