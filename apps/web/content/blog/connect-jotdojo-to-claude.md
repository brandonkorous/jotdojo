---
title: Connecting jotdojo to Claude, ChatGPT and Claude Code
description: One URL, an OAuth screen, and a choice of which space the agent may reach. Ten minutes, including reading this.
date: 2026-08-17
---

jotdojo's MCP server is remote, so connecting it is the same three steps
everywhere: paste a URL, sign in, choose what the agent may reach. There is no
config file and nothing to install.

The URL is always the same:

```
https://mcp.jotdojo.com/mcp
```

## Claude (web, desktop and mobile)

1. Open **Settings → Connectors**.
2. Choose **Add custom connector**.
3. Paste the URL and confirm.

Claude registers itself with our authorization server automatically — that is
dynamic client registration, RFC 7591, and it is why you never enter a client id
or a secret. You are then sent to a jotdojo consent screen that shows:

- which Google account you are signing in as,
- **which spaces** the connection may reach, one checkbox each,
- **which scopes** it is asking for.

Grant the personal space and leave the family one unticked, and the connection
genuinely cannot see the family one. This is per client *per space*, not a single
switch for your whole account.

Once it is connected, ask it something you know the answer to:

> What did I write about the roof quote?

## ChatGPT

Under **Settings → Connectors**, add a custom connector with the same URL. The
consent screen is ours, so the choices are the same. Tool availability inside a
conversation depends on your ChatGPT plan and mode; that part is theirs, not ours.

## Claude Code

From a terminal:

```bash
claude mcp add --transport http jotdojo https://mcp.jotdojo.com/mcp
```

Then run `/mcp` inside Claude Code and pick **Authenticate**. Your browser opens,
you approve the same consent screen, and the session is authorized. Note that
this is still the *remote* server — Claude Code is simply another client. Nothing
runs on your machine.

This is the combination worth setting up if you write software: capture a rough
idea on your phone in the morning, then in the afternoon ask Claude Code to read
that note and start on it, without retyping anything.

## What the agent can actually do

Read-only, on every plan:

| Tool | What it does |
|---|---|
| `search_notes` | Hybrid lexical and semantic search, returning ranked snippets |
| `get_note` | The full note as markdown, with per-block provenance |
| `list_notes` | Reverse-chronological, for "what did I capture this week" |
| `list_spaces` | Which spaces this connection reaches |
| `list_note_comments` | Comments on a note, human and agent |

Writes, on a paid plan and only if you granted the scope:

| Tool | Scope |
|---|---|
| `comment_on_note` | `notes:comment` — the default agent output |
| `append_to_note` | `notes:append` — additive, so nothing can be lost |
| `create_note` | `notes:append` |
| `update_note` | `notes:edit` — off by default, opted into per space |

The ordering is deliberate. An agent's default way of saying something is a
**comment**, not an edit. Appending is preferred over replacing because appending
cannot destroy anything. Replacing block content requires a scope you have to
turn on yourself, per space, having been told what it means.

Every agent-authored block and comment is stored with the client that wrote it
and the model that produced it, and every revision can be put back. The principle
we borrow from our sibling product: the model suggests, you decide, in that order.

## Revoking

Open **Account → Connections** in jotdojo. Every client that has ever connected is
listed with when it last used the connection, and there is a revoke button beside
each. Revoking one person's Claude does not affect anyone else's, even in a
shared space — a grant is per user per client, not per application.

## Two things that trip people up

**"It says it cannot find anything."** Check which spaces you granted. The most
common cause is that the note is in a space the connection was not given.

**"It can read but not write."** That is the free plan. Reading your notes is
free for as long as you want it; letting Claude add to them and comment on them
is the paid part.

---

You can try the writing half with no account at all — [type something on the home
page](/) and it is saved before you ever sign in.
