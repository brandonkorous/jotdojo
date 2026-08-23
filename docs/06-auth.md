# 06 — Authentication and authorization

Two audiences, two flows, one identity. This is the hardest engineering in the project and the least visible. Budget accordingly.

## Humans: Google OAuth

Google sign-in only. No passwords, no magic links, no other providers in v1.

Justified because every target audience — families, small teams, founders — is already on a Google account, and because it removes password reset, credential storage, and account recovery from the roadmap entirely.

Implementation: Auth.js in the Next.js app, session cookie, `google_sub` as the stable identity key. Email can change; `sub` cannot.

If a second provider is ever needed, Apple is next — Sign in with Apple matters for an iOS-heavy audience. Not v1.

## Agents: Jotacular is its own OAuth 2.1 server

**This is the part that surprises people.** When Claude connects to our MCP server, it runs an OAuth flow **against Jotacular**, not against Google. Google logging users into our website does nothing for MCP.

So Jotacular must be both:

- an **OAuth 2.1 Authorization Server** that MCP clients talk to, and
- a **Protected Resource** that validates the tokens it issued,

with **Google federated behind it** as the upstream identity provider.

### The flow

    Claude                    Jotacular AS                  Google
      |                           |                          |
      |-- discover PRM ---------->|                          |
      |<- AS metadata ------------|                          |
      |-- register (DCR/CIMD) --->|                          |
      |-- /authorize + PKCE ----->|                          |
      |                           |-- federated login ------>|
      |                           |<- id_token --------------|
      |                           |                          |
      |                      [consent screen: which client,  ]
      |                      [which spaces, which scopes     ]
      |                           |                          |
      |<- code --------------------|                         |
      |-- /token + PKCE + resource ->|                       |
      |<- access + refresh token ----|                       |

### Required endpoints

| Endpoint | Spec |
|---|---|
| `/.well-known/oauth-protected-resource` | RFC 9728 — points clients at the AS |
| `/.well-known/oauth-authorization-server` | RFC 8414 — AS metadata |
| `/oauth/register` | RFC 7591 dynamic client registration |
| `/oauth/authorize` | PKCE required, S256 only |
| `/oauth/token` | Authorization code + refresh grant |
| `/oauth/revoke` | RFC 7009 |
| `/oauth/jwks` | Signing keys |

### Non-negotiables

- **PKCE on every flow**, S256 only. No plain, no implicit grant, no password grant.
- **RFC 8707 resource indicators.** Clients must send `resource` on both the authorization and token request, and we must bind the token audience to it. This is the mechanism that stops a Jotacular token from being replayed at kanninja — and with a sibling product, that is not hypothetical.
- **Short access tokens** (1 hour), rotating refresh tokens, refresh reuse detection.
- **Exact redirect URI matching.** No wildcards, no prefix matching.

### Client registration: support both

**Dynamic Client Registration (RFC 7591)** is what most clients use today, but it has been downgraded from SHOULD to MAY and now carries an explicit deprecation warning.

**Client ID Metadata Documents** are the replacement: `client_id` is an HTTPS URL pointing at a JSON document the authorization server fetches.

Support both. DCR is the compatibility path for existing clients; CIMD is where the ecosystem is going. Record which was used in `mcp_clients.registration_source` so we can see the migration happen in our own data and retire DCR when it is safe.

CIMD fetching is an outbound HTTP request driven by a client-supplied URL — treat it as SSRF-sensitive. Allowlist schemes, block private address ranges, cap size and time, cache aggressively.

## The consent screen

The most important UI in the auth system, and the one users actually judge. It must state, in plain language:

- **Which client** is asking, by name — "Claude Desktop wants access"
- **Which spaces** it will reach, listed explicitly, each individually deselectable
- **What it can do**, in verbs not scope strings — "read your notes" and "leave comments", not `notes:read notes:comment`
- **That editing is separate** and off unless deliberately enabled
- **How to revoke**, with the settings location named

Default the space selection to the personal space only. Never pre-select a shared family or team space — that is somebody else's data and the grant should be a conscious act.

## Capture tokens (for Shortcuts)

iOS Shortcuts cannot run an OAuth flow. They need a long-lived bearer token, which is a real risk, so it is tightly constrained:

- **Capture-only.** Scope is `capture:write` and nothing else. It can create a note. It cannot read one, list one, or search.
- **Scoped to one space**, chosen at creation.
- **Individually named and revocable**, shown with last-used timestamp.
- **Never displayed twice.** Shown once at creation, stored hashed.
- Rate limited hard.

The blast radius of a leaked capture token is "a stranger can add notes to one of your spaces." Annoying, not catastrophic. That asymmetry is the whole design.

## Authorization model

Simple by construction:

- A user belongs to spaces via `space_members` with role `owner` or `member`.
- Owners can invite, remove, rename, delete the space, and manage billing.
- Members can do everything with notes.
- **There is no per-note permission.** If you are in the space, you see the space. Anything else is an org chart, and we are not building one.

Agent authority is always **derived from a user** — never independent. An agent cannot reach a space its granting user cannot reach, and it holds a subset of that user's rights, never a superset.
