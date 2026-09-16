# 005 — She handed over a thought and the next screen never mentioned it

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Marisol Okonkwo-Vance · act 3
**Surface:** app › Sign in
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** re-ran P01 act 3 — see below
**Blocked on:** —

## What happened

Marisol typed her idea into the hero on the marketing site without an account. The
canvas told her, correctly and reassuringly:

> ● **Jot saved. Sign in to keep it and reach it from your phone.**  [ Keep this ]

She tapped **Keep this**. The next screen is a bare sign-in page:

> **jotacular**
> Where the thought lands.
> [ Continue with Google ]

**Nothing on it mentions her note.** Not the words she wrote, not "your jot is
waiting", not a count. The thought she was nervous about losing has vanished from
the interface, and the only evidence it still exists is a token buried in the query
string: `?next=%2Fclaim%3Ft%3Djd_anon_…`.

## What should have happened

The screen should say the jot is still there and that signing in is what keeps it.
She has just been asked to hand over an email address to a site she found ninety
seconds ago; the reason is the note, and the screen that asks does not say so.

The page **already has this pattern**. When a session goes stale it renders:

> You have been signed out. Sign in again to carry on.

So the component has a slot for "why you are here". The claim case simply has no
message in it.

## How to reproduce

1. Open `http://jotacular.localhost:3400/` signed out.
2. Type anything into the hero canvas. Wait for "Jot saved."
3. Tap **Keep this**.
4. Read the sign-in page.

Every time.

## Why it matters

This is the highest-anxiety moment in the whole funnel. She is a stranger, she has
just given a real idea to a website, and the product's own pitch is that it stops
you losing thoughts. The screen that asks for her email is the one place the
reassurance is missing, and it is the screen where she decides whether to bother.

It is `minor` rather than `major` because nothing is lost and nothing false is
said — the jot does survive, proved below. It is a gap in reassurance, not in
function.

## Where it lives

`apps/web/app/signin/page.tsx` — the component reads `searchParams.stale` and
renders one message for it. `searchParams.next` is read only by `safeNext()`, which
sanitises it for the redirect and never looks at what it points at.

## The fix

`apps/web/app/signin/page.tsx` gains a small `reason(next, stale)` helper that
returns the one line worth saying, and the page renders whatever it returns. The
stale message moved into it rather than being a second conditional, so the screen
has one slot for "why you are here" instead of a growing pile of them.

The claim line reads:

> **Your jot is waiting. Signing in is what keeps it.**

Checked against docs/11: no exclamation mark, no "simply" or "just", uses **jot**
rather than create or add. It deliberately does not use the word **space**, which
is correct product vocabulary but means nothing to somebody who has been on the
site for ninety seconds.

## Confirmed by

> Re-ran P01 act 3. Reloaded `/signin?next=%2Fclaim%3Ft%3D…` and read the screen:
> the line sits between "Where the thought lands." and the Google button.
> Magnified and read by eye, not inferred from the markup.
>
> Re-checked after the 006 fix on a full run from the apex: the line appears on the
> way through, and the person then lands on their note.

## Rating effect

`app › Sign in` — the score in [rating.md](../rating.md) is the post-fix one.
