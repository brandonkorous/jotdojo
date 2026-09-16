# P06 — Fenn Arkwright · Arkwright & Sowande Structural

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-09-16

**Status:** partial — the triage pipeline is proved; the model's judgment is not
**Run:** 2026-09-16
**Plan:** team — £19/mo, up to 25
**Door:** the blog post `connect-jotacular-to-claude`, found by searching

**Read issue 001 first.** The "six people" half of this run is blocked the same way
P05's is. What is **not** blocked, and what this persona is really for, is the
agent writing and the triage agent — both Team-only, and neither ever driven by a
person.

## Account

| Field | Value |
| --- | --- |
| Email | `p06.fenn@jotacular.test` |
| Password | none — dev sign-in takes an email and nothing else |
| User id | — |
| Space id | — |

## The person

Fenn Arkwright, 38, they/them. Operations at a six-person structural engineering
practice. Not an engineer — they run the money, the deadlines, the insurance and
the thing where two engineers both promised the same Thursday to different clients.

**Technical level: high for a non-developer.** They live in spreadsheets, have
written a bit of Apps Script, and already use Claude every day for drafting.

**What they are nervous about.** Something getting missed. Their whole role is
being the person who notices, and they know they are one bad week from not
noticing.

**What made them look today.** They read the blog post about connecting Claude and
wanted to know whether an agent could go through the week's notes on a Monday
morning and tell them what was hanging.

## The business

**Arkwright & Sowande Structural** — six people, Birmingham, mostly residential
and light industrial.

- Between 20 and 30 live jobs, and about 90 emails a day between them
- No project manager, no IT, no procurement. Fenn is all three
- **Inconvenient for the software:** they want **the agent to speak first**. Not to
  be asked. Everything else in this roster asks a question and gets an answer;
  Fenn wants to open the app on a Monday and be told

## Why they are here today

1. "I want something that reads the week and tells me what is hanging."
2. "I want the agent to be able to write it down, not just read it out."
3. "Nineteen pounds is less than an hour of anybody's time here."

## Onboarding answers

None — the app asks nothing, including anything that would make the triage agent
useful without being configured by hand.

## The data

| # | The note |
| --- | --- |
| 1 | `Hollybank job - steel schedule due to the fabricator Friday. Sowande has it. chase Wednesday if nothing` |
| 2 | `PI insurance renewal 31 Mar. broker wants the fee income figure, ask Deniz` |
| 3 | `Deniz Şahin-Whitlock is off from the 12th for two weeks. nobody has covered the Erdington inspection` |
| 4 | `client at Kings Heath has not paid invoice 2261, £3,412.80, 47 days` |
| 5 | `the beam calc for plot 4 was done against the old load case. it needs redoing and nobody has told the contractor yet, and the contractor is pouring on the 19th, which means this is the most urgent thing in this list and it does not look like it` |
| 6 | `Building Control want the party wall award before they will sign off Moseley` |
| 7 | `we said we would send the Hollybank fee proposal "early next week" and that was two weeks ago` |
| 8 | `Sowande's practising certificate renews in April, put it in the calendar this time` |
| 9 | `23:58 - the Erdington inspection is Thursday and I still have not covered it` |
| 10 | `quote for the Alcester Road survey - £1,150.00 plus VAT, valid 30 days from 2 Apr` |
| 11 | `laptop for the new starter, £940.00, and they start on the 6th` |
| 12 | `nobody has done a fire risk assessment for our own office, which is funny until it is not` |
| 13 | `+44 121 496 0180 is Building Control direct, not the switchboard, use this one` |
| 14 | `Ríoghnach at the fabricator prefers a phone call and will not read an email` |

Note 5 must wrap past five lines at 360px and is deliberately the most urgent thing
buried in the middle. Note 3 and note 14 have the non-ASCII names. Notes 4, 10 and
11 have prices with cents.

### What the triage agent must find

Written down **before** it is switched on, so its output can be judged rather than
admired:

1. Note 5 — the beam calc, because the pour is on the 19th
2. Note 9 — the uncovered inspection, because it is Thursday
3. Note 7 — the fee proposal that is two weeks late

If it surfaces notes 1, 2 and 8 instead, it has found the ones that look
administrative rather than the ones that are on fire, and that is a real finding
about the feature.

---

## The space they end up with

