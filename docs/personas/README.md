# Jotacular — the persona test roster

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-09-16

8 people, 8 phones, 8 full runs from "never heard of it" to a real space their own
agent can answer from. How to run one is in [CLAUDE.md](CLAUDE.md).

**A run produces four things, and none of them is a report at the end:**

| Artifact | What it holds |
| --- | --- |
| the persona file | the script, the log written into it act by act, and its standing-check results |
| [issues/](issues/) | one file per defect — **filed, fixed, and re-proved from the screen, inside the run** |
| [rating.md](rating.md) | a Design and an Ease score, 1–10, for **every screen opened**, at 360px, with its gap to 10 |
| **a real space** | 12+ real notes, captured the way this person captures, searchable, and answerable by their agent — the inventory in each persona file is its definition of done |

It is a repair pass judged by the person, not a survey judged by a developer. The
question is never "is this implemented" — it is _could Marisol finish this job, and
would she come back tomorrow?_

**Every run also carries the standing checks** (CLAUDE.md): the wrong moves, a
reload and a deep link, the date boundaries, the recognition count computed by hand
before it is read off the screen, the other side of the transaction — which for
this product is **the agent** — one job without a mouse, and one deliberate attempt
to see another persona's notes.

## Why 8, and why these 8

The count is not the point — the **allocation** is. 8 variations on "a founder
writes a note" would re-walk the same spine and stop finding anything after the
third.

Jotacular has five axes that select genuinely different code, and the roster is
built from them rather than from a target number:

| Axis | Values | Who covers each |
| --- | --- | --- |
| **Plan** | free · solo · family · team | P01/P02/P04/P07 free · P03 solo · P05 family · P06 team · P08 moves between all four |
| **Door** | apex hero → claim · apex → sign-in · pricing page · a blog post · iOS Shortcut token · Android share | P01 the hero jot · P02 the apex, then sign-in · P05 the pricing page · P06 a blog post · P07 Shortcut and share, never the apex |
| **Capture mode** | typed · handwriting · voice · photo | P01/P02 typed · P03 handwriting · P04 voice and photo · P07 typed from a lock screen |
| **Agent** | none · read-only · read + write · triage | P02 none · P01 read-only · P06 write and triage |
| **Device** | phone · tablet with a pencil · desktop | P02/P07 phone only · P03 iPad and Pencil · P01/P06 desktop and phone |

The **role** axis — owner versus member — is in the product's data model and in 58
green smoke checks, and **no persona can walk it, because no screen exists to
invite anybody** (issue 001). P05 exists partly to prove that from a customer's
side rather than from a grep.

## The roster

| # | Persona | Who they are | Plan | Status |
| --- | --- | --- | --- | --- |
| P01 | [Marisol Okonkwo-Vance](01-marisol-okonkwo-vance.md) | Solo founder, one dog-walking app, ideas at bad times | free | **done — all 10 acts, 2026-09-16** |
| P02 | [Hazel Trickett](02-hazel-trickett.md) | Retired school secretary, books the village hall, **no agent, ever** | free | **done — all 7 acts, 2026-09-16** |
| P03 | [Tomás Iglesias-Ferrer](03-tomas-iglesias-ferrer.md) | Architect, iPad and Pencil, writes everything by hand on site | solo | **partial — 6 of 9 acts. Needs a pencil and a vision model** |
| P04 | [Priya Raghunathan](04-priya-raghunathan.md) | Podcast producer, voice memos and photos of whiteboards | free — and runs out | **partial — both model seams are stubbed here** |
| P05 | [Kwabena Ballantyne-Osei](05-kwabena-ballantyne-osei.md) | Runs a house of six, wants everyone in one place | family | **done — the wall is real, and it counts to six** |
| P06 | [Fenn Arkwright](06-fenn-arkwright.md) | Ops at a six-person structural engineering firm | team | **partial — triage proved end to end** |
| P07 | [Dele Ajayi-Blackwood](07-dele-ajayi-blackwood.md) | Delivery driver, phone in a cradle, never opens a laptop | free | **done — both doors work. PWA install needs a phone** |
| P08 | [Ruth Feinberg-Ngata](08-ruth-feinberg-ngata.md) | Two years of notes, now deciding whether to keep paying | solo → family → cancelled | **done for the conditions — the two-year history needs backdating** |

## What each one is the only proof of

