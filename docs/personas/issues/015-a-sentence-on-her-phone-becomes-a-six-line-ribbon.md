# 015 — A sentence on her phone becomes a six-line ribbon

**Status:** fixed
**Severity:** minor
**Found by:** P01 Marisol · act 5 · 2026-09-16
**Surface:** app › A note (the canvas) — a new text box
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** `box-width:smoke`, 7 of 7 · 2026-09-16
**Blocked on:** —

## What happened

Every note Marisol wrote in act 5 came out as a narrow column of text about a third
of the way across her screen. Note 2 is eighty-one characters and renders as six
lines:

```
Nia's mum
asked about the
6am slot again
— third person
this month.
morning tier?
```

The box is **120px wide on a 360px screen**, and two-thirds of the page beside it
is empty paper.

## What should have happened

On a phone, a sentence uses the width of the phone.

## How to reproduce

At 360px: ⊕ › **A note on the canvas**, then type anything longer than three words.
Every time.

## Where it lives

`apps/web/lib/ink-text-layer.ts`:

```ts
/** A new box is about a third of the visible width, which is a paragraph on a
 *  phone and a column on a laptop. Somebody can drag it after. */
const NEW_WIDTH_FRACTION = 0.33;
```

and at the call site, `Math.max(120, visibleWidth * NEW_WIDTH_FRACTION)`.

At 360px that arithmetic is `max(120, 118.8)` — the floor, not the fraction. So the
phone case is the one the constant never actually reaches, and the comment's claim
that a third of the visible width is *"a paragraph on a phone"* is the part that is
not true. A third of a phone is a column on a phone too.

On a laptop it is right, and this is not a complaint about the laptop.

## Why it matters

`minor`. Nothing is lost, nothing is unreadable, and a box can be dragged wider
afterwards — though Marisol, one-handed in a car, will not.

It is filed because it is the shape of the thing she looks at all day. Her space is
meant to look like fourteen scruffy fragments; it looks like fourteen ribbons. And
it interacts badly with issue 009, now fixed: the narrower the box, the more lines
there are to clip, which is why that defect hid eighty-one characters behind two
words rather than behind twenty.

## The fix

Not attempted. `Blocked on: taste` — how wide a new box should be is a design
decision, and there is a real argument for the current answer: a wide default on a
big canvas makes it hard to put two notes side by side.

The narrow version of the change, which does not touch the laptop at all:

```ts
// A third of a wide canvas, but most of a narrow one -- a phone has no room
// for a column and something beside it.
const width = visible < 480 ? visible - 2 * MARGIN : visible * NEW_WIDTH_FRACTION;
```

Whatever the number, the comment above the constant should stop claiming the phone
case works, because that is the case it does not reach.

## Confirmed by

—

## Rating effect

It is the named gap on `A note (the canvas)`'s Design score in
[rating.md](../rating.md), which is 8 rather than 9 for this and for issue 002.

---

## Fixed, 2026-09-16 — the narrow version, which Brandon chose

He took this one off the blocked list, so the taste question is answered. The fix
is the narrow version sketched above: **the laptop is untouched.**

```ts
export const NEW_WIDTH_FRACTION = 0.33;
export const PHONE_WIDTH_FRACTION = 0.92;
export const MIN_NEW_WIDTH = 120;

export function newBoxWidth(visibleWidth: number, onPhone: boolean): number {
  const fraction = onPhone ? PHONE_WIDTH_FRACTION : NEW_WIDTH_FRACTION;
  return Math.max(MIN_NEW_WIDTH, visibleWidth * fraction);
}
```

**It is a fraction, not a subtraction, and that is deliberate.** The sketch in this
issue used `visible - 2 * MARGIN`, which is wrong once the canvas is zoomed:
`visibleWidth` is **world** units, a margin is **screen** pixels, and subtracting one
from the other means a zoomed-in phone gets a box with no gutter and a zoomed-out one
gets a box that is mostly gutter. A fraction scales with the world, as a world
measurement should.

**For the same reason `onPhone` is a separate argument rather than a threshold on
`visibleWidth`.** Whether somebody is on a phone is a fact about the SCREEN and
`visibleWidth` cannot answer it — a laptop zoomed out has a wide world and is still a
laptop. `ink-text-layer.ts` answers it with `matchMedia(NARROW)`, reusing the house
breakpoint from `use-narrow.ts` rather than inventing a second 480.

**And the comment stopped lying.** It used to say a third was "a paragraph on a phone",
which was the one case it never reached.

## Confirmed by

**2026-09-16.** The rule lives in its own module so it can be asserted rather than
eyeballed, and `apps/web/scripts/smoke-box-width.ts` does it — registered as
`pnpm box-width:smoke`, **7 of 7**:

```
ok    the OLD rule never reached the phone case        360 * 0.33 = 118.8 < 120
ok    on a phone a new box uses the phone              360 -> 331.2
ok    ...which is more than twice what a phone used to get
ok    a laptop is untouched -- still a third           1400 -> 462
ok    the floor still catches a tiny viewport          100 -> 120, both ways
ok    a zoomed-OUT laptop is still a laptop            4000 -> 1320
ok    a zoomed-IN phone is still a phone               180 -> 165.6
```

**331.2 instead of 120**, on the 360px screen this issue was filed about.

The assertions were written into `smoke-objects.ts` first and pushed it to **259
lines**, so they were split out as the rule requires — that file is about what a
lasso CATCHES, and how wide a box BEGINS is a different question.

## Rating effect

It was the named gap on `A note (the canvas)`'s Design score. Re-scored in
[rating.md](../rating.md).