| Item | What it must have |
| --- | --- |
| 14 notes | as written, over at least four dates, one at 23:58 |
| A Team subscription | actually bought in Stripe test mode |
| A triage agent that is off | it is Team-only and off until an owner turns it on. **Find the switch as Fenn would**, and record where it was |
| A triage run | switched on, run, and its output quoted verbatim and judged against the three notes above |
| An agent that writes | at least three agent-written things: a note, a comment on note 5, and an append to note 1 |
| Attribution that reads right | every agent write visibly the agent's, in violet (design.md §11), with wording that follows the copy rule |
| A revert | one agent write taken back, and proof the original is intact |
| A unit count with triage in it | a triage run is one unit whether or not it had anything to say. Count by hand, then look |
| **The five colleagues who are not in it** | same as P05. Record the routes tried |

**Working end to end:** on a Monday morning Fenn opens the app and the agent has
already said the beam calc needs redoing before the 19th.

**The look.** A practice's week, in operations language. Money, dates, and one
thing that is actually dangerous buried in the middle.

---

## The run

### Act 1 — in through the blog

Start at `http://jotacular.localhost:3400/blog/connect-jotacular-to-claude`. Read
it as somebody who found it in search results and has not seen the home page.

**Done when:** the run has recorded whether the post is followable end to end, and
whether anything in it is now false. **A blog post is a promise too** — if it
describes a screen that has changed, that is a `major`.

### Act 2 — the spine at speed, from a blog post

Get from that post to a working account. Report differences from P01, especially
anything that assumes they came in through the hero.

**Done when:** signed in, differences recorded.

### Act 3 — the week goes in

Fourteen notes, over four dates.

**Done when:** all fourteen exist and are searchable.

### Act 4 — they buy Team

Checkout from `/account`, Stripe test mode.

**Done when:** the space is on `team`, confirmed on screen and in the data.

### Act 5 — they go looking for the triage agent

It is Team-only and it is off. Find it as Fenn would, without being told where it
is.

**Done when:** the switch is found, and the run has recorded **how**, how many
screens it took, and whether anything explained what it would do before they turned
it on. Turning on an agent that reads everything you have written, with no
explanation, is a finding.

### Act 6 — the agent speaks first

Turn it on. Let it run. Read what it says.

**Done when:** the output is quoted verbatim and marked against the three notes
above — found, missed, or invented. **An item it invented is a `major`.**

### Act 7 — the agent writes

Ask their agent, over MCP, to do three things: add a note summarising what is due
this week, comment on note 5, and append `contractor told 2 Apr` to note 1.

**Done when:** all three exist, each visibly the agent's, and the exact attribution
wording is recorded and checked against the copy rule — "Claude added a comment",
never "Claude thinks you should".

### Act 8 — the thing that goes wrong for them

The agent's comment on note 5 is wrong — it says the pour is on the 9th. Fenn has
to take it back without losing their own note.

**Done when:** the comment is gone, note 5 is untouched and still says the 19th,
and the run has recorded how many steps it took and whether Fenn could tell it had
worked.

### Act 9 — the five who are not there

Same as P05 act 5. Try every route to add a colleague. Record where each ends.

**Done when:** recorded. **Expected to be blocked (001)** — say so plainly rather
than leaving it silent.

### Act 10 — the count, with triage in it

Hand count before looking: 14 typed notes = 0, plus **1 unit per triage run**.

**Done when:** the count is compared, and the run has answered whether a triage run
that found nothing still cost a unit — because docs/01 says it does.

---

## What only this persona proves

**The agent writing, and the agent speaking first.** Write tools, attribution,
revert, and the one feature in the product that is Team-only, off by default, and
has never been switched on by a person.

---

## Standing checks

**Wrong moves.** Three, named:

1. Turn the triage agent on, off, and on again in quick succession, and check it did
   not run three times.
2. Ask the agent to append to note 1 twice with the same text, and check whether the
   text is there once or twice.
3. Revoke the agent's connection in Connected agents while triage is enabled, and see
   what the next run does.

**Reload and deep link.** F5 on `/account` with the triage switch mid-flight. Send
note 5's URL to a second browser and open it signed out, then sign in.

**Dates.** Note 9 at 23:58, and note 10's "valid 30 days from 2 Apr" — ask the agent
when that quote expires and check the arithmetic by hand. Machine timezone, stated.