| # | Nothing else in the roster covers this |
| --- | --- |
| P01 | **The spine, deeply.** Apex → hero jot → claim → sign in → canvas → first note → agent connected, verified in the data row by row. Everyone else trusts this |
| P02 | **The product with the differentiator switched off.** She never connects an agent. If Jotacular is only good once Claude is attached, she is the one who finds out |
| P03 | **Handwriting, and the whole canvas.** Pencil pressure, arrows, stickers, text boxes, the lasso, undo, the clipboard, and whether the transcript says what the page says |
| P04 | **The two model seams nobody else opens** — speech and vision — and **the meter**. She is the only persona who deliberately runs out of recognition units |
| P05 | **The family wall.** He pays for six and finds there is nowhere to add anybody (issue 001), and he is the one who proves what that feels like rather than what it greps like |
| P06 | **The agent writing, and the triage agent.** Write tools, attribution, comments, revert, and the one feature that is Team-only and off by default |
| P07 | **The doors that are not a browser.** iOS Shortcut token, Android share target, the capture beacon when a tab closes. He never sees the marketing site at all |
| P08 | **The conditions.** Upgrade, downgrade, cancel, a limit met, a session gone stale, an export taken, and whether two years of notes can leave |

**This table is the test of the roster.** A persona with no unique line is a
duplicate.

## Run order

**P01 first, P08 last.** In between, this sequence front-loads the structurally
different spines:

`P01 → P02 → P07 → P03 → P04 → P05 → P06 → P08`

- **P01** goes first because everybody else trusts what it verifies.
- **P02** goes second on purpose. She is the negative space — no agent at all — and
  learning early that the product is thin without one is much cheaper than learning
  it after six people have connected Claude and been delighted.
- **P07** is third because his door is not the apex. If capture-from-a-Shortcut is
  broken, four later personas would have hit it anyway.
- **P03** then **P04** take the three capture modes that need the worker, biggest
  surface first.
- **P05** and **P06** are the multi-person plans, and they are late because they
  need a mature product underneath them and will spend part of their run blocked on
  issue 001.
- **P08** is last because she needs two years of somebody's notes to exist first.

Because defects are fixed inside the run that finds them, **the order also decides
who pays for what.** P01, P02 and P07 will absorb most of the shared-spine repairs;
by P05 a run should be almost entirely about its own surface. **If P06 is still
finding sign-in defects, the earlier runs did not fix what they found.** That is a
signal about the process, not about P06.

## Where this stands — 2026-09-16

**All eight personas have run.** P01, P02, P05, P07 and P08 are done for what they
prove; P03, P04 and P06 ran as far as this machine allows, and each says exactly
where it stopped. Every act, every standing check either worked or is
written down as not checked.

**P02's verdict is the one to read.** Hazel never connects an agent, and the product
is genuinely good for her anyway — she finds any of her fourteen notes in two taps
with no filing and no system to maintain. **But everything the marketing site says
is special about Jotacular is something she will never touch, including the only
stated reason to pay.** She is a free customer forever, by design. That is a
business fact rather than a defect, and it is the thing only she could show.

**Forty-five issues filed. Thirty-five are fixed and re-proved from the screen.**

| | |
| --- | --- |
| **Fixed** | 004 005 006 007 008 009 010 011 012 014 016 017 018 019 020 021 022 023 025 026 027 028 029 030 031 033 034 035 036 037 038 039 040 044 045 |
| **Open** | 001 002 003 013 015 024 032 041 042 043 |

**The last nine came from finishing the scoring, not from a persona run**, and two of
them are the widest things this exercise has found:

- [038](issues/038-the-brand-body-typeface-never-rendered-anywhere.md) — **the brand
  body typeface never rendered, on any screen.** Silica re-declares `--font-sans` in
  `@layer base`, which beats the app's `@theme` outright, so every word of body text
  in the product was the operating system's font. Headings were Nunito and the
  handwritten accent was Caveat, which is exactly why nobody saw it.
- [040](issues/040-the-app-never-got-the-rule-that-text-you-must-read-is-not-dimmed.md)
  — **the app never got a rule the marketing site got twice.** `docs/10` says text
  somebody must read is never dimmed; the site was cleaned in ADR-076 and ADR-082
  and the app kept 33 `opacity-*` rules, at 2.5:1 on paper.
- [039](issues/039-who-else-is-here-was-drawn-underneath-the-toolbar.md) — the
  presence chip was rendered, positioned, styled, announced to a screen reader, and
  **drawn underneath the toolbar** on the commonest setting.
- [037](issues/037-a-new-page-was-blank-and-said-nothing.md) — a new note was blank
  and said nothing, for anybody whose last tool was a pen.
- [044](issues/044-the-comments-drawer-sat-on-its-own-first-heading.md) and
  [045](issues/045-comment-on-this-could-not-say-what-this-was.md) are small and
  precise: a sticky header sitting on its own first heading, and a popup that could
  not name the thing it had just been asked to comment on.

### Dark mode was turned on, measured, and turned back off

Issue [002](issues/002-dark-mode-never-comes-on.md) had three parts and said part 3
— *“look at every screen in dark”* — was the real work. All three were done.

