import { registerClient, OAuthError } from "@jotdojo/domain";

/** Dynamic Client Registration (RFC 7591). Unauthenticated by design. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const client = await registerClient({
      client_name: typeof body.client_name === "string" ? body.client_name : undefined,
      redirect_uris: Array.isArray(body.redirect_uris) ? body.redirect_uris : [],
    });

    return Response.json(
      {
        ...client,
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof OAuthError) {
      return Response.json(
        { error: err.oauthCode, error_description: err.message },
        { status: 400 },
      );
    }
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
