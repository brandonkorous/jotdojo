# P01 — Marisol Okonkwo-Vance · Lead & Lamppost

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-09-16

**Status:** done
**Run:** 2026-09-16, start to finish
**Plan:** free
**Door:** the apex, cold — hero jot, then claim

## Account

| Field | Value |
| --- | --- |
| Email | `p01.marisol@jotacular.test` |
| Password | none — dev sign-in takes an email and nothing else |
| User id | `b8c3bfc1-eded-4ae6-b30e-b3ae50a3091c` |
| Space id | `739e5257-4a77-4740-ba5c-1b9d9138089c` |
| Space name | `Personal` (she does not get to choose — issue 003) |
| First note URL | `/n/702f00c2-352a-4f8f-8343-4e28bcf80d95` |

**The space name is `Personal`, not `From the web`.** That was written before the
run and migration 0037 (issue 007) changed the answer: claiming a jot no longer
makes a second space named after how it was made. Issue 003 is unchanged — she
still cannot rename it.

**These ids are a deliverable, not bookkeeping.** P02 through P08 each try once to
reach another customer's data (RULE #7), and P01's are what they aim at.

## The person

Marisol Okonkwo-Vance, 34, she/her. Ten years a product manager at a logistics
company, left in March, now eight months into building on her own. She works from
a kitchen table and a Kia with 140,000 miles on it, and about a third of her week
is spent in the car between dog walkers' houses.

**Technical level: high.** She can read a stack trace and she already pays for
Claude. Jargon is a nit for her, not a blocker — which is exactly why she is first:
if a screen confuses **her**, it is not a vocabulary problem, it is a design one.

**What she is nervous about.** She has five months of runway. The thing that makes
Lead & Lamppost different from three competitors is one idea she had in a lay-by
outside Kidderminster, and she is not certain she has written it down anywhere.

**What made her look today.** She had a good thought at 70mph, told herself she
would remember it, and did not. She searched "notes app my AI can read" on her
phone at a service station.

## The business

**Lead & Lamppost** — booking and route planning for self-employed dog walkers.

- 340 walkers on a waitlist, 11 of them piloting it for free
- Pricing she has not committed to: **£12.50 a walk, £22.00 for two dogs from the
  same household**
- She is the entire company: support, sales, code, and the person who answers a
  walker's WhatsApp at 6am
- **Inconvenient for the software:** she captures almost everything one-handed,
  standing up or in a car, and she will not stop to tidy. Half her notes are
  fragments with no punctuation, and she expects to find them again anyway

## Why they are here today

1. "I want the thing in my head to be somewhere before I forget it."
2. "I want Claude to read them without me copying and pasting."
3. "I am not paying for another thing I use twice."

## Onboarding answers

**There are none, and that is the finding to record.** Jotacular asks the customer
nothing at sign-up. No industry, no team size, no name, no starter pack. A space
is created by a database function and the canvas opens.

| Question | Answer |
| --- | --- |
| — | the app asks nothing |

**So record instead:** how many seconds from landing on the apex to a saved
thought, and what the app knew about her at the end of it (answer: her email).
Whether "asks nothing" is the right call is a product judgment, not a defect — but
if she finishes onboarding without understanding what a space is, that is a
finding.

## The data

