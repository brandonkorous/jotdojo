# 043 — Ink stored when the paper was white is invisible on a dark page

**Status:** open
**Severity:** blocker — for dark mode. Nothing is wrong today
**Found by:** the dark pass for issue 002 · `/n/[id]` with an object on it · 2026-09-16
**Surface:** app › the canvas — every stroke, every canvas text box, every arrow
**Filed:** 2026-09-16
**Fixed:** —
**Confirmed by:** —
**Blocked on:** design

## What happened

Dark mode was turned on (issue 002, parts 1 and 2) and the app was audited route by
route. Every plain page came through clean. The canvas came through clean too — and
then a text box was put on it, and vanished.

```
spine   "Marisol — ring Tolu about the…"   rgb(247,243,234)   <- themed, correct
box     "Pallet count: 40, not 38"          rgb(26,24,23)     <- #1A1817, invisible
```

The spine is `--color-base-content` and follows the theme. A canvas text box is
written in **the pen colour you are holding**, which is stored data, and the default
is `#1A1817` — "Charcoal".

**The first canvas audit found zero failures because the note had nothing on it.**
An empty canvas in dark mode is flawless. That is the whole trap: the surface the
defect lives on is the one surface a contrast sweep of a fresh note cannot see.

## Every ink colour, measured against both grounds

```
                 on paper          on charcoal
                 rgb(236,230,218)  rgb(38,43,50)
Charcoal  #1A1817    14.24              1.24   <- the default pen
Violet    #6A39FF     4.64              2.47
Mint      #00A38D     2.55              4.49
Moss      #3F6B4A     4.95              2.32
Clay      #A2593B     4.19              2.73
```

Four of the five pen colours fail on charcoal. **The default is the worst of them**,
at 1.24:1 — which is not "hard to read", it is not there.

Read the two columns together and the shape is plain: the palette is an *inverse* of
what a dark page needs. Mint is the only colour that is better at night, and it is
the only one that is poor on paper.

(Highlighter colours are not listed as failures. A marker is a wash under text — what
has to be readable is the text on top of it, not the marker against the page.)

## This is a decision, and the documents say why

`docs/10-design-system.md` is explicit that dark mode is meant to reach the canvas:

> A matching `paper-night` **inverts paper and charcoal**; mint holds in both, and
> violet lifts to `#8A63FF` so it clears the dark ground.

And equally explicit that stroke colour is not design's to change:

> **Never hardcode a hex in a component.** … The one sanctioned exception is **stroke
> colour inside the ink canvas — that is user data, not design**, and even those
> swatches are seeded from resolved tokens.

Those two sentences are both right and they do not meet. Paper inverts; ink is user
data and does not. **Nothing in any document says what happens to a stroke somebody
drew in Charcoal on white paper when the paper turns charcoal**, and that is the
whole question.

ADR-089 has already solved the *analogous* problem for design colour, and its rule is
the best starting point anyone has:

> the stroke is **whichever brand ink the ground is not**. On paper the underline is
> violet; on charcoal it is mint; on mint it is paper.

It also records the trap in the same breath — `--mint-paper` is written as a literal
precisely because following `--color-base-300` "flips to `#262b32` at night, which
measures … **1.19:1 against the text it is drawn under**". The canvas has the same
fault, with the same arithmetic, on user data instead of on a band.

## The shapes, none taken

**A — the paper stays paper.** Dark mode darkens the chrome and the plain pages; the
writing surface keeps its warm ground at every hour. Every stored stroke stays
correct forever and nothing has to be remapped. It contradicts `docs/10`'s "inverts
paper and charcoal", and a full-brightness paper rectangle on an OLED phone at 11pm
is the exact complaint issue 002 was filed about — so it trades one person's problem
for another's.

**B — map ink through the theme at paint time.** Charcoal renders as paper-white on a
dark ground, and back again in the morning. Stored data is untouched, so nothing is
destroyed. But it silently redefines what a colour somebody *chose* means, and it has
no good answer for a person who deliberately drew in white.

**C — a per-colour night value, the ADR-089 way.** Each swatch gains a dark partner,
the way `--ink-2` has one per band. Most faithful to the existing house rule, and the
most work: five pen colours, four markers, arrows, and whatever ADR-115's stickers
turn out to need.

**D — seed the swatches from resolved tokens, as `docs/10` already says they are.**
`ink-style.ts` hard-codes all five as literals today. Doing what the doc claims is
done would fix *new* ink and leave every existing stroke exactly as broken, so it is
a necessary part of B or C rather than an answer on its own.

## What was done in the meantime

**Dark mode is switched back off**, restoring exactly the behaviour that shipped
yesterday:

```tsx
/**
 * `data-theme` pins light, and that is what keeps `paper-night` unreachable.
 * Dropping it is issue 002's part 1 and it works -- but stored ink is not ready
 * for a charcoal page: the DEFAULT pen measures 1.24:1 on it. Issue 043.
 */
<html lang="en" data-theme="paper">
```

That is a deliberate choice and it is worth being plain about the trade. Dark mode
**works** for the Dashboard, Account, the review inbox, sign-in and a typed note —
all measured at zero contrast failures, and the dark canvas with spine text on it
looks genuinely good. Turning it on would deliver all of that today.

It would also mean that somebody who writes by hand — the feature the product is
named for — opens their note at night and finds the page blank. **A feature that is
excellent for half the product and deletes the other half is not ready**, and the
half it deletes is the half that pays.

What did not get switched back off, because it is inert until dark returns and it is
correct: the marketing site pinned to `data-theme="paper"` on its own wrapper — issue
041.

**The white wordmark did get reverted, and that is worth its own line.** It had been
swapped by `<picture media="(prefers-color-scheme: dark)")`, which asks the operating
system — and with the theme pinned back to light, a dark-mode OS served the white
mark onto a white header and the wordmark vanished. `prefers-color-scheme` is only
the same question as "is this page dark" while nothing pins the theme. Issue 002's
part 2 now says so.

## What finishing this looks like

1. Answer the question above: A, B, C, or something better.
2. Do D regardless — the swatch literals should be seeded from tokens, because
   `docs/10` already says they are and a doc that describes code that does not exist
   is the shape this whole exercise keeps finding.
3. Drop `data-theme` from both `<html>` tags.
4. Re-run the audit on a canvas **with objects on it** — strokes, a text box, an
   arrow, a sticker, a photo — and expect zero. An empty canvas proves nothing here.

## Rating effect

None. Nothing about the product as it ships today is changed by this issue, and the
app is scored in light — the theme every customer has. The dark-mode measurements
live here and in issue 002 rather than in a score, because a theme nobody can reach
is not a screen anybody has seen.
