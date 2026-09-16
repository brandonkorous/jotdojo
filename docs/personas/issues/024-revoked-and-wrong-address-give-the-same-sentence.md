# 024 — Revoked and wrong-address give the same sentence

**Status:** fixed
**Severity:** nit
**Found by:** P01 Marisol · act 7 wrong move #3 · 2026-09-16
**Surface:** MCP › the 401
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** the live MCP 401 · 2026-09-16
**Blocked on:** —

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

---

## Fixed, 2026-09-16 — the file split was paid, and the seam was where this said

The honest cost this issue recorded was a 564-line file split. It was paid. `oauth.ts`
was the last entry on `CLAUDE.md`'s known-violations list, and the rule says such a
file splits the next time it is edited for another reason — which this was.

    oauth.ts              the shared words: a scope, a failure, how long a grant lives
    oauth-client.ts       who is asking -- registration, and the document that proves it
    oauth-grant.ts        what a person agreed to, for one minute
    oauth-mint.ts         turning that into a pair of tokens, and rotating it safely
    oauth-token.ts        what a bearer token is worth, and why it is not
    oauth-connections.ts  what a person can see on their account, and take back

The seam named from the outside when this was filed — *"what a token IS and how it is
verified, apart from the authorization-code dance that mints one"* — is the one that
was there. Longest file is now 187 lines. No caller outside the package changed name,
because they all import from the barrel.

## Two reasons, not four, and that is deliberate

`verifyAccessToken` returns `{ ok: true, actor }` or `{ ok: false, why }`, where `why`
is `wrong_server` or `not_current`.

**Revoked, expired and never-issued stay together.** `app_resolve_oauth_token` returns
no row for all three, and telling them apart needs a migration. They are not separated
because **they have the same answer**: do not retry with this token. The cause that
needed the *opposite* answer was the fourth one, wrong audience, and that is the one
that now stands alone. The seam is cut where the responses diverge, not where the
causes do. ADR-117.

The domain names the reason; `apps/mcp` says the sentence, because the wording of a
401 belongs to the endpoint.

`not_current` names the whole ladder rather than one rung — refresh first, and if that
is refused too you were disconnected — which is true whether the token expired or the
person revoked it.

## Confirmed by

**2026-09-16**, at the live MCP endpoint on `:3402`, with real tokens minted through
the real grant flow. Four requests, and the two that used to be one sentence:

```
no token at all
  401  A bearer token is required

a token minted for ANOTHER server        <- issue 020's shape
  401  That token was issued for a different server.
       Check the address you connected to.

a token the person REVOKED               <- this issue's second row
  401  That token is not current. Refresh it -- if the refresh is
       refused too, the person has disconnected you.

garbage
  401  That token is not current. ...

a live token, for contrast
  200  eleven tools listed
```

The two rows of this issue's table now read differently, and they tell an agent to do
opposite things.

`pnpm oauth:smoke` — **31 of 31**, including a new check that holds a live
wrong-audience token beside a revoked one:

```
ok    token minted for jotacular is REJECTED at kanninja's audience
ok    a garbage token resolves to nothing
ok    revocation kills the access token
ok    a revoked token and a wrong-address one are told APART
ok    revoking a connection kills its tokens
```

That new check **failed on its first run**, correctly. It reached for a token whose
whole family had already been revoked earlier in the script, so both halves read
`not_current`. A test that cannot produce the two states cannot prove they are
distinguished; it was moved to where a live token exists.

## Rating effect

`Account › Connected agents` scored 8/9 with this as the only thing against Ease.
Re-scored — see `rating.md`.
