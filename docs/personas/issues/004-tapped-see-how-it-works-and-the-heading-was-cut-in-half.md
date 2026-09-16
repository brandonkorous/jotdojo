# 004 — She tapped "See how it works" and the heading was cut in half

**Status:** fixed
**Severity:** design
**Found by:** P01 · Marisol Okonkwo-Vance · act 1
**Surface:** apex › Home › every in-page anchor
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** re-ran P01 act 1 — see below
**Blocked on:** —

## What happened

On the apex at 360px, Marisol tapped the hero's second button, **"See how it works
↓"**. The page jumped to the "Four seconds, and any kind of thought." band.

The floating white site bar sits on top of the first line of that heading. What she
landed on read:

> **any kind of thought.**

"Four seconds, and" is behind the bar. The band's whole promise — the number — is
the part that is hidden.

Measured in the page after the jump:

| | |
| --- | --- |
| section top, in the viewport | `0px` |
| the `<h2>` top | `32px` |
| bottom edge of the sticky bar | `68px` |
| `scroll-margin-top` on the section | `0px` |

So the heading begins 36px above where the page becomes visible.

## What should have happened

The band she was sent to starts below the bar, with its heading whole. A link that
scrolls to a place should land on that place.

## How to reproduce

1. Open `http://jotacular.localhost:3400/` at 360px wide.
2. Tap **See how it works ↓** in the hero.
3. Look at the heading.

Every time, at every width. It is not a phone-only problem — at desktop width the
header nav's **How it works** and **For your AI** are the same jump, so the desktop
page has three entry points into it and the footer has a fourth.

## Why it matters

It is the hero's secondary call to action, so it is one of the two things the page
asks her to do first. She lands on a sentence fragment and has to scroll up to
understand what she is reading — on a page whose entire argument is that it is
faster than the alternative.

It is cosmetic rather than false, so `design` rather than `major`. But it is on the
only door the product has.

## Where it lives

- `apps/web/app/styles/site.css:38` — `.jd-site-bar` is `position: sticky` with
  `top: clamp(0.5rem, 1.5vw, 1rem)`, so it occupies the top ~68px of the viewport
- no `scroll-margin-top` or `scroll-padding-top` exists anywhere in
  `apps/web/app/styles/` or `globals.css` — the property is simply absent
- the anchor targets are the `<section id="how">` and `<section id="ai">` bands
  rendered by `apps/web/app/site/page.tsx`

## The fix

One place, in `apps/web/app/styles/site.css`, so every band gets it and any band
added later gets it for free:

- `.jd-site` gains `--bar-clear: calc(clamp(0.5rem, 1.5vw, 1rem) + 3.75rem)` — the
  pill's own `top` offset plus its height, which nothing in CSS can compute.
- `.jd-band` gains `scroll-margin-top: var(--bar-clear)`.

It resolves to exactly 68px, which is the bar's bottom edge, so a jump puts the
band's padding box against the bar and the band's own `padding-top` becomes the
breathing room — the spacing the design already intended.

Not done as a per-anchor patch on `#how` and `#ai`: the next band with an id would
have had the same bug, and nobody would have known until somebody tapped it.

**Siblings checked.** `#ai` is the only other anchor target on the site, and it was
broken in exactly the same way. Both were re-tested after the fix. No other element
on the apex is an anchor destination.

## Confirmed by

> Re-ran P01 act 1 on a 360px viewport. Reloaded the apex, tapped **See how it
> works ↓** as Marisol. The band landed with **"Four seconds, and any kind of
> thought."** whole, mint underline visible, 32px clear of the bar — confirmed by
> eye in a screenshot, not just by measurement. `scroll-margin-top` computes to
> `68px` against a bar bottom of `68px`.
>
> Then navigated to `#ai` the same way: heading **"Connect your AI"** lands 33px
> clear. Both anchors correct.

Not a shared-spine fix — it is marketing CSS only, and no persona earlier than P01
exists. No second confirmation line is owed (RULE #7).

## Rating effect

`apex › Home` — this was the first thing found on the screen, and the score in
[rating.md](../rating.md) is the post-fix one.
