# 024 — Revoked and wrong-address give the same sentence

**Status:** open
**Severity:** nit
**Found by:** P01 Marisol · act 7 wrong move #3 · 2026-09-16
**Surface:** MCP › the 401
**Filed:** 2026-09-16
**Fixed:** —
**Confirmed by:** —
**Blocked on:** a file split

## What happened

Two different things happened in this run, minutes apart, and the server said the
same sentence about both:

| What was true | What it said |
| --- | --- |
| A token minted for the wrong `resource` (issue 020) | `That token is not valid for this server` |
| A token Marisol had just **revoked** from her account page | `That token is not valid for this server` |

They need opposite responses. The first means *your configuration is wrong, fix the
address and try again*. The second means *the person took your access away; stop
asking.* An agent told the first when the second is true will retry, re-authorize,
and pester somebody who has just decided they did not want it.

This is the rulebook's *one outcome, two causes* shape: one error message covering
two causes with different fixes.

## Where it lives

`apps/mcp/src/index.ts:65`:

```ts
const actor = await verifyAccessToken(token, RESOURCE);
if (!actor) return unauthorized("That token is not valid for this server");
```

`verifyAccessToken` returns `Actor | null`. One null for at least four causes:
never existed, revoked, expired, wrong audience.

## The fix, and why it is not taken here

It is small in shape — return a reason alongside the actor and branch on it — and it
lands in `packages/domain/src/oauth.ts`, which the root `CLAUDE.md` lists by name:

```
### Known violations
packages/domain/src/oauth.ts    564
```

> *These predate the rule and must be split the next time they are edited for any
> other reason. Do not batch-refactor them for their own sake.*

So the honest cost of this nit is **a 564-line file split by responsibility**, and
that is a deliberate piece of work rather than something to attach to a persona run.
Doing it badly — editing oauth.ts and leaving it at 570 lines — would be worse than
leaving the message alone.

When it is done, the seam is visible from here: what a token IS and how it is
verified, apart from the authorization-code dance that mints one.

## What is already right, and is recorded as a pass

**Revocation is immediate, exactly as the screen promises.** `/account` says:

> Revoking takes effect immediately — the agent's next request fails, it does not
> wait for a token to expire.

Tested as the wrong move it is: an agent session was opened, a question answered, the
connection disconnected from the account screen, and **the very next request on the
same session with the same unexpired token** — issued minutes earlier with an hour to
run — returned 401. Not on the next token refresh. The next request.

**Disconnecting asks first**, inline: *Disconnect Marisol's Claude?* with
**Disconnect** and **Keep**. `Keep` rather than `Cancel` is the better word, because
it says what happens rather than what does not.

## Rating effect

Part of the gap to 10 on `Account › Connected agents`, which scores 8/9 in act 7 —
the highest Ease in this run so far, and this is the only thing against it.
