---
title: Why local MCP servers do not work from your phone
description: Almost every MCP server in the wild is a subprocess on a laptop. Here is exactly what that rules out, and what it costs to fix.
date: 2026-08-13
---

Search for MCP servers and you will find hundreds. Install one and the
instructions look like this:

```json
{
  "mcpServers": {
    "notes": {
      "command": "npx",
      "args": ["-y", "@someone/notes-mcp"]
    }
  }
}
```

That is a **local** server. The client launches `npx` as a child process and
talks to it over stdin and stdout. It works, it is easy to write, and it is the
default in every tutorial.

It also cannot be used from a phone, and that is not a temporary limitation.

## What "local" actually requires

For a local MCP server to run, four things must be true at once:

1. There is an operating system that lets an app spawn arbitrary child processes.
2. A runtime — Node, Python, a compiled binary — is installed.
3. The machine is powered on and the client is running on it.
4. The user can edit a JSON config file.

iOS satisfies none of the first three. Apps cannot fork arbitrary processes;
there is no `npx`; and there is no background machine of yours that the Claude
app on your phone could reach into. Android is the same story for the same
reasons. The web versions of these clients run in a browser tab and have no
subprocess model at all.

So "install an MCP server" quietly means "install it on one desktop computer,
and use it only there, only while that computer is awake."

## Why that matters more than it sounds

Think about when you actually reach for your notes. Standing in a shop. In the
car. At the end of a meeting. Waiting for a kid at practice.

Almost none of those moments happen at your desk. A notes integration that only
answers questions when you are already sitting at the machine where you could
have opened the notes app yourself is solving the easy half of the problem.

The same applies to anything shared. A local server runs as *you*, on *your*
machine, with *your* filesystem permissions. Two people cannot both use it, and
a team certainly cannot.

## The remote alternative, and what it costs

A remote MCP server is an HTTPS endpoint. Paste the URL into a client, sign in,
done — on any device, including the phone, including the web.

The reason so few exist is that "an HTTPS endpoint" drags a real list of work
behind it:

- **TLS and a hostname.** You are running a service now, with uptime.
- **Authorization.** No shared secret in a config file. You need OAuth 2.1 with
  PKCE, and you need dynamic client registration, because a client you have never
  heard of has to be able to register itself when someone pastes your URL.
- **Discovery.** RFC 8414 metadata at a well-known path, and RFC 9728 protected
  resource metadata so a 401 tells the client where to authenticate.
- **Token binding.** RFC 8707 resource indicators, so a token minted for your
  server is not usable at someone else's.
- **Multi-tenancy.** A local server trusts the filesystem. A remote one has to
  prove, on every single query, that this user reaches only their own rows.
- **Revocation.** People change their minds about which agent can read their
  notes. There has to be a list, and a button.

That is not a weekend. It is most of a product.

## The honest trade-off

Local servers are the right answer for developer tooling that touches your
working directory. Claude Code reading the repository in front of you should
absolutely be a local process — the data is local, the session is local, and
adding a network hop would be worse in every way.

Remote servers are the right answer for anything that is *about you* rather than
about the machine: your notes, your calendar, your files. That data already lives
on a server. Making the model reach it through your laptop is an accident of
which kind of server was easier to build.

## What to check before you adopt one

If you are choosing an MCP integration for something personal, three questions
sort the field quickly:

1. **Does the setup ask for a command, or a URL?** A command means desktop-only.
2. **Does it use OAuth, or an API key you paste?** A pasted key cannot be scoped
   or revoked per client, and it will end up in a config file in a backup.
3. **Can you see, and revoke, every agent that has connected?** If there is no
   list, there is no control.

---

We hit every one of these building Jotacular, which is why its MCP server is
remote: one URL, OAuth rather than a pasted key, and a list of connected agents
with a revoke button beside each. It works from the phone in your pocket.
[Try the notes half](/) first, without an account.
