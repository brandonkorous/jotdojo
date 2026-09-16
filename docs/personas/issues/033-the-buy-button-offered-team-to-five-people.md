# 033 — The buy button offered Team to five people

**Status:** fixed
**Severity:** major
**Found by:** P06 Fenn · act 1 · 2026-09-16
**Surface:** app › Account › What you are on — the Team button
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P06 Fenn · 2026-09-16
**Blocked on:** —

## What happened

Fenn runs ops for a six-person practice and went to `/account` to move the space to
Team. The button's accessible name — what a screen reader announces, and what the
label under it says — was:

> Move this space to Team, $19 a month, **up to 5**, and the agent that reads new notes

**Team is up to 25.** And the card directly above it says **Family, $9 a month, up to
6 people** — so on the one screen where somebody spends money, the more expensive
plan was offered as holding *fewer people than the cheaper one*.

## Everywhere else already says 25

| | |
| --- | --- |
| `app_plan_seats` | `team → 25` |
| `docs/01-audience-and-pricing.md` | *"**Team** \| $19/mo \| up to 25"* |
| the pricing page | *"Team · $19 a month · **up to 25 people**"* |
| **`PlanSection.tsx`** | **`"up to 5, and the agent that reads new notes"`** |

## The part that makes it a `major`

**This exact bug was found and fixed once already**, and docs/01 keeps the record:

> Six is what a family plan means everywhere — Apple One, Google One and iCloud+ all
> land there — and twenty-five is a small company. **Team used to say five, which was
> fewer than Family and made no sense; ADR-112 is the record.**

ADR-112 corrected it in the database, in the pricing doc and on the marketing page,
and **left the one string that sits on the buy button.** It is the *fix leaves its
neighbour behind* shape, applied to the very bug the ADR was written about — and the
neighbour it left behind is the checkout.

It is also the second thing this run has found on that screen. Issue 032 is the other:
it prints `1 of 6 people` at a customer with no way to make it two. The plan section
is where money is spent, and it is the least-verified screen in the product.

## Why it matters

**It can lose a sale, and it can lose the right sale.** Fenn is comparing Family and
Team. Family says six people for £9; Team said five people for £19. The only rational
reading is that Team is worse and dearer, and the only thing that saves the sale is
the second clause about the agent — which is the feature he actually wants, buried
behind a number that contradicts itself.

And it is the number a screen-reader user hears. There is no visual card to
cross-check it against: `who` is the whole description.

## The fix

```tsx
/**
 * The seat numbers here must match `app_plan_seats` — solo 1, family 6, team 25.
 *
 * Team said "up to 5" on this screen long after ADR-112 corrected it in the
 * database, in docs/01 and on the pricing page, so the one button somebody
 * presses to pay offered less than the cheaper plan above it. Issue 033.
 */
team: { label: "Team", price: "$19", who: "up to 25 people, and the agent that reads new notes" },
```

The comment names `app_plan_seats` on purpose. This map is a static client-side
label for plans somebody is **not** on, so there is nothing to derive it from without
a round trip for three words — but the next person to read it is told where the truth
lives, which is what was missing the first time.

## Confirmed by

**P06 Fenn, 2026-09-16.** The button, read back from the live page:

> Move this space to Team, $19 a month, **up to 25 people**, and the agent that reads
> new notes

He then bought it, and the account page agreed: `team · 0 of 10,000 read this month ·
**1 of 25 people**`.

## Rating effect

`Account › Plan and usage` already carries an Ease deduction from issue 032. This is
a **Design** deduction on the same row — a number that disagrees with the database,
the docs and the marketing site, on the control that takes money.
