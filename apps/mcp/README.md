# @jotdojo/mcp — MCP server + OAuth 2.1 authorization server

**Lands in M1. This is the hardest work in the project — budget generously.**

See [docs/05-mcp-server.md](../../docs/05-mcp-server.md) and
[docs/06-auth.md](../../docs/06-auth.md).

## Two jobs

1. **MCP server** — streamable HTTP at `https://mcp.jotdojo.com/mcp`, nine tools, thin
   adapter over `@jotdojo/domain`.
2. **OAuth 2.1 authorization server** — because when Claude connects it runs an OAuth
   flow against *us*, not against Google. Google is federated behind as the upstream IdP.

Required endpoints: `/.well-known/oauth-protected-resource` (RFC 9728),
`/.well-known/oauth-authorization-server` (RFC 8414), `/oauth/register` (RFC 7591 DCR
*and* Client ID Metadata Documents), `/oauth/authorize`, `/oauth/token`, `/oauth/revoke`,
`/oauth/jwks`.

Non-negotiable: PKCE S256 on every flow, **RFC 8707 resource indicators** (a jotdojo
token must not work at kanninja — with a live sibling this is not hypothetical), exact
redirect URI matching, rotating refresh tokens.

## Tool names are namespaced — ADR-016

kanninja exposes 42 tools and owns the generic names (`search`, `list_comments`,
`add_comment`). An agent doing our flow holds both servers. **Every jotdojo tool name
ends in `_note`, `_notes`, or `_spaces`.** No bare verbs.

    search_notes  get_note  list_notes  list_spaces  list_note_comments
    create_note   append_to_note  comment_on_note  update_note
