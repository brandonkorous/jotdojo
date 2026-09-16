# 051 — He paid for six, then made the space he wanted and it seats one

**Status:** open
**Severity:** design
**Found by:** P05 · Kwabena Ballantyne-Osei · act 6
**Surface:** app › Account › What you are on · Who is in your spaces · and site › /pricing
**Filed:** 2026-09-16
**Fixed:** —
**Confirmed by:** —
**Blocked on:** decision — this is what to charge for, not a broken control

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

—

## Confirmed by

—

## Rating effect

—
