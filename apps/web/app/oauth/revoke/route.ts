import { revokeToken } from "@jotacular/domain";

/**
 * Token revocation (RFC 7009).
 *
 * Always 200, even for an unknown token: the response must not reveal whether
 * a token existed. Revoking any token in a family revokes the family.
 */
export async function POST(request: Request) {
  try {
    const form = new URLSearchParams(await request.text());
    const token = form.get("token");
    if (token) await revokeToken(token);
  } catch {
    // Deliberately swallowed, per the note above.
  }
  return new Response(null, { status: 200, headers: { "cache-control": "no-store" } });
}
