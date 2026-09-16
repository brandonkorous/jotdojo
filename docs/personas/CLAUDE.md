# CLAUDE.md — Jotacular persona testing

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-09-16

Binding for anything under `docs/personas/`. Where it is silent, the repo's root
[CLAUDE.md](../../CLAUDE.md) applies.

This folder is not documentation about testing. It **is** the test: 8 real people,
each with a phone and a reason to be here, each set up from nothing and operated
until their job works or breaks. A persona file is both the **script** and the
**log** — you read it to know what to do, and you write to it as you do it.

---

## RULE #1 — judge it as the person, not as an engineer

**Drive the screen.** Tap it, write into it, read what comes back, and decide what
a person would do next. Every real defect this project has produced was found by
opening a page or querying the data, and every one of them passed typecheck, lint
and build first.

**Never `fetch()` an endpoint to prove a feature works.** A green API response says
nothing about whether anyone can reach it. `psql` and `curl` are for **verifying
what the UI wrote** — never for doing the work the UI was supposed to do. If a
screen cannot create the thing, that is the finding; creating it through the API
and carrying on erases it.

This product has a sharp version of that trap: **it has 30 smoke suites and an MCP
server.** It is very easy to prove a feature through `pnpm members:smoke` or
through an MCP tool call and never notice that no human being can reach it. Issue
001 is exactly that defect, and it was sitting under 29 green checks.

**The verdict is theirs, not the code's.** A run does not ask "is this implemented
correctly" — it asks **could Marisol finish this job, and would she come back
tomorrow?** Those come apart constantly, and where they do, theirs wins:

| Technically | But as the person | Verdict |
| --- | --- | --- |
| works | they could not find it, or did not know it was there | broken |
| works | it took nine taps and two screens they did not understand | broken |
| works | the word on the button is not a word they use | broken |
| works | it told them nothing happened, and something did | broken |
| an edge case | it is Tuesday and they do this every Tuesday | major |

So write findings in their terms. **"Hazel could not find the note she wrote on
Sunday"** is the finding; "the dashboard is only reachable from the command
palette" is the cause, and it belongs further down the same file.

Three things a person never does, so you must not do them either:

- **Read the source to find out whether something works.** Look at the screen.
  Read code only once you are fixing what the screen already proved.
- **Know what the software is called underneath.** Nobody types `ink`. If you
  needed a module name to navigate, that is a finding.
- **Try again in a different way because the first way failed.** The first way
  failing IS the result. Record it, then try the second way as a separate note.

The tell that you have drifted: you are reading JSON instead of a screen, or you
are pleased that something works when you could not have found it.

## RULE #2 — real data, never placeholder data

The names, notes and numbers in each persona file **are the test data**. Type them
as written. No `Test note 1`, no lorem, no `a@b.com`, no `123`.

Placeholder data hides exactly the defects real data finds: an apostrophe in
`Nia's`, an accent in `Tomás`, a 68-character title, a note that wraps to five
lines at 360px, a handwritten page with a word the recognizer will get wrong, a
list long enough to page.

This product has its own version: **a note nobody would actually write is not a
note.** "Meeting notes" is a placeholder. *"vet said 3ml twice a day til Friday —
Bonnie, not Rufus"* is a note, and it is the one that finds the defect.

Where a file says "at least N", N is a floor, not a target.

## RULE #3 — file it, fix it, then prove the fix from the same screen

**Stop and fix.** A defect is not logged and left; it is repaired the moment it is
found, and then the step that found it is **done again as the person** to confirm
the repair. Five beats, in this order, every time:

1. **File** the issue in [issues/](issues/) — before the fix, so a defect that
   turns out to be two defects does not lose one of them.
2. **Fix** it properly, at the single point of change. Not a call-site patch — a
   call-site patch is a deferred fix everyone else pays interest on.
3. **Re-run the exact step**, as the person, on the screen, with the same data.
   Not a typecheck, not a smoke script, not a `fetch`.
