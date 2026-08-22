# @jotdojo/api — REST v1

**Lands in M1.** See [docs/09-shortcuts.md](../../docs/09-shortcuts.md).

Fastify. Its whole reason to exist in M1 is one endpoint:

    POST https://api.jotdojo.com/v1/capture
    Authorization: Bearer <capture token>

- Under 300ms, or a Shortcut feels broken and gets deleted.
- Idempotent on a client-supplied `request_id` — Shortcuts retry on flaky connections.
- Returns a note URL so the notification can deep-link.
- Scope is `capture:write` on ONE space. It cannot read, list, or search. A leaked
  capture token means a stranger can add notes to one space — annoying, not
  catastrophic, and that asymmetry is the whole design.

Calls `@jotdojo/domain`. No SQL here, ever.
