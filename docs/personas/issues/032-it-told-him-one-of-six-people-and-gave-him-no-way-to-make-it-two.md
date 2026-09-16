# 032 — It told him "1 of 6 people" and gave him no way to make it two

**Status:** open
**Severity:** major
**Found by:** P05 Kwabena · act 7 · 2026-09-16
**Surface:** app › Account › What you are on
**Filed:** 2026-09-16
**Fixed:** —
**Confirmed by:** —
**Blocked on:** 001

## What happened

Kwabena runs a house of six. He came to the pricing page to buy, read the Family
card, and bought it. Nine pounds a month. Then he went to add his wife.

The account page told him:

> `Personal` · **`family`**
> **`0 of 2,000 read this month · 1 of 6 people`**

**One of six.** The product counted his seats, printed the number, and offers no way
anywhere to change it.

This is filed separately from issue 001, on that issue's own instruction — *"If it
shows a seat count he cannot act on, that is a separate finding from 001 and gets
its own issue."* — and because it is a different kind of harm.

## Why it is worse than silence

Issue 001 is an absence: no screen to invite anybody. A person meeting an absence
concludes the product does not do that thing.

**A seat count is a presence.** `1 of 6 people` is the software telling him, in its
own voice, that it knows about people, that it is keeping score, and that he has five
places left. Every reasonable reading of that sentence is *"the other five go
somewhere, and you have not found it yet."*

So he looks. Everything he tried, in the order he tried it:

| Where | What he found |
| --- | --- |
| `/account`, all eight sections | Toolbar, plan, triage, Connect to Claude, Connected agents, capture tokens, export, sign out. **Nothing about people** |
| `/account` › the plan section he had just paid on | `1 of 6 people`, and `Change plan or cancel` |
| `/dashboard` | `Spaces: Personal` — one badge, not a link |
| ⌘K, searching `invite`, `member`, `people`, `family`, `share`, `add` | **nothing, on all six** |
| The canvas chrome | search, five tools, Add, comments, avatar |

**Five minutes of a paying customer's time, to find out the answer is nowhere.** And
the most likely conclusion he draws is not that the product is unfinished — it is
that he is bad at this.

## What he was sold, an hour earlier

The pricing page, quoted in full because it is the contract:

> **Family** · $9 a month · **up to 6 people**
> 2,000 pages, photos or voice minutes, **shared between you**
> Everything in Solo, **for everyone in the house**
> **Shared spaces, one bill**
> **Nobody counts seats**

Five sentences about people. And at the top of the page:

> One price for the space, **however many people are in it**.

**"Nobody counts seats" is the one that stings**, because the account page counts
them, on screen, in the same session. The line was written to mean *we do not charge
per head* and it reads, ten minutes later, as a promise the product breaks in
public.

His space is also still called **`Personal`** — issue 003 — which is the word for
exactly what it is not.

## Where it lives

- `apps/web/components/PlanSection.tsx` — prints `seatsTaken of seats`
- `apps/web/lib/plans-view.ts` — `spaceSeats(actor, space.id)` feeds it
- `packages/domain/src/members.ts` — `spaceSeats`, `listMembers`, `inviteToSpace`,
  `acceptInvite`, `setMemberRole`, `removeMember` — **all complete, all with no
  product caller** (issue 001)

## The fix

**Blocked on 001**, and deliberately so: the right fix is to make the number true by
building the door, not to hide the number.

Two things are worth deciding now, though, and they are cheap:

**1. If 001 is going to wait, the count should not be shown on its own.** Either it
goes away until there is somewhere to send him, or it carries the reason — *"Adding
people is not built yet"* — which is a worse product and an honest one. Printing a
score for a game nobody can play is the only option that is neither.

**2. "Nobody counts seats" should be re-read whatever happens.** It is a good
sentence about billing and a false one about the screen it is judged against. *"One
price, however many of you"* says the true half without inviting the comparison.

## Confirmed by

—

## Rating effect

`Account › Plan and usage` was scored 8/8 in P01's act 10, where its number was
honest and actionable. **Ease drops to 5 on a Family space**, and the gap column on
its row now says why: the one number on it that is about people is the one number a
customer cannot do anything with.