4. **Record the confirmation** in the issue: `Status: fixed`, `Fixed:` stamped, and
   one line on how it was proved — the screen, the data, what you saw.
5. **Re-score the screen** in [rating.md](rating.md) if the fix moved it, keeping
   both numbers (`5 → 8`).

Then continue the act. A run is a sequence of repairs, not a survey.

**Why this and not "log it and keep going":** a defect list written on Tuesday gets
fixed in a batch on Friday by somebody re-deriving what the sentence meant, and the
fix never gets driven through the screen that found it. The confirmation is the
part that keeps getting skipped, so it is a numbered beat.

**A fix that touches a file at or over the repo's 250-line limit splits it by
responsibility**, per the root CLAUDE.md. The run is "another reason", which is the
only time that rule asks for a split.

**When a fix genuinely cannot be made now**, say so explicitly in the issue and
keep going — this is the exception, not the escape hatch. It applies to exactly
these:

| Situation | Do |
| --- | --- |
| Needs a schema migration | Write it under `packages/db/migrations`, never edit an existing one, and ask Brandon before running it · `Status: open`, `Blocked on: pipeline` |
| Needs a product decision that is Brandon's | `Status: open`, `Blocked on: decision`, state the options |
| The fix is larger than the surface under test | `Status: open`, `Blocked on: scope`, say what it would take |
| Fixing it needs the dev server restarted | Note it, ask Brandon, carry on elsewhere |

Anything not in that table gets fixed now. A bad experience is never parked as
somebody else's call because it is awkward.

**Design failures are defects and are fixed the same way.** The binding rules are
in [design.md](../../design.md) and they are checkable, not matters of taste:
**§12 no gradients anywhere**; §10 the three typefaces (Nunito for heads, DM Sans
for body and UI, Caveat for the handwritten accent only); §11 the palette — mint,
violet, charcoal, warm paper, white, muted neutral — where violet means agent.
File, fix, look again. `Severity: design`.

**Copy failures are checkable too.** [docs/11-copy-and-tone.md](../11-copy-and-tone.md)
has a Never list and a word list, and both are binding:

| Never on screen | Use | Not |
| --- | --- | --- |
| exclamation marks | **jot** | create, add, compose |
| "Oops!" · "Whoops!" | **note** | entry, item, doc, page |
| "simply" · "just" · "easy" | **space** | workspace, team, org, vault |
| "AI-powered" · "magic" · "10x" | **agent** | AI, assistant, bot, copilot |
| emoji anywhere in our chrome | **comment** | annotation, suggestion, insight |
| blaming the user — "you did not save" | **capture** | save, sync, upload |
| anthropomorphising — "Claude thinks" | **handwriting** | ink |

`Jotacular` is sentence-case in prose. The lowercase `jotacular` wordmark is
artwork, not text, so writing the brand lowercase mid-sentence is a defect.

**The word list above binds product UI, not the marketing site.** docs/11's own
marketing section writes "Your AI can read it all" and "readable by your AI", so
**"AI" on the apex is correct and is not a finding.** Inside the app it is
"agent". Marketing has its own Never list in that doc — no "AI-powered
note-taking app", no comparison chart against Notion or Obsidian, no "second
brain", and no promises about Gemini.

**Copy that is FALSE is not a copy defect, it is a major one.** Any sentence
promising something this product does not do, naming a thing it does not have, or
pointing at a screen it does not include, is wrong rather than off-voice. The apex
sells four plans; two of them promise members that nobody can add (issue 001).
That is a `major` on the marketing page, not a copy nit.

## RULE #4 — never present absence as measurement

If you did not check something, write **"not checked"**. Not "fine", not
"presumably works", not silence. A run that reports six of nine acts and does not
say which three are missing reads as a clean run, and that is worse than an
obviously partial one.

Two live instances in this product, so learn them now:

