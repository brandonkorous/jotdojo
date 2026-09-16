# 020 — Consent was granted for a server this deployment does not run

**Status:** fixed
**Severity:** minor
**Found by:** P01 Marisol · act 7 · 2026-09-16
**Surface:** app › Let this agent in (`/oauth/authorize`)
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P01 Marisol · act 7 · 2026-09-16
**Blocked on:** —

## What happened

Driving the real OAuth flow as an MCP client would, the `resource` parameter was
typed as `http://localhost:3400/mcp` — the **web app's** address, with `/mcp` on the
end. The real MCP server is `http://localhost:3402/mcp`.

Everything worked. The consent screen appeared, listed three scopes and one space,
and **Allow** issued a code. The code exchanged for a real access token with a real
refresh token and a one-hour life.

Then the first request failed, and kept failing:

```
HTTP/1.1 401 Unauthorized
www-authenticate: Bearer resource_metadata="http://localhost:3402/.well-known/oauth-protected-resource"
{"error":"unauthorized","error_description":"That token is not valid for this server"}
```

The token was correctly refused. It was bound to a resource nothing serves, so it is
refused **everywhere, forever**.

## What should have happened

The wrong address is caught before she is asked to grant anything.

## Why it matters

`minor` — nothing is insecure. The audience binding is doing precisely its job, and
that job is tested below as a pass.

It matters because of **where the failure lands**. The one screen that could have
caught it is the one that showed her a green **Allow** button, and the error surfaces
minutes later inside her assistant, in a sentence she has no way to act on. She has
consented to something that could never work, and nothing in Jotacular knows.

It is not a hypothetical typo. `/account` hands out the address in a disclosure:

> **Using something else?** Any assistant that can connect to an address will work.
> Give it this one, and it will ask you to sign in: `http://localhost:3402/mcp`

Somebody who copies that from a help page, or from the wrong deployment, or types
the app's own address because that is the one they know, walks the whole flow.

RFC 8707 §2 is explicit that an authorization server should return `invalid_target`
for a resource it does not recognise. This one required `resource` and then accepted
any string at all.

## Where it lives

`apps/web/app/oauth/authorize/page.tsx`. It checked that `resource` was present and
never what it was:

```tsx
if (!resource) {
  return <Problem title="A resource parameter is required" ... />;
}
```

`.env` has known the answer all along — `MCP_RESOURCE=http://localhost:3402/mcp`,
and the account page already reads it to print the address.

## The fix

The same check, against the value this deployment actually serves:

```tsx
/** The one MCP server this deployment runs, as tokens are bound to it. */
const mcpResource = () => process.env.MCP_RESOURCE ?? "http://localhost:3402/mcp";

/** A trailing slash is the difference between two spellings of one address,
 *  never between two servers. */
const servedHere = (resource: string): boolean =>
  resource.replace(/\/+$/, "") === mcpResource().replace(/\/+$/, "");
```

and, before anything is granted:

> **That address is not this server** — This Jotacular serves
> `http://localhost:3402/mcp`. Give your assistant that address instead.
>
> Nothing was granted. You can close this page.

**It names the right address.** A refusal that says "wrong" and stops leaves somebody
with the same problem and less confidence; this one is a fix they can paste.

## What was already right, and is recorded as a pass

Two things on this path are done properly and would be easy to lose:

- **Audience binding works.** A token minted for `:3400/mcp` was refused by the
  server at `:3402/mcp`, with a correct `WWW-Authenticate` header pointing at the
  protected-resource metadata (RFC 9728). Measured, not assumed.
- **The token endpoint requires `resource` too**, not only the authorize endpoint —
  `{"error":"invalid_target","error_description":"resource is required (RFC 8707)"}`.

## Confirmed by

**P01 Marisol, act 7, 2026-09-16.** The same URL with the wrong resource now stops
at `That address is not this server`, naming `http://localhost:3402/mcp`. The
correct resource still reaches the consent screen, Allow still issues a code, and
that code exchanged for a token that MCP accepted — ten tools listed, four questions
answered.

## Rating effect

`Let this agent in` scores 8/8 in act 7 with this fixed. Before it, Ease was a 6:
the screen was clear and confident about a grant that could not work.