**The count and the bill.** Hand count: 14 typed = 0 units, plus 1 per triage run,
of 10,000. **And 1 seat of 25, £19.00/mo.** Compare all four against Account › Plan
and usage, and against docs/01.

**The other side.** Not the agent this time — **Sowande**, the partner, who is the
person the triage summary is really for and who cannot be given an account. Record
what Fenn could actually send them, and by what route.

**Without a mouse.** One full job by keyboard: find and turn on the triage agent
from the canvas, with the focus ring visible throughout.

**Somebody else's data.** Search for `Grace` and `amlodipine` — P05's words.
Deep-link a P05 note id. Then, because this persona has write tools, **ask the agent
to append text to one of P05's note ids**. Expected: refused. **A write into another
space is a `blocker` and stops the run.**

---

## Verification

| | Result |
| --- | --- |
| Acts completed | |
| Issues filed | |
| Issues fixed and confirmed | |
| Issues blocked, and on what | |
| Screens scored | |
| **Not checked** | |

### The numbers

| Record | Result |
| --- | --- |
| Triage: found / missed / invented, of the three | |
| Screens it took to find the triage switch | |
| Attribution wording, verbatim | |
| Steps to revert an agent comment | |
| Did a triage run that found nothing cost a unit? | |
| Units and seats: hand count vs screen | |
| Machine timezone | |

---

## Run log

Act by act, as you go. **Quote the triage output verbatim** — a summary of a
summary is not a result.


---

## Verification — P06 partial, 2026-09-16

| | Result |
| --- | --- |
| Acts completed | the plan, the switch, the agent's comment, and switching it off |
| Issues filed | **1** — [033](issues/033-the-buy-button-offered-team-to-five-people.md) |
| Issues fixed and confirmed | **033** |
| **Not checked** | the agent's judgment, and the write/revert loop — below |

### Filed and fixed: 033 — the buy button offered Team to five people

Before he could buy anything, the Team button said **"up to 5"**. Team is 25
everywhere else — the database, docs/01 and the pricing page — and **ADR-112 had
already fixed this exact bug once** and missed the button. On the one screen where
money changes hands, the dearer plan was offered as holding fewer people than the
cheaper one above it.

### The triage agent, end to end — the first time anybody has switched it on

**The whole pipeline works.**

| Step | What happened |
| --- | --- |
| Before Team | `Personal · part of the Team plan · Off` — plainly not his |
| On Team | the switch becomes usable; flipping it reads **`not looked yet`** |
| He writes a note with a date in it | `steel schedule due to Hallam by Friday the 24th, Ade is waiting on it` |
| After the quiet period | a comment arrives, `author_type = agent` |
| On the canvas | a **violet dot** on the comments button and a chip: **"Your agent left a remark"** |
| Opening it | the remark expands in place, with an **Open** link. Flat and factual, no *"Claude thinks…"* — docs/11's rule, kept |

**And switching it off stops it, exactly as promised.** The account page says
*"switching it off stops it immediately, including anything it was about to look
at."* After switching off, a second note with a date in it produced **no comment and
no queued job at all** — it does not enqueue and skip, it does not enqueue. Measured:

```
comments_on_new_note | triage_jobs | triage_on
                   0 |           0 | f
```

### The contrast worth carrying to issue 029

Fenn's run proves that **Jotacular displays an agent's comment perfectly** — plan
gate, switch, attribution, violet, a chip, an expandable card, and an honest off
switch. P03 proves that an agent's **note** gets none of that.

The same product, the same week, two halves of one feature. That is the whole case
in [029](issues/029-the-agent-wrote-a-note-and-nothing-said-so-and-nothing-takes-it-back.md).

### What was NOT checked

| | Why |
| --- | --- |
| **Whether the agent's comment is any good** | `TRIAGE_PROVIDER=fake`. Its remark is the canned `TRIAGE_FAKE_COMMENT`, and it talks about an MOT on Monday, which is nothing to do with his note. The **pipeline** is measured; the **judgment** is not |
| **The agent write and revert loop** | Covered by P03 and filed as 029. Repeating it here would add nothing |
| **A second person in the space** | Issue 001. Team is sold on 25 people and he can add none of them — the same wall P05 walked into, one plan up |
| **Comments from another human** | Same reason |
