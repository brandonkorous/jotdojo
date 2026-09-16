# 026 — The button that said "Start jotting" asked her to sign in

**Status:** fixed
**Severity:** major
**Found by:** P02 Hazel · act 1 · 2026-09-16
**Surface:** apex › the hero · apex › the header · apex › the closing band
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P02 Hazel · act 1 · 2026-09-16
**Blocked on:** —

## What happened

Hazel Trickett is 61, has never used an agent, and does not read screens — she scans
them and taps the biggest thing. On her first screenful at 360px she sees this:

> **Don't organize it. Just jot it.**
>
> Write it, type it, say it, or snap it. […]
>
> **[ Start jotting ]**   See how it works ↓

She tapped **Start jotting**.

It took her to a **sign-in page**.

Two inches below that button, on the same screenful, the page says:

> **Nothing to sign up for.** Start typing or writing.

And the closing band at the foot of the page says:

> **No account, no card, nothing to install.** Write it in the box at the top of
> this page — it is saved by the time you finish the sentence.

## What should have happened

The button labelled with the page's own verb does the thing the page has twice
promised she does not have to sign up for.

## How to reproduce

In a browser with no jotacular cookie, open `http://jotacular.localhost:3400/` and
tap any button reading **Start jotting**. Every time.

## What it actually was

Every one of them was a link to the app:

```
Start jotting  →  http://localhost:3400
```

Four of them: the sticky header, the hero, the closing band, and the pricing page.
`/` on the app host calls `captureActor()`, which finds no session and no anonymous
draft and redirects to `/signin`.

**It works perfectly for somebody who typed in the hero box first** — they have a
draft cookie by then, so the same link opens the canvas. That is why P01 never hit
it: she is technical, she saw a canvas, she typed in it. Hazel taps the green
button, which is the more common first move and the one the page's own design
points her at.

## Why it matters

**It breaks the single promise the apex is built on**, at the first tap, for the
audience least able to recover from it. docs/00 makes "no account to begin" the
product's opening move and ADR-039 says the promise has no asterisk for people who
have not signed in. The button is the asterisk.

For Hazel specifically it is close to fatal. Her three reasons for being here are
*"I do not want to learn anything"* and *"I am not paying for it, it is a village
hall"* — and the first thing the product does is ask who she is. She has no reason
to believe the next screen is any different.

It is `major` rather than `blocker` only because the way in still exists: the box is
right there, and the grey line under it says so.

## Where it lives

- `apps/web/components/site/HeroCanvas.tsx` — the hero button
- `apps/web/app/site/layout.tsx` — the sticky header button
- `apps/web/components/site/ProseBands.tsx` — the closing band
- `apps/web/app/site/pricing/page.tsx` — two more

## The fix

**Two words, two meanings, and each button gets the right one.**

**"Start jotting" now starts jotting.** The hero's button is a button rather than a
link, and it puts the caret in the canvas directly beneath it:

```tsx
const startJotting = () => {
  setTouched(true);
  const el = input.current;
  if (!el) return;
  el.focus({ preventScroll: true });
  el.setSelectionRange(el.value.length, el.value.length);
  el.scrollIntoView({ behavior: "smooth", block: "center" });
};
```

`focus` before `scrollIntoView`, with `preventScroll`, so the page does one smooth
move rather than a jump and then a slide. That canvas is not a mock — ADR-010 — so
what she types goes to Postgres through the same actions as any note.

**The closing band points at that box**, since its own sentence already tells her
to use it: `href="#jot"`, with the hero carrying the id.

**The header says "Open the app"**, because that is what it does, and because the
footer has used exactly those words all along. A header link that goes to a sign-in
screen is fine; one that claims to start something is not.

**The pricing page is deliberately left alone.** Nothing next to those two buttons
promises there is nothing to sign up for, and somebody reading plans has already met
the idea of an account.

## Confirmed by

**P02 Hazel, act 1, 2026-09-16**, at 360px with no cookie. Tapped **Start jotting**,
the box scrolled up under her thumb with the caret in it, and she typed her first
diary entry straight in:

> `Sat 4 Apr - Okonkwo christening party 2pm til 6. deposit £50 paid cash, Sandra has it`

The page answered:

> ● **Jot saved.** Sign in to keep it and reach it from your phone. **[ Keep this ]**

Which is the promise, kept, in the order it was made. The header now reads **Open
the app**. Typecheck and lint clean.

## Rating effect

`Home` Ease 7 → 8. `Apex › Jot before you sign up` keeps 9/8 — it was always the
part that worked; what changed is that the button above it now points at it.
