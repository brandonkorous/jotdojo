# 021 — The refusal named the fence and not the gate

**Status:** fixed
**Severity:** minor
**Found by:** P01 Marisol · act 9 · 2026-09-16
**Surface:** MCP › `create_note`, `append_to_note`, `comment_on_note` on a free space
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P01 Marisol · act 9 · 2026-09-16
**Blocked on:** —

## What happened

Act 9 is one sentence Marisol says to her assistant: *"add a note that I should ask
the 11 pilots about the next-house screen."* She is on free, where an agent can read
but not write, and the act exists to judge the refusal rather than the rule.

All three write tools refused, identically and immediately:

> This space is on the free plan, where an agent can read but not write

The act asks three questions of that sentence. It answers two:

| | |
| --- | --- |
| Does she understand **what happened**? | **Yes.** Nothing was written |
| Does she understand **whose rule it is**? | **Yes.** "the free plan" — Jotacular's rule, not Claude's, which is the one most likely to be misread |
| Does she understand **what it would cost to change**? | **No.** Not the plan, not the price, not where to go |

The persona says so in advance: *"If she would have to go and find the pricing page
to understand it, that is a finding."* She would. And she is in a chat window on a
phone, which is the worst place from which to go and find a pricing page.

## Why it matters

`minor` — the rule is right, the refusal is immediate, nothing is lost, and she can
still get there in three or four taps.

It is filed because **this is the product's only upgrade prompt that a customer
meets in the moment they actually want the thing.** Free reads, paid writes is called
"the most important decision" in docs/01, and this sentence is where that decision
is explained to the person it applies to. Ending it one clause early is a strange
place to stop.

## Where it lives

`packages/domain/src/plans.ts`, in `assertAgentMayWrite`. One string, thrown to
every write path — four call sites across `notes.ts` and `comments.ts`.

## The fix

One more clause, naming the cheapest plan that lifts the fence and the screen that
changes it:

> This space is on the free plan, where an agent can read but not write. **Solo and
> up can — change it in Jotacular under Account, What you are on.**

Three choices in that wording:

- **"Solo and up"**, not "a paid plan". It is the word she sees on her own account
  page, and it answers "which one" rather than "some of them".
- **No price.** `$5` lives in three places already — `PlanSection.tsx`, the pricing
  page and the site's structured data — and a fourth copy in the domain layer would
  be the one nobody remembers to change. The screen it points at shows all three
  prices side by side.
- **"in Jotacular"**, because she is reading this inside Claude and the instruction
  has to say which application to go to.

## Confirmed by

**P01 Marisol, act 9, 2026-09-16.** Through the real MCP server, on her real free
space, with a real token:

```
isError: True
This space is on the free plan, where an agent can read but not write. Solo and
up can — change it in Jotacular under Account, What you are on.
```

All three write tools give it. Six smoke suites green afterwards — `mcp api
metering billing review triage`.

## The thing underneath this that is NOT fixed here

**The consent screen offered her two scopes her plan cannot use.** She granted
`notes:comment` and `notes:append`, and the screen listed them as things the agent
"will be able to" do:

> ☑ read your notes ☑ leave comments ☑ add new notes and add to existing ones

Two of those three were always going to be refused. Issue 017 fixed the same lie on
`/account`; the consent screen still tells it, and it is the more expensive place to
tell it because that is where she presses Allow.

`plans.ts` now exports `agentMayWrite(plan)`, so `/oauth/authorize` has the answer
available. Whether an un-grantable scope should be hidden, greyed, or shown with
"needs Solo" beside it is a design decision and is Brandon's. Filed here rather than
separately because it is the same sentence, told twice.

## Rating effect

None on a screen — this is a sentence an agent relays. `Let this agent in` carries
the scope half of it in its gap column.