**Parts 1 and 2 are one line and one element**, and they work. Part 3 found that the
app is genuinely ready and two things around it are not:

| | light | dark |
| --- | --- | --- |
| `/dashboard`, `/account`, `/review`, `/signin` | 0 | 0 |
| `/n/[id]` — a typed note | 0 | 0 |
| `/n/[id]` — **with an object on it** | 0 | **the default pen is 1.24:1** |
| the apex | 1 | **16** |

So `data-theme="paper"` went back on. The canvas is the app, and a dark mode that
deletes handwriting is not ready, however good it is everywhere else.

- [043](issues/043-ink-stored-on-white-paper-is-invisible-on-a-dark-page.md) is the
  blocker and it is a real decision: **what happens to ink somebody stored when the
  paper was white.** Four shapes are written out; none is mine to pick.
- [041](issues/041-the-marketing-site-has-no-dark-palette-so-it-is-pinned-to-light.md)
  is the apex, whose band inks are hard-coded hexes with no dark counterpart.
- [042](issues/042-mint-as-text-on-paper-is-two-to-one.md) fell out of the same audit
  and is nothing to do with dark: **mint as text on paper is 2.04:1**, and one of the
  two places it is used is a link.

The open ones are open for a reason, not from neglect:

- [001](issues/001-nobody-can-add-anybody-to-a-space.md) and
  [013](issues/013-a-note-she-started-by-mistake-can-never-be-removed.md) are screens
  that do not exist — nobody can invite anybody, and nobody can delete a note. Both
  need a decision from Brandon before any code. **P05 walked into 001 as a paying
  customer and found something worse than an absence**
  ([032](issues/032-it-told-him-one-of-six-people-and-gave-him-no-way-to-make-it-two.md)):
  the account page prints `1 of 6 people` at a man with no way to make it two.
- [023](issues/023-eight-dead-jobs-stopped-every-drawing-being-read.md) is **closed.**
  Brandon stopped the dev server and granted the migration on 2026-09-16. It had grown
  since it was filed: **19 dead jobs were holding 323 healthy ones**, and
  `app_claim_structure_jobs(8)` returned 0 rows. After it: 19 closed with an honest
  reason, 323 freed, 8 rows claimed, and `pnpm structure:smoke` all good. **That was
  the last red suite.**
- [002](issues/002-dark-mode-never-comes-on.md),
  [003](issues/003-every-space-is-called-personal.md),
  [015](issues/015-a-sentence-on-her-phone-becomes-a-six-line-ribbon.md),
  [041](issues/041-the-marketing-site-has-no-dark-palette-so-it-is-pinned-to-light.md),
  [042](issues/042-mint-as-text-on-paper-is-two-to-one.md) and
  [043](issues/043-ink-stored-on-white-paper-is-invisible-on-a-dark-page.md) are design
  decisions. The last three all have their numbers already taken, so what is left is
  a choice rather than an investigation.
- [024](issues/024-revoked-and-wrong-address-give-the-same-sentence.md) is a nit whose
  fix requires splitting `oauth.ts`, which the root CLAUDE.md asks to be deliberate.

**013 is now the cheapest of them.** Scoring `/privacy` found that the published
policy already documents the delete — *"a note you deleted: 30 days, then purged for
good"* — so the design question that issue called "the one worth making first" has
been answered on paper for a while. What is missing is a control and a list, not a
decision.

### The four worth reading first

**[009](issues/009-she-reopened-her-note-and-five-of-its-six-lines-were-gone.md)** —
she reopened a note written three minutes earlier and five of its six lines were not
on the screen. Every suite green, the data perfect. That is the whole case for this
exercise in one defect.

**[023](issues/023-eight-dead-jobs-stopped-every-drawing-being-read.md)** — eight
dead jobs stopped every drawing on this database being read, and every dial stayed
green: no error, no retries, no alert, because queue depth is not a metric. **By the
time the migration ran it was nineteen dead jobs holding three hundred and
twenty-three healthy ones** — the silence is the defect, and it kept getting worse
while nothing said so.

**[022](issues/022-typing-on-a-page-with-a-doodle-re-billed-reading-the-doodle.md)** —
typing on a page with one doodle re-billed reading the doodle. Wrong money, on the
only thing this product meters.

**[016](issues/016-her-agent-can-search-her-notes-and-she-cannot.md)** — the ⌘K
palette did not search. It filtered 180 characters in the browser and told her a
word she had written was not in her jots, while the MCP server handed her agent
reciprocal-rank fusion over three indexes. Claude could search her notes and she
could not.

**[027](issues/027-her-export-told-her-successor-every-note-was-illegible-handwriting.md)** —
the export is the artifact somebody else reads, and it called every typed note
*"handwritten, nothing legible on it"*. The same line went to any agent through
`get_note`.

