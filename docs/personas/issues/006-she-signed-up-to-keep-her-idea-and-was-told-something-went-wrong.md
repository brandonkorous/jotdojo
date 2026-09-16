# 006 — She signed up to keep her idea and was told "Something went wrong"

**Status:** fixed
**Severity:** major
**Found by:** P01 · Marisol Okonkwo-Vance · act 3
**Surface:** app › the claim handoff, between Sign in and the canvas
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** re-ran P01 act 3 end to end — see below
**Blocked on:** —

**Scope, stated up front so nobody over- or under-reacts:** this breaks the
**developer sign-in** (`ALLOW_DEV_LOGIN=true`) only. The Google path is a document
navigation and is very probably unaffected — **that is reasoned, not measured**
(RULE #4), because this environment has no Google credentials. What it definitely
breaks is every persona run in this folder, because every persona signs in this
way.

## What happened

Marisol typed her idea into the hero on the marketing site, tapped **Keep this**,
and signed in with her email. She landed on:

> **Something went wrong**
> This one is ours, not yours. Trying again often clears it. Nothing you wrote has
> been lost.
> [ Try again ] [ Back to the canvas ]

**Her jot was fine.** Checked in the database afterwards: the user row was created,
the anonymous session was marked claimed, a space called `From the web` exists, and
her note is in it with the right title. Every part of the operation succeeded.

She has no way to know that. The first thing this product ever told her about the
thought she was nervous about losing was that something went wrong.

## What should have happened

She lands on her note, on the canvas, with the words she typed — which is exactly
what happens when an already-signed-in person taps **Keep this**. That path was
driven in the same session and worked perfectly.

## How to reproduce

1. Sign out. Open `http://jotacular.localhost:3400/`.
2. Type anything into the hero canvas, wait for "Jot saved."
3. Tap **Keep this** — you arrive at `/signin?next=%2Fclaim%3Ft%3Djd_anon_…`.
4. Sign in with any new email through the developer form.
5. The error page renders at `/claim?t=…`.

Every time. Reproduced twice, with two different accounts, the second time on a
server with no edits in flight and no rebuild running.

Console, on arrival:

> `Error: An unexpected response was received from the server.`
> `at fetchServerAction (…/router-reducer/reducers/server-action-reducer.js)`

## Why it matters

It is the first impression, at the highest-anxiety moment in the funnel, and it
says the opposite of what happened. A person who has just handed a stranger's
website an idea and an email address is told it failed.

The likely next move is **Try again** — and the claim token is single-use, so the
second attempt takes the `catch` branch and drops her on an empty canvas instead of
her note. She would then reasonably conclude the thought is gone.

It is `major` rather than `blocker` because nothing is lost: the sentence "Nothing
you wrote has been lost" happens to be true.

## Where it lives

`apps/web/app/claim/route.ts` is a **Route Handler**.

`apps/web/app/signin/page.tsx` signs in from a **server action**
(`await signIn("dev", { email, redirectTo })`).

When a server action redirects, the Next client router re-fetches the target as an
**RSC navigation**. A Route Handler cannot answer one — it returns a plain 307 —
so the router throws, and the nearest `error` boundary renders "Something went
wrong".

**Isolated by experiment, not by reading:**

| Server action redirects to | Result |
| --- | --- |
| `/dashboard` (a page) | works, lands on the dashboard |
| `/claim` (a route handler) | throws, error boundary renders |

Both were driven through the same form, in the same session, minutes apart.

The same reasoning says Google is safe: `signIn("google")` redirects to an external
origin, which forces a full document navigation, and Auth.js's callback then issues
a plain 302 to `/claim` — a document request, which route handlers answer fine.
**Not verified here.**

## The fix

`/claim` became a **page**. `apps/web/app/claim/route.ts` was deleted and
`apps/web/app/claim/page.tsx` written in its place — Next does not allow both in
one segment.

A page's `redirect()` is understood by both kinds of navigation, so the handoff now
works whether it is reached by a document request (the hero's form, Google's
callback) or by a server action's redirect (the developer sign-in). Same behaviour,
same ADR-039/040 intent, one fewer way to break.

Two things were deliberately changed while moving it:

- **`redirect()` is outside the `try`.** It works by throwing, so a `redirect()`
  inside the old `catch`-all would have been swallowed and rendered a blank page.
  The landing path is computed in a small helper and the redirect happens after it.
- **The redirect is relative, not `appOrigin()`-absolute.** `/claim` is only ever
  reached on the app host — the apex's middleware would rewrite it to `/site/claim`
  and 404 — so an absolute URL bought nothing and forced a cross-origin hop.

Fixed at the single point rather than by special-casing the sign-in form: any
future server action that redirects to `/claim` would have hit the same wall.

**Siblings checked.** `/share`, `/export/note/[id]` and `/export/space/[id]` are
also route handlers. None of them is a server action's redirect target — `/share`
is an Android share-sheet POST and the exports are download links clicked directly
— so none has this bug today. They were **not** converted; doing so on spec would
be a change with no defect behind it.

## Confirmed by

> Re-ran P01 act 3 end to end, signed out, on a settled server. Typed
> "retest after the claim fix — she must land on her note" into the hero on the
> apex, tapped **Keep this**, signed in as a brand-new account
> (`p01.retest@jotacular.test`) through the developer form.
>
> Landed on `/n/57d3fcc0-e4ea-4069-9fb2-89e777213e3a` — her own note, her own
> words on the canvas. No error page. Confirmed in a screenshot, by eye.

Not a regression risk for an earlier persona: P01 is the first, and her account was
created before this fix. Her spine was re-walked with a fresh account to prove it.

## Rating effect

`app › Sign in` and `app › A note` are scored post-fix in
[rating.md](../rating.md). The "Something went wrong" pane is scored on what it
says, since it was seen twice.
