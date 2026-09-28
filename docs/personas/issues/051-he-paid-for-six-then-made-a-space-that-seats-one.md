# 051 — He paid for six, then made the space he wanted and it seats one

**Status:** fixed
**Severity:** design
**Found by:** P05 · Kwabena Ballantyne-Osei · act 6
**Surface:** app › Account › What you are on · Who is in your spaces · and site › /pricing
**Filed:** 2026-09-16
**Fixed:** 2026-09-28
**Confirmed by:** `one-bill:smoke`, 34 checks · 2026-09-28
**Blocked on:** —

## What happened

Kwabena pays £9 for **Family — "up to 6 people"**. His `Personal` space goes onto
the family plan and shows **2 of 6 seats taken** once he invites Ama. That part
works, and it is what issue 001 unblocked.

Then he does what act 6 asks: he makes a space for the house, because a space
called *Personal* is not where you put the boiler cover. The button is right there
and says **Make a shared space**. He types *The Ballantyne-Osei house*.

This is what the screen then says, verbatim, both sections:

```
What you are on
  Personal                     family    0 of 2,000 read this month · 2 of 6 people
  The Ballantyne-Osei house    free      0 of 100 read this month
                                         [Solo $5]  [Family $9]  [Team $19]

Who is in your spaces
  Personal                     2 of 6 seats taken
  The Ballantyne-Osei house    1 of 1 seat taken
                               Every seat is taken. Change the plan to add more.
```

**He has just paid for six people and the space he actually wants to share seats
one, and asks him for £9 again.**

## What should have happened

Not certain, and that is why this is filed as a decision rather than a fix. What
is certain is that **the screen should not invite him into it without saying what
it costs.** *Make a shared space* is offered with no hint that the new space starts
free, seats one, and is billed separately from the one he just paid for.

## How to reproduce

Every time.

1. Sign in as an owner whose space is on the **family** plan.
2. Account › *Who is in your spaces* › type a name › **Make a shared space**.
3. The new space appears on `free`, at **1 of 1 seat taken**.

## Why it matters

He is the customer the Family plan is written for — a house of six, buying it so
other people can read. The first thing he does after paying is the thing that makes
it look like he was charged for nothing.

**And one line of the pricing page reads as a promise this breaks.** The Family
card says:

> Shared spaces, one bill

Plural spaces, one bill. The honest rule is in the lede above it — *"One price for
the space, however many people are in it"* — but a person comparing plan cards
reads the card. Both readings are available and only one of them is true, on the
page where money changes hands.

The neighbouring bullet, *"Nobody counts seats"*, is the one that makes the
charitable reading possible: it is about not charging per person. That does not
rescue the word **spaces**.

## Where it lives

- [NewSpace.tsx:15](../../../apps/web/components/NewSpace.tsx#L15) — `createSpaceAction(name, "family")`.
  Every new space is `kind: family` and lands on the `free` plan, which
  `app_plan_seats` seats at 1.
- [SpacePeople.tsx:66](../../../apps/web/components/SpacePeople.tsx#L66) — `full={p.seats.left <= 0}`
  is what turns the invite box into *Every seat is taken*. It is correct; the seat
  count behind it is the question.
- [pricing/page.tsx:53](../../../apps/web/app/site/pricing/page.tsx#L53) — `"Shared spaces, one bill"`.
- ADR-118 already named the smaller half of this — *"somebody makes a space to share
  and is immediately told it is full … the first-run copy is worth revisiting."*
  **P05 is the case where they have already paid**, which is the half ADR-118 did
  not anticipate.

## The fix

**One bill covers every space a person makes.** ADR-119, migrations 0040 and 0041.

`spaces.billed_with` is the whole mechanism: NULL means a space pays for itself, and a
value means it rides on that space's subscription. A space made by somebody who already
pays now arrives on their plan, seating six, with no price list under it.

**Readings are pooled and seats are not**, and that asymmetry is the pricing. Readings
are the cost of goods (ADR-036) so a fresh 2,000 per room would turn $9 into an
unbounded vision bill. Seats were never the fence (ADR-112), so every space in the group
holds the plan's number — which is what turns *1 of 1 seat taken* into *1 of 6*.

The decision this was blocked on: **nothing extra.** A second space costs nothing,
because the alternative was asking a customer to remember which of his spaces was the
paid one, and docs/01 has said since M0 that families will not do that arithmetic.

What changed:

- [0040_one_bill_many_spaces.sql](../../../packages/db/migrations/0040_one_bill_many_spaces.sql)
  — the column, the pooled allowance, `app_create_space` attaching a new space to the
  payer, and `app_join_billing` / `app_leave_billing` for a space made before the card.
- [0041_a_webhook_never_refuses_money.sql](../../../packages/db/migrations/0041_a_webhook_never_refuses_money.sql)
  — 0040 raised when a subscription arrived for a covered space. Right at the checkout
  button, wrong on the other side of the card: the charge would stand and nothing would
  be recorded. It detaches and applies instead. `smoke-seats` found it.
- [NewSpace.tsx](../../../apps/web/components/NewSpace.tsx) — says what the next space
  costs BEFORE it is made, which is the half of this that was never about billing.
- [PlanSection.tsx](../../../apps/web/components/PlanSection.tsx) — a covered space is
  offered neither checkout nor a portal, and a free one is offered *Add to <payer>*
  first. Its `PlanActions` was 80 lines, so it split three ways on the way past.
- [billing-actions.ts](../../../apps/web/app/billing-actions.ts) — split out of
  `actions.ts`, which was three lines under its limit.
- [pricing/page.tsx](../../../apps/web/app/site/pricing/page.tsx) — *"Shared spaces,
  one bill"* becomes *"Every space you make, on the one bill"*, and the lede and the
  home page band say the same thing.

## Confirmed by

`pnpm one-bill:smoke` — 34 checks, all green. Act 6 walked as SQL: he pays for Family,
makes *The boiler cupboard*, and it arrives on `family`, naming *The Ballantyne-Osei
house* as its payer, seating six with five free, on the 2,000 allowance shared between
them. `seats:smoke`, `billing:smoke`, `members:smoke`, `metering:smoke`, `anon:smoke`
and `db:smoke` all still green.

**Not yet confirmed from the screen.** The suites are green and green suites have missed
things on this account page before (issue 049). The account page wants opening.

## Rating effect

Pending — the P05 re-run has not happened.