**[031](issues/031-every-photo-and-every-voice-note-failed-in-the-browser.md)** —
**two of the four capture modes the apex advertises had never worked from a browser
on this machine.** No CORS on the API, so every photo and every voice note failed the
preflight. `media:smoke`, `api:smoke` and `db:smoke` were all green, because not one
of them uses a browser. This is `verify-ui-in-a-browser` in a single defect.

**36 of 66 screens scored.** Two more were opened and deliberately left unscored,
because they were only ever seen at desktop width. The other 49 are `—`, which is
the answer to "what has nobody looked at?"

### The pattern worth naming

**Four issues are the same shape**, and it is the shape this exercise was built to
find: a complete, tested domain feature with **no product caller at all**.

| | The feature | Its only caller |
| --- | --- | --- |
| [001](issues/001-nobody-can-add-anybody-to-a-space.md) | invite, accept, roles, seats | smoke scripts |
| [013](issues/013-a-note-she-started-by-mistake-can-never-be-removed.md) | `deleteNote` | one smoke script |
| [016](issues/016-her-agent-can-search-her-notes-and-she-cannot.md) | `searchNotesAction` | nothing — the MCP server uses the domain call directly |
| [029](issues/029-the-agent-wrote-a-note-and-nothing-said-so-and-nothing-takes-it-back.md) | `listAgentChanges`, `revertRevision` | one smoke script — **now wired to `/review`** |

Every one of them is green in the suites. **A green badge over a function with no
caller is the single most reliable defect in this codebase**, and a grep for callers
outside `scripts/` would find the rest of them in an afternoon.

### What P03 could not do, and only Brandon can

`.env` has `VISION_PROVIDER=fake` and `SPEECH_PROVIDER=fake`, so every handwriting
reading and every voice transcript on this machine is a canned string. **P03's act 4
— whether a transcript can be trusted with `2.04m` rather than `2.4m` — is recorded
as `not checked`.** It is the single most important thing that persona exists to
test. **P04 is blocked the same way**, on both of its model seams.

### One thing still needs Brandon

~~**`pnpm db:migrate`**~~ — **done, 2026-09-16.** He stopped the dev server and
granted it. Migration 0038 applied, issue 023 is closed, and `structure:smoke` is
green.

1. **Backdate P01's fourteen notes.** They are all on one day. The 23:58 boundary
   check and the "search for it yesterday" check are recorded as `not checked`
   rather than passed, because a run may not write to the database.

### Where the suites stand

**45 suites. Forty pass with the servers down, including `structure`.** The other
five — `api`, `share`, `mcp`, `mcp:check`, `site` — all fail with `ECONNREFUSED`
because they fetch over HTTP and the dev server is stopped. They were green on the
last run with it up, and nothing in this session touched their code. **That is
"not run", not "passing"**, and RULE #4 is why it says so here.

## Screen coverage

The product ships **66 rateable screens** — 13 pages, 25 canvas panes, 8 account
sections, 10 apex bands and the 10 MCP tools the agent sees. Eleven more routes are
excluded and are not scored, because they are redirects, downloads and machine
endpoints.

Every one is a row in [rating.md](rating.md), generated by
`node scripts/persona-screens.mjs` so the denominator is real rather than
remembered.

8 runs will not open all 65 — nothing legitimately reaches every corner. **Those
rows stay `—`, deliberately.** An unrated screen is unrated; it is never assumed
fine because a sibling scored well (CLAUDE.md RULE #4). When the runs are done, the
remaining `—` rows are themselves the answer to "what has nobody ever looked at?"

## Coverage this roster deliberately does not have

Say these out loud rather than discovering them as gaps later.

- **Being a member of somebody else's space.** Not reachable — issue 001. So
  presence, live cursors, comments from another human and "who else is here" are
  all seen by at most one person at a time, which is not what they are for.
- **Dark mode.** Not reachable — issue 002. Every score in this exercise is a
  light-mode score and says so.
- **Real Google sign-in.** Runs use the dev sign-in (`ALLOW_DEV_LOGIN=true`). The
  Google path, its consent screen and its account linking are **not checked**.
- **Real money.** Stripe is driven in test mode. No card is charged, and the
  webhook is exercised the way the smoke suite does, not by Stripe's own retries.
- **Real recognition quality at scale.** Each persona reads its own transcripts
  with its own eyes, which is more than this repo has ever done — but 8 people's
  handwriting is not an accuracy measurement, and no run should report it as one.
- **Load.** 8 accounts is a correctness exercise, not a performance one. The only
  timing anybody records is the one the product promises: capture in under a
  second.
- **Native apps.** There are none (docs/14). Nobody tests an app store.
- **Anything a person would never do.** No persona `curl`s the capture endpoint to
  see what it returns, because no customer has ever done that.

An honest gap list is worth more than a roster that claims to cover everything.