**This is the test data. Type it as written** (RULE #2). Fragments are deliberate.
Do not tidy them, do not add punctuation, do not capitalise.

### The 14 notes, in the order she writes them

| # | Written | The note |
| --- | --- | --- |
| 1 | in the hero, before any account | `route planner should assume the walker knows the roads better than the map does` |
| 2 | first note on the canvas | `Nia's mum asked about the 6am slot again — third person this month. morning tier?` |
| 3 | same day | `£12.50 a walk, £22.00 for two dogs same household. does the second dog discount survive a 3-dog house or does it stack` |
| 4 | evening | `Beatriz Cardoso-Nunes says the app logs her out every time she opens the camera. android, pixel 6a` |
| 5 | next morning, 06:12 | `call the insurer back +44 7700 900412 ask about cover for a walker who is walking 4 dogs at once` |
| 6 | long one | `the whole difference is that a walker does not want a route, they want to be told which house to go to next and nothing else on the screen, because they are holding two leads and a poo bag and it is raining, and every competitor has built a map when what was needed was a single sentence` |
| 7 | 60+ characters of title | `Kidderminster lay-by idea: one sentence at a time, never a map, never a list` |
| 8 | fragment | `waitlist 340. 11 piloting. ask the 11 first before building anything else` |
| 9 | at 23:58 | `do not build invoicing. they all use their own thing and they are all fine with it` |
| 10 | next day | `Rufus and Bonnie are the same household but different walkers — the data model is wrong` |
| 11 | | `hosting is £34.20/mo which is fine until it is 300 walkers and then it is not` |
| 12 | | `she called it "the 4 o'clock panic" — that phrase is better than anything on my landing page` |
| 13 | | `check whether Trot & Tail actually does route planning or just says it does` |
| 14 | last | `if I only ship one thing this month it is the next-house screen` |

Note 6 must wrap past five lines at 360px. Note 7 is the long title. Note 2 has the
apostrophe, note 4 the accent, note 5 the `+44`, note 3 the prices with cents, note
9 the date boundary.

### What she asks her agent

Written down before the run, so the answer can be judged rather than admired:

1. "What did I decide about the second-dog discount?" — the answer must come from
   note 3, and must say she did **not** decide
2. "What is the 4 o'clock panic?" — note 12, and it must find it without the phrase
   being in a title
3. "What did Beatriz report?" — note 4, by a name with an accent in it
4. "What am I shipping this month?" — note 14

---

## The space she ends up with

**This list is the definition of done** (RULE #8). Every item, real and working,
before the run is `done`.

| Item | What it must have |
| --- | --- |
| 14 notes | exactly as written above, over at least three different dates, one of them at 23:58 |
| The first one | note 1, written before she had an account, and present in her space after the claim — same words, not retyped |
| Search that works sideways | "panic" finds note 12; "discount" finds note 3; "pixel" finds note 4 |
| A note she can get back to | she reopens note 6 on day three without being told how |
| A connected agent | Claude, read-only, connected through `/account` › Connect to Claude, appearing in Connected agents |
| Four answered questions | the four above, each answer checked against the note by eye |
| A refusal she understands | her agent tries to add a note, is refused for being on free, and the sentence it shows her explains what to do |
| A count she can check | Account › Plan and usage, against the number of recognitions she actually caused (which should be **zero** — she typed everything) |

**Working end to end:** on her phone, with her laptop shut, she asks Claude what
she decided about the second-dog discount and gets the right answer.

**The look.** Her space is fourteen scruffy fragments with no punctuation. If it
looks tidy, the data is wrong.

**Also required, as on every one:** 360px first, keyboard-only for one full job, a
deliberate attempt to read another persona's notes, and the wrong moves below.

---

## The run

### Act 1 — she finds it, cold

Start at `http://jotacular.localhost:3400`, on a 360px viewport, having never seen
it. Read the page the way somebody on a service station forecourt reads it: does
she know within one screen what this is and why it is not Apple Notes?

**This is the deep spine act.** Score every band of the apex, not just the hero.

**Done when:** she can say in her own words what the product does, and the run has
recorded which sentence told her.

### Act 2 — she jots before signing up

Type note 1 into the hero, on the phone viewport, without making an account. Watch
what the page does with it. Then close the tab **mid-sentence** on a second attempt
and see whether the capture beacon caught it.

**Done when:** note 1 exists somewhere the product can still find, and the run has
recorded how many seconds passed between her first keystroke and the thing being
safe.

### Act 3 — she claims it

Follow whatever the hero offers. Sign in with `p01.marisol@jotacular.test`. Land
wherever it puts her.

**Verify in the data, because this is the spine:** a user row, one space, its name
and kind, membership, and note 1's body — the exact words, not a retype. Read them
read-only with `psql` and write down what you saw.

**Done when:** she is signed in, note 1 is on her screen with the words she typed,
and the space row is recorded in the Account block above.

### Act 4 — her first note on the canvas

The landing page is the canvas. Write notes 2 and 3. Watch the save indicator.
Reload the page with a half-typed sentence on screen.

**Done when:** notes 2 and 3 survive a reload, and the run has recorded the number
of seconds from the app opening to the first character being safe. **That number is
the product's own promise and its own named failure signal.**

### Act 5 — a week of fragments

Write notes 4 through 14 across at least three dates, including the 23:58 one. Use
the machine's real clock; say which timezone it is in.

**Done when:** all fourteen notes exist, and `/dashboard` shows them with dates
that are not all today.

### Act 6 — she needs one back

Three days later she wants the lay-by idea. She does not remember the words. Find
note 6 the way she would: search for "map", or "leads", or "raining".

**Done when:** she has note 6 on screen, and the run has recorded how she got there
and how many attempts it took.

### Act 7 — she connects Claude

`/account` › Connect to Claude. Follow it all the way through `/oauth/authorize`
as a real MCP client would, and read the consent screen as she would read it: does
she understand what she is agreeing to?

**Done when:** the connection appears in Connected agents, and the run has recorded
what the consent screen actually said.

### Act 8 — she asks it the four questions

From a fresh agent session with nothing in its context. Ask all four. Check every
answer against the note by eye.

**Done when:** all four answers are recorded verbatim, each marked right or wrong
against the note it should have come from. **An answer that sounds right and cites
nothing is wrong** — record it as such.

### Act 9 — the thing that goes wrong for her

She asks Claude to add a note: "add a note that I should ask the 11 pilots about
the next-house screen." She is on free, where an agent can read but not write.

**Done when:** the refusal is recorded verbatim, and the run has answered: does she
understand from that sentence what happened, whose rule it is, and what it would
cost to change? If she would have to go and find the pricing page to understand it,
that is a finding.

### Act 10 — the count and the bill

Open Account › Plan and usage. She has typed everything and recognized nothing, so
the honest number is **zero of 100**.

**Done when:** the screen's number is compared against a hand count, the plan name
and price are compared against docs/01, and any disagreement is filed. **If the
number will not load, record "unknown" — not zero** (RULE #4).

---

## What only this persona proves

**The spine, deeply** — apex to claimed space to connected agent to a correct
answer, verified in the data row by row, so that the other seven can walk it at
speed and report only what differs.

---

## Standing checks

**Wrong moves.** Three, named:

1. Close the tab mid-sentence in the hero, before any account exists (act 2).
2. Press Back immediately after writing note 9, then forward again.
3. Revoke the Claude connection in Connected agents while an agent session is open,
   then ask it another question.

**Reload and deep link.** F5 on the canvas with an unsaved sentence. Copy the
address of note 6, open it in a private window while signed out, sign in, and
confirm she lands back on note 6 rather than on the canvas.

**Dates.** Note 9 at 23:58. Then search for it "yesterday" the next morning and
record what came back. Say the machine's timezone.

**The count and the bill.** Act 10. Hand count first: 14 typed notes, 0 handwriting
pages, 0 photos, 0 audio minutes, 0 triage runs = **0 recognition units**. Then
look.

**The other side.** Her agent, in a session with nothing in its context (act 8).

**Without a mouse.** Act 5 — write three of the notes using the keyboard alone,
from the canvas, with the focus ring visible throughout.

**Somebody else's data.** She has none to steal yet, being first. So do it in
reverse: **record her space id and note ids in the Account block**, because P02
through P08 will each try to reach them, and P01's ids are what they aim at.

---

## Verification

Filled in at the end, honestly, **including what was skipped** (RULE #4).

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
| Seconds from opening the app to the first character being safe | |
| Seconds from landing on the apex to note 1 existing | |
| Recognition units: hand count vs screen | |
| Agent answers correct, of 4 | |
| Machine timezone | |

---

## Run log

Written act by act **as you go**, not reconstructed at the end. Each entry: what
you did, what you saw, what you decided. Quote the exact words on screen — the
sentence is often the defect.

### 2026-09-16 — act 1, she finds it, cold

Machine timezone: **recorded at the end of the run** — not yet read.

**Setup, and an honest note about it.** Chrome clamps a window to 500px minimum,
so a real 360px viewport is not reachable by resizing. The 360px pass is done in a
360x780 same-origin iframe, which is what the rulebook prescribes. Browser page
zoom was at 26% when the run started and Brandon reset it to 100%; every
measurement above was taken after that.

**What she saw.** The tab title in her search results read **"Jotacular — the notes
app Claude can read"**, which is almost word for word what she searched for. On the
page, the first screenful at 360px gave her:

> **Don't organize it. Just jot it.**
> Write it, type it, say it, or snap it. Jotacular keeps your thoughts ready for
> you — and whatever AI you use next.
> [ Start jotting ] [ See how it works ↓ ]

**Verdict: yes, she knows within one screen.** The sentence that told her was the
page title, reinforced by the last five words of the subhead. But the differentiator
is the *tail* of a body paragraph — "Don't organize it. Just jot it." on its own is
a claim Apple Notes could make. Deducted on the Home row rather than filed.

**Filed and fixed: issue 004.** She tapped "See how it works ↓" and landed with
"Four seconds, and" hidden behind the floating site bar. `scroll-margin-top` was
absent from the whole stylesheet. Fixed at one point — `--bar-clear` on `.jd-site`,
`scroll-margin-top` on `.jd-band` — and re-proved by tapping the same button and
looking at the heading. `#ai` had the same bug and was fixed by the same change.

**Two things deliberately NOT filed**, because checking made them non-defects:

1. "For your AI" in the nav and "whatever AI you use next" in the subhead look like
   they break the copy rule (agent, not AI). They do not — docs/11's own marketing
   section writes "Your AI can read it all". The word list binds product UI only.
   The rulebook has been corrected so no later run files this.
2. The header nav is `display: none` at 360px with no hamburger. It is *not* a
   focus trap — `display:none` keeps it out of the tab order, checked. And Pricing
   is still reachable from a mid-page link and from the footer. Deduction, not
   defect.

**Open question, not yet a finding.** The apex promises **"Four seconds"**;
docs/00 promises under **one second** and names >1s as the product's failure
signal; docs/11's own hero says "in a second". Not false — four is a weaker promise
than one — but it is a different number from the one the docs govern. **Decided
after act 4**, when there is a measured number to judge it against.

**Scored:** apex Home 8/7, Jot before you sign up 9/8, Four ways in 8/8.

### 2026-09-16 — act 2, she jots before signing up

Clicked into the hero canvas and typed note 1 exactly as written:

> `route planner should assume the walker knows the roads better than the map does`

**It is a real canvas, not a picture.** The text went in, wrapped to two lines, and
the caption under it changed from "Nothing to sign up for. Start typing or writing."
to:

> ● **Jot saved. Sign in to keep it and reach it from your phone.**  [ Keep this ]

That is the promise kept and the next step offered in one line, with no account and
no dark pattern. It is the strongest moment on the site so far.

**One deduction recorded, not filed:** at rest the hero reads as a screenshot — the
toolbar is drawn, the sample note is drawn, and nothing carries a caret. She only
found out it was live because the run told her to try. A person on a forecourt may
not.

**Still to do in this act:** the beacon check — close the tab mid-sentence on a
second attempt and confirm the half-thought survives. Not yet done.

### 2026-09-16 — act 2 finished, the beacon

Typed ` — half a thought that must surviv` onto the end of the hero jot and closed
the tab mid-word, with no wait. Opened a brand-new tab at the apex.

**The half-word was there.** "…the map does — half a thought that must surviv".
The capture beacon does what it says, and it does it for somebody who does not yet
have an account. This is the product's central promise and it holds.

### 2026-09-16 — act 3, she claims it

**Filed and fixed: issue 005.** The sign-in screen said nothing about the thought
she had just handed over. It now reads "Your jot is waiting. Signing in is what
keeps it."

**Filed and fixed: issue 006 — the serious one.** She signed in and was shown
**"Something went wrong"**. The claim had actually succeeded — user row, claimed
session, space, note, all correct in the database — but the first thing the product
ever told her was that it had failed.

Cause: sign-in happens in a server action, whose redirect the client router
re-fetches as an RSC navigation, and `/claim` was a Route Handler, which cannot
answer one. Isolated by experiment, not by reading: the same form redirecting to
`/dashboard` (a page) worked, redirecting to `/claim` (a route handler) threw.
`/claim` is now a page. Re-proved end to end with a fresh account.

**One false alarm, recorded so nobody re-files it.** Sign out appeared to be broken
too. It was not — a Fast Refresh rebuild caused by my own edit swallowed the
action. It worked on a settled server. **My mistake, not the product's.**

### 2026-09-16 — act 4, her first note on the canvas

**Filed and fixed: issue 007 — a blocker.** She signed in the next time and the
canvas was **blank**. Her idea was not on it, and the Dashboard's History showed a
single entry called "Untitled" — an empty note the blank canvas had just made for
her.

The thought was not deleted. It was stranded: jotting before signing up leaves a
person with **two** `personal` spaces — `From the web` (the claimed one, holding
her note) and `Personal` (provisioned a minute later, empty) — and `defaultSpaceId`
chose between them from a query with **no ORDER BY at all**. So her home space was
not merely the wrong one, it was unstable between requests.

Fixed by ordering `listSpaces` oldest-first, which makes the space she started in
her home. Re-proved by eye and by fetching `/` three times. Six smoke suites
re-run green.

**Still open underneath it:** she has a second space no screen can open. That is
issue 001, and the structural answer — not creating two spaces in the first place —
needs a migration, which is Brandon's to run.

**Scored so far:** apex Home 8/7, Jot before you sign up 9/8, Four ways in 8/8,
Sign in 8/8, The canvas 8/6, Dashboard 7/5. Two surfaces seen but deliberately
NOT scored, because they were only ever seen at desktop width: `A note` and the
"Something went wrong" pane.

**Open question for act 5:** there is no visible way to start a second note. The
canvas has one floating pill and none of it says "new". Finding out how she makes
note 2 is the next thing.

### 2026-09-16 — act 4, the root cause

Brandon asked for the cause rather than the symptom, so issue 007 was taken all the
way down: **migration `0037_one_space_not_two.sql`**.

Claiming a jot no longer leaves anybody owning two personal spaces. Three parts,
because it turned out **a space could not be deleted at all** — every foreign key
into `spaces` is `ON DELETE CASCADE`, and the last-owner guard from 0014 fired on
each cascaded `space_members` row and refused.

The part worth remembering: **"this space has rows in it" is not the same as
"somebody used this space."** Opening the canvas writes an empty note and an ink
layer holding `"strokes": []` all by itself, so a row count would have called every
fresh space "used" and repaired nobody. `app_space_is_untouched` asks about content
instead — a block with words in it, a photo, an ink layer with an actual stroke, a
capture token, a comment.

**61 accounts in this database were carrying the second space.** 60 were repaired.
One was correctly left alone: `loopback-check@example.test`, whose `Personal` holds
eight real ink and photo assets. That refusal is the guard working, not failing.

Re-proved with a brand-new account, `p01.onespace@jotacular.test`: jotted on the
apex, signed in, landed on the note, and the Dashboard shows **one** badge —
`Personal` — with her note under History. Ten smoke suites green afterwards.

Marisol's own account is now one space called `Personal` holding her idea, which is
what she thought she was getting when she tapped Keep this.

**Dashboard re-scored: Ease 5 → 6.**

---

### 2026-09-16 — act 5, a week of fragments

**All fourteen notes exist**, in her space, with the exact words from The data —
the apostrophe in 2, the two pound signs in 3, the accent in 4, the `+44` in 5, the
280 characters of 6, the quotation marks in 12 and the ampersand in 13. Read back
from the database row by row and compared against the table above.

**Seven defects came out of this act. Six are fixed and confirmed; two more are
filed and left for a decision.**

#### The open question from act 4 is answered

There IS a way to make a second note, and it is two taps: the magnifier, then
**New note**, which is the first thing in the palette and highlighted by default.
`Ctrl+N` does it without the palette at all. My note at the end of act 4 — that the
palette offered only Dashboard and Account — was simply wrong.

The ⊕ is not it. **Add › "A note on the canvas"** puts a text box on the page you
are already on. Two items with the word *note* in them, meaning two different
things, one of them in a menu whose tooltip says *"or a note"*. Recorded on the
`AddMenu` row rather than filed.

#### What was found

| | | |
| --- | --- | --- |
| **008** | major | every note she typed on the canvas was called `Untitled` — 66 of 144 in this database |
| **009** | **blocker** | she reopened note 2 and five of its six lines were gone |
| **010** | minor | the ⌘K palette listed the note she wrote a minute ago as `Untitled` |
| **011** | minor | the app told this Windows machine to press `⌘K` |
| **012** | major | she could not write a single word without a mouse |
| **013** | major | a note she started by mistake can never be removed — **open, needs a decision** |
| **014** | major | she typed a sentence, the page reloaded, and it had never been sent |
| **015** | minor | a sentence on a 360px screen is a 120px ribbon — **open, a taste call** |

**009 is the one that mattered.** All eighty-one characters were safely in the
database and on screen she saw two words. The box was measured for height while it
was still empty and never measured again, so a loaded page drew one line and clipped
the rest. One statement moved. It is the exact failure this exercise exists to find:
every suite was green, the data was perfect, and the customer's thought was not on
the screen.

**014 is the one that says most about the product.** Canvas text reached the server
only when the box lost focus — no timer, nothing. The defence that should have
caught it already existed and flushed a queue the text had never been put in, under
a heading reading *"The last line of defence for unsaved strokes."* Meanwhile the
apex hero protects an anonymous stranger's half-typed jot with a beacon, proved in
act 2 of this same run. **The product guarded a stranger's sentence and not hers.**
Now fixed for app-switching and backgrounding; still lost on a hard reload, which is
written down in the issue rather than rounded up.

**012 was found by the standing check, not by looking.** Choosing *A note on the
canvas* selected the Text tool and stopped, and nothing on the keyboard can place a
box — the full list of what the canvas answers to is Escape, Delete, Backspace and
Ctrl+Z/Y/C/X/V/D. Notes 12, 13 and 14 were then written with no pointer at all, which
is what the standing check asks for.

#### The standing checks worked in this act

| Check | Result |
| --- | --- |
| **Without a mouse** | notes 12, 13, 14 written keyboard-only: `Ctrl+K · Enter · Tab×3 · Enter · Down×2 · Enter · type · Escape`. Focus ring visible at every step. **Only possible after 012 was fixed** |
| **Wrong move #2** — Back after note 9, then Forward | clean. Back landed on note 8, Forward returned note 9 with all eighty-one characters and the right height |
| **Reload with an unsaved sentence** | **failed** — that is issue 014 |
| **Timezone** | `America/Los_Angeles`, PDT, UTC−7. Every timestamp below is in it |

#### What this act did NOT do, and why

**The fourteen notes are all on one date.** Act 5 asks for at least three dates
including one at 23:58. The machine clock read 02:31 to 02:48 on 2026-09-16 PDT
throughout, and there are only two ways to get a second date: wait twenty-two hours,
or write `created_at` by hand. **The rulebook forbids the second** — *"Never write
through it. Not an insert, not an update, not a fix."* So it was not done.

Consequences, stated rather than glossed:

- the **23:58 boundary** is `not checked`
- the **"search for it yesterday"** check is `not checked`
- act 5's own *done when* — *"dates that are not all today"* — is **not met**

This is the one thing in the run that needs Brandon's hand. A short backdating
script over these fourteen `created_at` values would unblock all three, and it is
his to run.

**Her space has fifteen notes, not fourteen.** The extra one is empty of her words
and holds the wreckage of two tests: a stray highlighter dot and the sentence from
the 014 reload check. It exists because issue 012 made a note I could not write in,
and it is still there because issue 013 means **nothing in the product can delete
it**. It is left in place deliberately — it is the live evidence for 013.

**Act 10's count will not be zero.** A pen dot I left on that junk note by accident
was picked up by the recogniser, so her allowance has one recognition against it
that she did not cause. The reading it produced — `check with Dana about the
margins` — is canned output from `fake-recognizer-v1`, the local dev stub in
`packages/vision/src/provider.ts`, not a model inventing a sentence. **My slip, not
the product's.** Act 10 should hand-count **1**, not 0, and compare against that.

#### Verified after every fix

Thirteen smoke suites green — `objects canvas ink search api anon arrows stickers
links marks mcp export history` — then seven of them again after the last two
changes. `pnpm --filter @jotacular/web typecheck`, `lint` and `build:verify` all
clean; the production build compiles 27 pages.

**Scored: 10 of 65 screens.** `The canvas` 8/7, `A note` 8/7 (first time at 360px),
`Dashboard` 7/7, `Add menu` 8/7, `Canvas chrome and ⌘K palette` 8/8.

---

### 2026-09-16 — act 6, she needs one back

**She got note 6 back, on her second word.** All 287 characters of it, on screen at
360px, twenty-one lines tall and every one of them drawn — which is the issue 009
fix holding under the longest note she has.

**How she got there, and how many attempts.** The persona named three words she
would reach for. Two of the three fail:

| She types | What happens |
| --- | --- |
| `raining` | **"Hmm — not in your jots."** It is in her jots |
| `leads` | note 6, first row. **This is how she got there** |
| `map` | notes 7 and 1. **Not note 6**, which also contains the word |

The `map` result is the quiet one. Note 7 is titled *"Kidderminster lay-by idea"*,
so a search for `map` hands her something that looks exactly like the answer and is
not it — it is the one-line version of the thought, not the paragraph that explains
why. She would have stopped there and never known note 6 existed.

#### Filed: issue 016 — her agent can search her notes and she cannot

The palette does not search. It filters the preloaded list in the browser over each
note's title and its 180-character preview, so **character 181 onwards is invisible
to her**. The cut is exact and measurable:

    leads       169   found
    raining     199   not found
    competitor  218   not found
    map         241   not found
    sentence    279   not found

Meanwhile `searchNotes` — reciprocal-rank fusion over full text, trigram and
embeddings, with typo tolerance and RLS, eleven smoke checks green — is called by
**`apps/mcp/src/tools-read.ts`**. Her agent gets the real search. The server action
that would give it to her, `searchNotesAction`, is written, exported, wired to the
right space, and **has no callers at all**.

Read straight against her space, the index finds note 6 by `raining` in one
statement. The capability is there. The screen does not ask for it.

**And the empty message asserts something false.** *"Hmm — not in your jots"* is a
claim about everything she has ever written, made by something that read the first
180 characters of the most recent hundred notes. For this persona specifically it is
the worst sentence in the product: she came here because she had a thought at 70mph
and could not find where she put it.

**Fixed the same day, by the cheapest of three options.** `CommandPalette` filters
internally and exposes no `onQueryChange`, so nothing outside it can hear what she
typed — that block is real. But `CommandItem` accepts `keywords`, and the component
filters on those too. `listNotes` gained an opt-in `words` column that joins every
block of a note in page order, capped at 2000 characters, and the palette matches on
it. Nothing else's behaviour changed: `words` is asked for by one caller.

Re-run at 360px through the real palette:

| She types | Before | After |
| --- | --- | --- |
| `raining` | *"Hmm — not in your jots"* | **note 6** |
| `map` | notes 7 and 1 | notes 7, **6** and 1 |
| `competitor` | nothing | **note 6** |
| `poo bag` | nothing | **note 6** |

**It is not the real search and the issue says so.** A typo still finds nothing, the
ranking is the component's rather than RRF's, and only the hundred most recent notes
are loaded. `searchNotesAction` still has no caller. The 180-character cliff is
gone; the ceiling has moved rather than vanished, and Options B and C stay open.

#### The three sideways searches pass

The deliverable list names three. All three work, because all three words fall
inside the first 180 characters of their notes:

| Query | Finds | Word sits at |
| --- | --- | --- |
| `panic` | note 12 | char 20 |
| `discount` | note 3 | char 79 |
| `pixel` | note 4 | char 90 |

**They pass by luck, not by design.** Had Marisol put the price question at the end
of note 3 rather than the start, `discount` would have failed the same way `raining`
did. Recording them as a pass without that sentence would be exactly the
"absence presented as measurement" this framework exists to stop.

**Act 6 is done.** `Canvas chrome and ⌘K palette` went Ease **8 → 5 → 8**. Act 5 had
used it to navigate, and it navigates well. Act 6 used it to search, which is how it
lost three points and got them back.

---

### 2026-09-16 — act 7, she connects Claude

**The connection works, end to end, for real.** A client registered through dynamic
registration, PKCE with S256, consent given on the screen, the code exchanged at
`/oauth/token`, and a bearer token that the MCP server at `:3402` accepted. Ten
tools listed. It appears in **Connected agents** with what it can reach, named
space by space and scope by scope.

**The consent screen is good.** *"Claude wants access to Jotacular"*, three scopes
as plain sentences rather than `notes:append`, the space named, and one line
underneath that is the whole reassurance:

> You can revoke this at any time from Account. Nothing an agent does to your notes
> is permanent.

Its error states are as good. A missing `client_id` gets *"Nothing was granted. You
can close this page."* — it names the fault, tells her nothing happened to her, and
does not ask her to do anything she cannot do.

#### Four things found, three fixed

**017 — the page promised her agent could add notes, and her plan forbids it.**
`/account` said *"It can add to your notes and leave comments"* two sections below
`Personal · free`. Both are refused on free by `assertAgentMayWrite`. The fence got
a name — `agentMayWrite(plan)` — and the paragraph now branches on it.

**018 — the consent screen could be drawn inside somebody else's page.** No framing
headers anywhere, on either host. **Read the measurement before the severity:** the
attack was built and it did not work, because the session cookie is `SameSite=Lax`
and a cross-site frame does not get one — so the framed page showed sign-in and
there was no Allow button to steal. That is a default, not a defence, and RFC 9700
asks for the control on its own terms. `frame-ancestors 'none'` now, on that path
only: the rest of the app stays framable because seven more persona runs depend on
the iframe harness, and that is written down rather than left as a surprise.

**020 — consent was granted for a server this deployment does not run.** The
`resource` was required and never checked. A token minted for `:3400/mcp` sailed
through consent and was then refused everywhere, forever, with the error landing
inside her assistant rather than on the screen that could have caught it. Now
refused up front, **naming the right address** so the refusal is a fix she can paste.

**019 — "last used never used".** A helper returning a fragment for four branches
and a whole phrase for the fifth, with the caller supplying the missing words. It
only shows on a connection nobody has used yet, which is every connection for its
first minute — exactly when somebody is looking to check it worked.

#### Two things that are right, recorded as passes

- **Audience binding works.** A token for the wrong resource was refused by the real
  server with a correct `WWW-Authenticate` pointing at the protected-resource
  metadata. Measured, not assumed.
- **The token endpoint requires `resource` too**, not only the authorize endpoint.

### 2026-09-16 — act 8, she asks it the four questions

From a session with nothing in its context. **All four right, the correct note
first, every time.**

| She asks | Came back | From |
| --- | --- | --- |
| What did I decide about the second-dog discount? | note 3, first hit | `lexical + semantic + fuzzy` |
| What is the 4 o'clock panic? | note 12, first hit | `lexical + semantic + fuzzy` |
| What did Beatriz report? | note 4, first hit | `lexical + semantic + fuzzy` |
| What am I shipping this month? | note 14, first hit | `lexical + semantic + fuzzy` |

**The second-dog answer is right in the way that matters.** Note 3 is a question —
*"does the second dog discount survive a 3-dog house or does it stack"* — so an
agent reading it reports that she did not decide, which is what the persona demanded.

**Every result says why it matched.** `matched by lexical + semantic + fuzzy` is
attached to each hit. An agent can tell a keyword hit from a meaning hit, which is
the difference between citing a note and guessing at one.

**One test came out weaker than written, and it is worth saying so.** The persona
asked that "4 o'clock panic" be found *without the phrase being in a title* — written
when a canvas note's title was always `Untitled`. Fixing issue 008 gave note 12 a
title taken from its first line, which contains the phrase. **So that check no longer
proves what it was built to prove.** It passes; it just proves less.

**And the asymmetry act 6 found, from both ends.** Her agent has always had the real
`searchNotes` — RRF over full text, trigram and embeddings. Her palette had a
180-character substring filter, and told her a word she had written was not in her
jots. Issue 016 closed most of that gap the same day.

### 2026-09-16 — act 9, the thing that goes wrong for her

All three write tools refused, immediately and identically. The refusal answers two
of the act's three questions and not the third, so it is
**issue 021**, now fixed:

> This space is on the free plan, where an agent can read but not write. **Solo and
> up can — change it in Jotacular under Account, What you are on.**

**Underneath it, something not fixed.** The consent screen offered her
`notes:comment` and `notes:append` as things her agent *"will be able to"* do, and
she granted them. Two of those three were always going to be refused. Issue 017
fixed the same sentence on `/account`; the consent screen still tells it, in the
more expensive place. `agentMayWrite` is now available to that page — whether an
un-grantable scope should be hidden, greyed or labelled is Brandon's call.

### 2026-09-16 — act 10, the count and the bill

**Hand count first, as the standing check demands.** Fourteen typed notes, no
handwriting, no photos, no audio, no triage. **Zero units.**

The screen said **3 of 100**. It was right, and finding out why turned up the
biggest defect of the act.

**022 — typing on a page with a doodle re-billed reading the doodle.** One stray pen
dot, charged three times, on the same block, minutes apart. Nobody drew in between;
somebody typed. `applyInkDelta` asked *"is there ink on this page"* rather than *"did
the ink change"*, so every text delta queued a fresh model call over unchanged
handwriting — and a recognition is billed whether or not it had anything new to look
at. The line above it already did this correctly for the search index.

Realistically that is a page with one sketch and an afternoon of notes typed around
it, costing a reading **every time the typist pauses for thirty seconds**.

Fixed, and re-proved on that same note: a text box added, a sentence typed, and
**zero recognition jobs and zero structure jobs queued**.

**With the dot accounted for, the meter is honest.** Screen 3, database 3, hand count
3 — and her own captures, correctly, 0. Plans and prices match docs/01 line for line:
Solo $5/1,000, Family $9/2,000, Team $19/10,000, free 100, and `app_plan_allowance`
returns exactly those numbers.

#### And a blocker that no screen shows

**023 — eight dead jobs stopped every drawing on this database being read.**
`structure:smoke` failed and it was not flaky. `app_claim_structure_jobs` picks the
oldest due jobs and then JOINs them to their block; a job whose block is gone matches
nothing, so it is not leased, not counted, not completed — and picked again next
time. Eight of those at the head of a batch of eight means **every claim returns
zero**, and the worker reads zero as "queue empty".

Measured: 8 dead in front, 19 healthy behind, `app_claim_structure_jobs(8)` returning
0. Every dial green — no error, no attempts, no backoff, and queue depth is not a
metric.

`app_claim_recognize_jobs` has never had this problem and its comment names the exact
case — *"a note that was deleted"*. Structure was written later and did not copy it.

**The orphans here came from migration 0037, which this exercise wrote.** That does
not make it 0037's bug — the queue has to survive a block being deleted whatever
deleted it, and the sibling queue does — but it is why they appeared eight at once.

**Migration 0038 is written and NOT run.** The rulebook is explicit that migrations
are Brandon's. `pnpm structure:smoke` stays red until it runs, for that reason and
not a new one.

**Ruled out first:** the metering fix was reverted for one run to check it was not
the cause. The same eight checks failed. It was restored.

### 2026-09-16 — the last two standing checks

**Wrong move #3 — revoke while an agent session is open.** `/account` promises
*"Revoking takes effect immediately — the agent's next request fails, it does not
wait for a token to expire."* Tested exactly: session open, question answered,
Disconnect pressed, and the **very next request on the same session with the same
unexpired token** returned 401. The promise holds. Disconnecting asks first, with
`Keep` rather than `Cancel`, which is the better word because it says what happens.

Filed from it: **024**, a nit. Revoked and wrong-address give the same sentence, and
they need opposite responses. Not fixed — the fix lands in `oauth.ts`, which the root
`CLAUDE.md` lists at 564 lines and requires to be split the next time it is edited.
That is deliberate work, not something to attach to a persona run.

**The deep link — 025, and it was a `major`.** Her note's address, opened signed out,
redirected to `/signin` **with no `next`**, and signing in dropped her on the canvas.
Every deep link into the app forgot itself — notes, dashboard, account.

The sign-in page had been ready the whole time: it reads `?next=` and `safeNext`
already refuses `//evil.example`. **The receiving half was built, hardened against
attack, and never fed.** Middleware now puts the requested path on the request and
`requireActor` sends it. Re-proved: `/n/739444fa…` → `/signin?next=%2Fn%2F739444fa…`
→ signed in → **note 6**.

---

## Verification — P01 complete, 2026-09-16

| | Result |
| --- | --- |
| Acts completed | **10 of 10** |
| Issues filed | **22** — 004 to 025 |
| Issues fixed and confirmed | **19** — 004, 005, 006, 007, 008, 009, 010, 011, 012, 014, 016, 017, 018, 019, 020, 021, 022, 023, 025 |
| Issues blocked, and on what | **None are blocked any more.** As filed: **013** and **001** on scope (screens that did not exist), **015** on taste, **024** on a 564-line file split, **002** and **003** from discovery, **023** on the dev server. **All six were closed on 2026-09-16**, and 001 turned out to need two screens and no new logic — see [the invite re-run](#the-invite-re-run-2026-09-16) below |
| Screens scored | **14 of 65** |
| **Not checked** | see below, in full |

### What was NOT checked, and why

**RULE #4. None of these is a pass.**

- **Dates.** All fourteen notes are on one day, `2026-09-16`, `America/Los_Angeles`
  (PDT, UTC−7). Act 5 asks for three dates including one at 23:58. The only routes
  there are waiting twenty-two hours or writing `created_at` by hand, and the
  rulebook forbids a run from writing to the database. **Consequences: the 23:58
  boundary is not checked, and "search for it yesterday" is not checked.** A short
  backdating script over those fourteen rows would unblock both, and it is Brandon's
  to run.
- **Dark mode.** Was unreachable when this run happened — issue 002 — so every
  screen here was scored in light only. **002 is fixed as of 2026-09-16** and dark
  is on (ADR-116). The routes this run opened measure **0 AA contrast failures in
  both themes**, but a contrast audit is not a score: these panes were not
  re-composed in dark. **A dark pass is owed on this run's rows.**
- **The paid-plan branch of issue 017's copy.** No space in this run is on a paid
  plan. The sentence is the one that was already there, moved behind a condition.
  Reasoned, not measured.
- **The Mac branch of issue 011.** There is no Mac in this run. Windows is measured
  (`navigator.platform` is `Win32`, the label reads `Ctrl+K`); the `⌘` branch is not.
- ~~**Issue 023's fix.**~~ **Checked, later the same day.** Brandon stopped the dev
  server and granted `pnpm db:migrate`. The problem had grown while it waited:
  **19 dead jobs holding 323 healthy ones**, and `app_claim_structure_jobs(8)`
  returning 0 rows. After the migration: 19 closed, 323 freed, 8 rows claimed,
  `pnpm structure:smoke` all good. Her drawings can be read again.
- **Google sign-in.** Every sign-in in this run used the dev provider. The Google
  path is reasoned-but-not-measured throughout, including in issue 006.
- **A second person.** Issue 001 removes the whole role axis. Presence, live updates,
  comments from another human and "who else is here" are built and were not opened
  by anybody, because nobody can be invited.
- **51 of the 65 screens.** They are still `—` in [rating.md](rating.md), and those
  dashes are the answer to "what has nobody looked at?"

### The numbers

| | |
| --- | --- |
| Notes she has | **15** — her fourteen, plus one empty scratch note the product gives her no way to delete (issue 013) |
| Recognition units | **3 of 100** on screen, **3** rows in the database, **3** by hand. Her own captures: **0** |
| Space | one, called `Personal`, which she cannot rename (issue 003) |
| Connected agents | one, connected and then revoked as a wrong move |
| Questions answered correctly by her agent | **4 of 4**, right note first every time |
| Smoke suites green | **24 at the time of her run**, with `structure` red for issue 023. **All green as of 2026-09-16**, once the migration ran |

### The deliverable inventory, against what she actually has

| Item | |
| --- | --- |
| 14 notes, as written | **yes** — read back word for word, apostrophes, accents, `+44`, both pound signs, the 287-character one |
| ...over three dates, one at 23:58 | **no.** One date. See above |
| Note 1, written before she had an account | **yes** — same words, never retyped |
| Search that works sideways | **yes** — `panic`, `discount`, `pixel` all find their note, and after issue 016 so do `raining`, `map` and `poo bag` |
| A note she can get back to | **yes** — note 6, on her second word, and now reachable by a link from a signed-out browser (025) |
| A connected agent | **yes** — Claude, through real OAuth, appearing in Connected agents with its three scopes and one space |
| Four answered questions | **yes** — all four, checked against the note by eye |
| A refusal she understands | **yes**, after issue 021. Not before it |
| A count she can check | **yes** — and it agreed with a hand count and with the database |

**Working end to end:** she asked her agent what she decided about the second-dog
discount, from a session that had never seen her notes, and got note 3 back — which
says she did not decide.

**Status: done.**

---

## What P01 leaves for the others

- **Her ids are the target.** P02–P08 each try once to reach them (RULE #7):

      user   b8c3bfc1-eded-4ae6-b30e-b3ae50a3091c
      space  739e5257-4a77-4740-ba5c-1b9d9138089c
      note 6 739444fa-d480-4e84-b83f-fb93e316271b   the long one, worth stealing

- **The spine is verified and can be trusted.** Apex → hero jot → claim → canvas →
  dashboard → account → agent. The rest walk it at speed and report only differences.
- **Do not re-file these.** The Next.js dev badge overlapping Sign out is a dev
  artifact. `check with Dana about the margins` is `fake-recognizer-v1`, the local
  stub. "Your AI" on the marketing site is correct per docs/11.
- **Accounts that must stay.** `p01.marisol` is the persona. `p01.scratch`,
  `p01.retest` and `p01.onespace` are evidence for issues 006 and 007. **Never sign
  in as `loopback-check@example.test`.**

---

## The invite re-run, 2026-09-16

Act 3 asked Marisol to put her husband in a space. When P01 first ran, she could
not: issue **001** was filed and the act was left blocked. The functions existed;
nothing called them. Both screens were built later that day, and this is the act
re-driven as her, on them.

**What she did, on the screen:**

1. Made *The Okonkwo house*, a family space. It seated **1**, and said so.
2. On the family plan it seated **6**.
3. Typed an address and pressed **Make an invite**. Seats went **1 → 2 of 6** and
   she got a link.
4. Opened that link **as herself** — *"That invite was sent to a different
   address."*
5. Tolu signed in, opened it, and landed on the dashboard with *The Okonkwo house*
   in his list. Two members in the database, invite marked used.
6. Opened it a second time — *"That invite has already been used. If it was you,
   you are in already."*
7. A made-up token — *"That link is not one of ours."*
8. Made an invite, pressed **Take it back**, opened it — *"That invite was taken
   back."*

**Four of the six refusals are now proved from the screen**, in her words rather
than a code. The other two — expired, and the space filling up first — are proved
in `invite:smoke`, because neither can be reached by waiting in a browser.

**Two defects came out of the re-run**, and both needed her real data to appear:

- **[049](issues/049-she-took-the-invite-back-and-the-link-is-still-on-screen.md)** —
  taking an invite back left the dead link, its sentence and its **Copy** button on
  screen. She would have sent it.
- **[050](issues/050-take-it-back-is-off-the-side-of-her-phone.md)** — at 360px
  the **Take it back** button sat 74px off the right edge, because a real address is
  long and a `flex-1` item will not shrink below its own text. A short test address
  fitted, which is exactly why it survived this long.

**Act 3: done.** She holds a shared space with a second person in it.
