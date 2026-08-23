---
title: What MCP actually is, for people who keep hearing about it
description: A protocol for letting a model call your software. No magic, three moving parts, and one design decision that matters more than the rest.
date: 2026-08-10
---

You have probably seen "MCP" three times this week and skipped past it. Here is
the short version, without the diagram.

## The problem it solves

A language model can only work with what is in front of it. If your notes, your
tickets or your calendar are somewhere else, the model cannot see them — so for
years every integration was bespoke: one company writes a ChatGPT plugin, another
writes a Claude tool, a third writes a LangChain wrapper, and none of them
transfer.

The **Model Context Protocol** is the boring fix. It is one wire format for
"here are some tools, here is what they take, here is what they return." Write a
server once and every client that speaks MCP can use it.

That is genuinely all it is. The interesting part is not the protocol.

## Three moving parts

**Tools** are functions the model may call. Each has a name, a JSON schema for
its arguments, and a description the model reads to decide whether to call it.
`search_notes(query, limit)` is a tool. So is `create_note(body)`.

**Resources** are things the model may read by URI, without a function call.
Useful for documents and files; most servers get by with tools alone.

**Prompts** are canned instructions a client can surface to the user. Genuinely
optional, and widely ignored.

If you only remember one of the three, remember tools.

## Local versus remote

An MCP server can run two ways, and the difference decides whether the thing you
build is useful on a phone.

A **local** server runs on your machine as a subprocess. The client launches it
and talks over stdin and stdout. This is what almost every MCP tutorial shows,
because it is easy: no hosting, no authentication, no TLS. It is also why so many
MCP servers are desktop-only — [there is no subprocess to
launch](/blog/local-mcp-servers-and-your-phone) on an iPhone.

A **remote** server is an HTTPS endpoint. The client connects over the network,
authenticates with OAuth, and stays connected. Harder to build, and the only
option that works from a phone, from the web app, and from a colleague's laptop
at the same time.

## The decision that matters: authorization

Here is the part people underestimate. The moment your server is remote, it needs
to answer "who is this, and what may they do?" — and the answer must not be a
long-lived API key pasted into a settings box.

The current MCP specification builds on OAuth 2.1 and a small stack of RFCs:

- **PKCE** (RFC 7636), S256 only. No client secret, because a desktop client
  cannot keep one.
- **Authorization server metadata** (RFC 8414), so a client can discover your
  endpoints from a well-known URL instead of being configured by hand.
- **Dynamic client registration** (RFC 7591), so a client the server has never
  seen can register itself. This is what makes "paste a URL" work at all.
- **Protected resource metadata** (RFC 9728), so a 401 tells the client *where*
  to go and authenticate.
- **Resource indicators** (RFC 8707), so an access token is bound to one specific
  server and cannot be replayed against another.

That last one is worth dwelling on. Without it, a token minted for one MCP server
is a bearer token that any other server will accept if it shares an
authorization server. With it, the token names the resource it was issued for and
nothing else will take it.

## What it is not

MCP does not make the model smarter, and it is not a plugin marketplace. It does
not sandbox anything — a tool that deletes rows will delete rows when called.

The safety story is yours to build, in your own server: which scopes a grant
carries, what a write actually does, and whether the person can see and undo it
afterwards. Our answer is that an agent's default output is a comment rather than
an edit, every agent change is attributed and revertible, and destructive scopes
are off until someone deliberately turns them on.

## The shape of a useful server

If you take one thing from this: the hard parts of an MCP server are not the
protocol. They are

1. **hosting it remotely**, so it works where the user is,
2. **authorizing it properly**, so a token is scoped and revocable, and
3. **designing tools a model can actually use** — few, well-named, with
   descriptions written for a reader who has never seen your product.

The wire format is a weekend. The other three are the work.

---

We built Jotacular because we wanted this working from a phone rather than from a
desk. Write a note — typed or by hand — and Claude can read it from anywhere.
[Try it](/), no account needed.