- **Recognition quality is unmeasured.** Every suite in this repo runs `fake`
  providers that read nothing, hear nothing and judge nothing. If a run does not
  read the transcript with its own eyes and compare it to what was written, it has
  not checked recognition — it has checked that a row appeared.
- **A recognition unit count that would not load is unknown, not zero.** So is a
  transcript that has not finished. The worker is asynchronous; "empty" and "not
  drained yet" look identical on screen, and telling them apart is the run's job.

## RULE #5 — the spine is verified once, then trusted

Every persona walks the same first stretch: **the apex → jot before signing up →
`/claim` → sign in → the canvas → the first real note**. **P01 is the deep
baseline** and verifies it properly, act by act, in the data.

The rest walk it at speed and report spine behaviour only where it **differs** — a
different door (P07 comes in through an iOS Shortcut and never sees the apex), a
different plan, a different first capture mode. Their value is their own surface,
not another re-verification of sign-in. If the spine breaks for one persona and not
another, that difference IS the finding.

## RULE #6 — every screen gets a design score and an ease score

Working is the floor, not the result. **Rate every screen you open**, on two axes,
in [rating.md](rating.md):

| Axis | The question |
| --- | --- |
| **Design** | Is it on-system and well-composed? Real tokens, no gradients, the right three typefaces, violet meaning agent, hierarchy from scale and weight, holds at 360px, and the waiting / empty / error states all present and right |
| **Ease** | Could this person do the job without help? Findable, one home per concern, the data they need already on screen, no dead ends, words from the list above, an obvious next step — and reachable by thumb |

**The two come apart, and both are reported.** A beautiful screen nobody can
operate is not an 8, and a plain screen that gets the job done in two taps is not a
4. When a single number is wanted, quote the lower one.

**A screen is not scored until you have seen it at 360px.** Score it there first,
not last: this is a phone product and the desktop view is the afterthought.

**On themes, the honest position as of 2026-09-16.** The rule is normally "both
themes or it is not scored". Jotacular ships two themes and **only one of them can
ever appear**: `paper-night` is scoped `:root:not([data-theme])` and `layout.tsx`
hard-sets `data-theme="paper"`, so dark mode never activates on any device. Issue
002 carries it. Until 002 is fixed:

- Score every screen in **paper (light), at 360px and at desktop width**.
- Write **`dark: unreachable (002)`** in the gap column. Do not write "not
  checked", because it was checked and the answer is known; and do not leave it
  blank, because a blank reads as a pass.
- **When 002 is fixed, every scored row is stale** and a dark pass is owed on all
  of them. Say so in the issue when you close it.

| Score | Means |
| --- | --- |
| 9–10 | Nothing to fix. 10 is rare and needs a reason written down |
| 7–8 | Right, with named nits |
| 5–6 | Works; they needed a second look or a second attempt |
| 3–4 | They got there by persistence, or it looks unfinished |
| 1–2 | They would stop, ask somebody, or leave |

**The score is not the point — the deductions are.** Every row carries a **gap to
10**: the specific thing that would raise it. That column is the worklist, and
anything in it that is a real defect becomes an issue and gets fixed under RULE #3
rather than sitting in a table as a number.

