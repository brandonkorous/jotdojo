# 036 — The write permission arrived already ticked

**Status:** fixed
**Severity:** major
**Found by:** reading the privacy page and the MCP post against the consent screen · 2026-09-16
**Surface:** app › Let this agent in (`/oauth/authorize`)
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** 2026-09-16
**Blocked on:** —

## What happened

The consent screen listed three permissions and **pre-ticked all of them**, including
the one that lets an agent write:

> It will be able to
> ☑ read your notes
> ☑ leave comments
> ☑ **add new notes and add to existing ones**

So a person who presses **Allow** without reading — which is what people do on a
screen that has already told them the name of a brand they trust — has granted an
agent write access to everything in the space.

## Three places say it should not have been

**`packages/domain/src/oauth.ts:18`**, on the constant itself:

```ts
/** Off by default. An agent gets edit rights only by a deliberate act. ADR-004. */
export const DEFAULT_SCOPES: Scope[] = ["notes:read", "notes:comment"];
```

**The privacy page**, under *Agents, and what they can reach*:

> **Editing your notes is off by default.** An agent that has not been granted it can
> read and comment, and that is all.

**The MCP post on the marketing site**, in the paragraph about what a server owes its
users:

> Our answer is that an agent's default output is a comment rather than an edit,
> every agent change is attributed and revertible, and **destructive scopes are off
> until someone deliberately turns them on.**

**Pre-ticking is not deliberate.** It is the opposite: it makes granting the write
the default outcome of not reading.

## The cause

`DEFAULT_SCOPES` existed and was used for only half its job — as a fallback for a
client that asks for nothing:

```tsx
const scopes = (requested.length ? requested : DEFAULT_SCOPES)
```

and then every scope in that list was rendered with a bare `defaultChecked`. A
client that *does* ask for `notes:append` — which Claude does — had it ticked for
them.

**The screen already knows how to do this correctly, ten lines further down.** The
space list does exactly the right thing:

```tsx
defaultChecked={space.id === personal?.id}
```

Only the personal space is pre-selected; a shared space is not — which is the
privacy page's other promise, *"The consent screen never pre-selects a shared
space"*, kept. The same care was applied to which spaces and not to which powers.

## Why it matters

**This is the screen that decides what a piece of software may do to everything
somebody has ever written.** Issue 018 hardened it against framing and issue 028
against a forged name; this is the third thing about it, and the only one that was
wrong about what the customer was actually agreeing to.

It also compounds two other findings. Issue 021 records that the screen offers write
scopes to a free space that will refuse them — so a free user was pre-ticking a
permission that could not work. And issue 029's whole subject is what happens when an
agent writes: until today nothing showed it and nothing undid it.

## The fix

One expression, using the constant that already held the answer:

```tsx
// Ticked only if it is one of DEFAULT_SCOPES — read and comment. Writing
// arrives unticked, because ADR-004 says on that constant "an agent gets edit
// rights only by a deliberate act", and pre-ticking it is not deliberate. The
// space list below has always worked this way. Issue 036.
defaultChecked={(DEFAULT_SCOPES as readonly string[]).includes(scope)}
```

**The write is still offered.** Nothing is hidden and nothing is harder to find — the
box is right there, labelled in plain words, one tap away. What changed is that
tapping it is now the deliberate act ADR-004 asks for.

## Confirmed by

**2026-09-16.** The real consent screen, for a client requesting all three scopes:

> It will be able to
> ☑ read your notes
> ☑ leave comments
> ☐ **add new notes and add to existing ones**

Five suites green — `oauth`, `oauth:http-smoke`, `mcp`, `api`, `review`. Typecheck
clean.

## Rating effect

`Let this agent in` holds 8/8, which is uncomfortable for the third time: the screen
looks and reads well, and this is the third fact it was getting wrong underneath.
Its gap column now names all three — 018, 028 and this.