**Re-score after a fix**, keeping both values (`5 → 8`), so the file shows movement
rather than a final opinion. Screens no persona reached stay `—`; an unrated screen
is unrated, never assumed fine (RULE #4).

## RULE #7 — the 8 are neighbours, and fixes travel

Jotacular's whole tenancy story is one Postgres with row-level security, and the
app connects as the restricted `jotacular_app` role precisely so that RLS is real
(`migrations/0001_app_role.sql`). That boundary is the product. A run that never
pushes on it has not tested the thing the product is.

### Every persona tries to see somebody else's data

Once per run, deliberately:

- **Search** for a word only another persona has written — a surname, a pet's
  name, a street. Search is semantic AND lexical, so it is a real attempt.
- **Deep-link another persona's note id** into the address bar: `/n/<their id>`.
- **Point an agent at it.** Use the MCP connection from this persona's account and
  ask for a note id belonging to another. A token is bound to `MCP_RESOURCE`
  (RFC 8707) and to a space; prove it.

The expected result is nothing: not found, or refused. **A leak here is a
`blocker` and stops the run** — it is the one defect class where continuing to
test is the wrong thing to do.

### A fix made in one run must not break an earlier one

This is the cost of fixing inside the run (RULE #3). After repairing anything in
the **shared spine or a shared screen** — the canvas, sign-in, the chrome, the
account page, the apex — reopen the earliest persona it could touch and do one
real job there.

Record it on the issue as a second confirmation line. A P06 fix that quietly
breaks P01's canvas is otherwise found by nobody, because nobody goes back.

## RULE #8 — the space is the deliverable, not a step in the run

**Each persona ends holding a real, populated, working space.** Not a
demonstration, not four notes and done. A space a stranger could pick up and use.

Each persona file carries **its own inventory** under "The space they end up with".
That list is the definition of done: if an item on it is missing, empty, or still
wearing template words, the run is not finished. Enumerate before you start;
re-check before you say done.

### What "a real space" means, on every one of the 8

- **At least 12 real notes**, written the way this person writes, over dates that
  are not all today.
- **Every capture mode this person uses, actually used** — and the result read
  with your own eyes. A handwritten page whose transcript you never opened is not
  a captured page (RULE #4).
- **Search finds a note from a word that is not in its title.** That is the
  product's floor.
- **The thing it exists for, working from the outside:** their own agent, over
  MCP, answers a real question from these notes — one they actually asked, with an
  answer you checked against the note. P02 is the deliberate exception and proves
  the opposite.
- **Findable again.** They can get back to a note they wrote three days ago
  without being told how.
- **Reachable by thumb** at 360px, with no hover needed to discover anything.

### The 8 must not be one space 8 times

Different content, different capture modes, different plans, different doors.
8 spaces that are the same twelve notes with swapped nouns have tested one path
8 times and told you nothing.

---

## Standing checks — every run, every persona

These are not acts. They are the things a real person does that the scripted acts
do not, and each persona file names its own concrete instance of each.

**Wrong moves.** Real people make mistakes, and mistakes are where lost thoughts
live: erase the wrong stroke and undo it, close the tab mid-sentence, double-tap
the capture button, press Back after writing, delete a note a comment points at,
paste the same block twice, revoke the agent connection you are using. **At least
three per run**, named in the persona file.

**Reload, deep link, restore.** Press F5 with an unsaved sentence on screen. Copy
the address bar and open it in a new window. Open `/n/<id>` while signed out and
confirm you land back on it after signing in. A note you cannot link to is a note
nobody can be sent to.

**Time and dates.** Check the boundary, not the middle: a note at 23:58 that the
worker recognizes after midnight, a search for "yesterday", a month end, an
allowance that resets at the start of a cycle. **Say which timezone the machine is
in when you record the result.**

**The count and the bill.** Not the happy total — the composition. A recognition
unit is *a page of handwriting, a photo, or a started minute of audio*, and a
triage run is one whether or not it had anything to say. **Count this persona's
captures by hand first**, then open Account › Plan and usage and compare. Where
they disagree, the software is wrong. Check the plan price and the member count on
the same screen against [docs/01-audience-and-pricing.md](../01-audience-and-pricing.md).

**The other side of the transaction.** Every run ends as the person on the
receiving end, not the writer. For this product that is **the agent** — open a
fresh agent session with nothing in its context and ask it a question only these
notes answer. Can it get there? Is the answer right? A note nobody can retrieve is
a note that was never captured.

**Without a mouse.** One full job per run driven by keyboard alone, with the focus
ring visible the whole way. And with thumbs: tap targets, reach on a 360px screen,
and whether anything on the canvas needs hover to be discoverable — a canvas is
the worst possible place for a hover-only affordance.

## What every run records

| Record | Why |
| --- | --- |
| **Seconds from opening the app to the thought being saved** | The product's own promise is "under one second", and its own named failure signal is missing it (docs/00-vision.md) |
| Recognition units used, counted by hand vs shown on screen | RULE #4, and the metering is the business model |
| What the recognizer actually returned, vs what was written | Quality is unmeasured everywhere else in this repo |
| Whether the agent answered the real question correctly | This is the product |
| Screens scored, and screens not reached | The denominator |
| Timezone of the machine | Every date result is meaningless without it |

---

## Where things run

| Surface | Port | What you use it for |
| --- | --- | --- |
| The apex — `http://jotacular.localhost:3400` | 3400 | The marketing site. **The first door.** |
| The app — `http://localhost:3400` | 3400 | The canvas, account, sign-in, everything a person touches |
| Capture API | 3401 | The iOS Shortcut and the Android share target land here. Drive it the way the Shortcut does, never with bare `curl` to prove a feature works |
| MCP server | 3402 | What the agent sees. `MCP_RESOURCE` is `http://localhost:3402/mcp` |
| Worker | — | Recognition, embedding, re-reading, triage. No port. Watch its stdout |
| Postgres | 5433 | Read-only verification |

**Start at the apex every time.** Landing straight on `/signin` skips the hero jot,
the anonymous space, the `/claim` handoff and the entire reason the marketing site
exists. P07 is the one deliberate exception, and his door is named in his file.

**Never start the dev server.** `pnpm dev` is Brandon's to run. If the app is not
up, say so and stop; do not start it, and do not start a second one on another
port. `pnpm db:up` is a container, not the dev server, and is fine.

## Accounts

One persona, one real account. Never reuse another persona's — the whole point is
starting from nothing.

| Field | Convention |
| --- | --- |
| Email | `pNN.firstname@jotacular.test` — e.g. `p01.marisol@jotacular.test` |
| Password | **none.** Sign-in is `ALLOW_DEV_LOGIN=true`, which takes an email and nothing else, and refuses to run when `NODE_ENV=production` |
| Display name | The dev sign-in does not ask for one. Record what the app shows |
| Space name | **you cannot choose one.** Provisioning names it `Personal`, or `From the web` if the space came from a hero jot. The name in the persona file is what they WANTED to call it — issue 003 |

## Reading email in dev

**There is none, and that is a measured fact, not an unknown.** No mail library is
installed in any package, and no code in `apps/` or `packages/` sends mail.
`inviteToSpace` writes a token row and sends nothing.

So: **never write "the invite email was sent"**, and never write "not checked"
about an email either — write **"no email is sent; this product has no mail
transport"** and point at issue 001.

**Absence is still not measurement (RULE #4).** If you did not go and look at
something, write "not checked". What must never happen is a run reporting that an
email arrived because a screen said so.

## Verifying what the UI claimed

Read-only, and only to confirm what the UI said it wrote:

```
docker exec -i jotacular-postgres psql -U postgres -d jotacular -c "select ..."
```

- **`postgres` is the owner role and is exempt from every RLS policy.** So this
  connection sees everything and proves nothing about tenancy. Isolation is tested
  from the screen and from the agent (RULE #7), never from here.
- **Never write through it.** Not an insert, not an update, not a fix.
- **Never run a migration from a run.** `pnpm db:migrate` is Brandon's. If a fix
  needs one, write the migration file and mark the issue `Blocked on: pipeline`.
- Migrations under `packages/db/migrations` are a record of what ran. Never edit
  one after the fact (root CLAUDE.md).

---

## Issue files

Name: `NNN-short-kebab-slug.md`, a flat global sequence starting at `001-`. Global
rather than per-persona, because most defects live in the shared spine and
numbering them by who happened to find one implies an ownership that is not real.

Use [issues/_TEMPLATE.md](issues/_TEMPLATE.md). The header block is fixed:

```
**Status:** open · fixed · wontfix · duplicate of #NNN
**Severity:** blocker · major · minor · design · copy
**Found by:** P03 · Tomás Iglesias-Ferrer · act 4
**Surface:** app › canvas › Handwriting transcript
**Filed:** 2026-09-16
**Fixed:** —
**Confirmed by:** re-ran P03 act 4 — <what you did and saw>
**Blocked on:** — (pipeline · decision · scope, only when the fix could not be made)
```

**Title it the way the person would say it.** The cause goes in **Where it lives**,
not in the heading (RULE #1).

| Severity | Means |
| --- | --- |
| blocker | cannot proceed · **a thought is lost** · wrong money · one space's data visible to another |
| major | a real job cannot be finished the way a person would do it, or a sentence on screen is FALSE |
| minor | friction, confusion, a wrong count, an ugly edge |
| design | breaks a binding rule in design.md |
| copy | off-voice, jargon, a word from the Not column — true, but the wrong words |

**A lost thought is a blocker in this product specifically.** docs/01 says it: "We
never refuse a capture. Losing a thought because of a billing limit is the one
unforgivable failure." Anything that drops what somebody wrote is the top severity,
whatever its cause.

**When an issue is fixed, it stays.** Set `Status: fixed`, stamp `Fixed:`, and
record what the fix was, where it landed, and **how it was confirmed from the
screen**. A fix with no confirmation line is not fixed. This is a defect ledger,
not a queue.

There is deliberately **no index of issues**. `ls issues/` is the index, and a
hand-maintained table would be wrong within two runs.

## What is out of scope on a run

Fixing what the run finds is the job (RULE #3). These are the edges of it:

- **Redesigning a screen you are only passing through.** A screen you did not open
  as the person gets no score and no rewrite.
- **A fix bigger than the surface under test.** File it, mark `Blocked on: scope`,
  say what it would take, and keep the run moving.
- **Running a migration.** Write the file; ask Brandon to run it.
- **Restarting or starting the dev server.** Brandon's, always.
- **Committing or pushing.** Never from a run. The tree is shared with other
  sessions and a push to `main` deploys.
- **Resizing the browser window.** Check 360px in device emulation, never by
  resizing somebody's actual window.
- **Re-tuning a model or a prompt** because a recognition answer was poor. Record
  what it returned (RULE #4), file it, and leave the tuning to a separate piece of
  work.

## How to run one

1. Read the persona file top to bottom before touching anything.
2. Confirm the dev server is already up. If it is not, stop and ask.
3. Set `Status: in progress` and stamp the date in **Run log**.
4. Work the acts in order. Each act names its jobs and what "done" means.
5. Fill in the **Account** block as soon as sign-in gives you the values. A run
   nobody can revisit is a run nobody can confirm.
6. **On every screen you open**: score it in [rating.md](rating.md) at 360px and at
   desktop width, and write its gap to 10 plus `dark: unreachable (002)` (RULE #6).
7. **On every defect**: file, fix, re-run the step as the person, confirm in the
   issue, re-score the screen (RULE #3). Do not carry it to the end of the run.
8. Work the **standing checks** as you go. The persona file names its own instance
   of each.
9. Complete **Verification** honestly at the end, including what you skipped.
10. Set `Status: done` only when every act has a recorded outcome — including
    "blocked on a decision, issue 012". Silence is not an outcome.

## Definition of done — the whole exercise

- All 8 persona files at `Status: done`, every act with a recorded outcome
- Every defect in `issues/` carrying a status, and every `fixed` one carrying a
  confirmation line naming the screen it was re-proved on
- [rating.md](rating.md) scored for every screen the runs opened, each with a gap
  to 10, and the unreached ones still visibly `—`
- **8 complete spaces** — every item in every persona's inventory captured,
  searchable, and answerable by that person's agent, and looking like eight
  different people's notes rather than one file eight times

8 scripts and no runs is nothing. 7 runs and one stock persona is an unfinished
deliverable that reads as finished. 8 runs with a hundred logged defects and no
fixes is a survey, which is not what this is.
