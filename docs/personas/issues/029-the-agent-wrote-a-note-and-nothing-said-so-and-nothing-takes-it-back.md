# 029 — The agent wrote a note, nothing said so, and nothing takes it back

**Status:** fixed
**Severity:** blocker
**Found by:** P03 Tomás · act 8 · 2026-09-16
**Surface:** app › What agents did (`/review`) — a screen that did not exist
**Filed:** 2026-09-16
**Fixed:** 2026-09-16 — Option A, the review inbox
**Confirmed by:** P03 Tomás · 2026-09-16
**Blocked on:** —

## What happened

Tomás moved his space to Solo — £5 a month, bought for exactly one reason: so his
agent can write as well as read. Then he asked it to add a note, and it did:

```
create_note → Created note 5b244983-5995-4756-944e-f223d8e29828.
```

He opened the note. It says **`infiltration test booked for the 14th`**, in plain
black spine text, in the same place and the same colour as every word he has ever
typed himself.

**Nothing on the screen says an agent wrote it. Nothing offers to take it back.**

## What was promised, in three places

**On the consent screen he had just used**, in the line directly under the Allow
button:

> You can revoke this at any time from Account. **Nothing an agent does to your notes
> is permanent.**

**In `docs/11-copy-and-tone.md`**, which specifies the format down to the separator:

> Every agent-authored element is labelled. Format:
> `Claude · via MCP · 2h ago`
>
> In the review inbox:
> `Claude appended 2 blocks to "Napkin idea".`
> `[ Keep ]  [ Revert ]`

**In `design.md` §11**, which makes violet mean agent and nothing else.

None of the three is true of a note an agent wrote.

## The proof that this is a missing door and not a missing feature

```
packages/domain/src/review.ts:39   export async function listAgentChanges(...)
packages/domain/src/review.ts:94   export async function revertRevision(...)
```

**Every caller of both is `packages/domain/scripts/smoke-review.ts`.** Nothing in
`apps/web`, `apps/api` or `apps/mcp` calls either one.

`pnpm review:smoke` is green. It proves the inbox lists an agent's changes, that an
agent cannot list or revert them itself, that a stranger sees nothing, that a revert
restores the previous revision, and that reverting twice is refused. All of it
works. None of it is reachable.

This is the third time this exercise has found the same shape — issue 001 (nobody
can invite anybody), issue 013 (nothing deletes a note) — and it is the worst of the
three, because the other two are absent features and **this one is a promise made on
the highest-consequence screen in the product.**

## What makes it sharp: the other half is built, and built well

An agent **comment** is handled exactly as the documents describe. The same agent, in
the same minute, on the same page:

```
comment_on_note → Comment added to note 8f76a4c1… at 2026-09-16T10:56:39Z.
```

and the canvas answered with a **violet dot on the comments button** and a chip along
the bottom edge reading:

> ● **Your agent left a remark**

Violet for agent, per design.md §11. Attributed, visible, unmistakable, and `open`
comments are filtered by `authorType === "agent"` in `RemarksFeed.tsx`.

**So Jotacular knows how to show an agent's work. It does it for the thing an agent
says and not for the thing an agent writes** — and writing is the half that is sold
for money.

## Why it matters

**It is the reason to pay.** Free reads, paid writes (ADR-042, docs/01 calls it the
most important decision it contains). Tomás's entire £5 buys agent writes, and agent
writes are the one thing the product does not account for.

**It breaks the bargain the consent screen makes.** A person clicks Allow because
they have been told the agent's work is labelled and reversible. If they later find a
sentence in their notes they do not remember writing, they cannot tell whether they
wrote it, and they cannot undo it.

**For Tomás it is worse than for most.** He is afraid of one thing — getting a
dimension wrong, `2.4m` where he meant `2.04m`. An unattributed sentence in his own
notes, in his own voice, is the exact shape of the mistake that cost him a week.

## Where it lives

- `packages/domain/src/review.ts` — the whole feature, with no product caller
- `apps/web/components/RemarksFeed.tsx` — how it is done correctly for comments
- `apps/web/app/n/[id]/page.tsx`, `apps/web/app/dashboard/page.tsx` — where a note is
  drawn, with no notion of who wrote it
- `notes.createdBy` exists on the schema; `note_revisions` carries the attribution
  that `listAgentChanges` reads

## The fix — Option A, built

**`/review`, reachable from the ⌘K palette as "What agents did".**

It was taken rather than left as a decision because the shape was not actually open:
docs/11 specifies the copy, design.md §11 specifies the colour, and
`listAgentChanges` returns precisely the fields a row needs. What was missing was a
page, not an answer.

Four small files, none near the size limit:

| | |
| --- | --- |
| `apps/web/app/review/page.tsx` | 38 lines — every space, not one, because "what has this thing been doing" is not a question anybody asks a space at a time |
| `apps/web/components/ReviewList.tsx` | 92 lines — the rows, the violet mark, Open and Revert |
| `apps/web/app/actions/review.ts` | 35 lines — split out because `actions.ts` was already at 236 |
| `apps/web/components/Chrome.tsx` | one palette entry, with `agent`, `claude`, `revert`, `undo` as keywords |

**The copy is docs/11's**, near enough word for word:

> ● **Marisol's Claude wrote "infiltration test booked for the 14th".**
> via MCP · 6 hours ago                                    Open · Revert

Flat and factual. It reports the thing that happened and never guesses at why.

Three choices worth naming:

- **Whole words for the time.** `2h ago` is a developer's shorthand; this says *6
  hours ago*.
- **A reverted row stays in the list**, reading `Taken back`. The domain comment
  asks for this and gives the reason: *"a review inbox that hides what you already
  dealt with cannot answer 'what has this agent been doing', which is the question
  that matters after something goes wrong."*
- **The empty state says what will appear**, rather than that nothing has: *"When an
  agent writes a note or adds to one, it appears here with a way to take it back."*

## Confirmed by

**P03 Tomás, 2026-09-16.** His agent's note from act 8, listed and then reverted from
the screen. The history afterwards:

```
 revision | author_type | summary                   | reverted
        1 | agent       | created                   | t
        2 | user        | reverted an agent change  | f
```

**Append-only, exactly as ADR-037 requires** — the agent's write is marked taken
back, a second revision records that a person did it, and the note's body is back to
what it was. Five suites green afterwards: `review changes mcp api db`. Typecheck and
lint clean.

## The other shape, not taken

**Option B — mark it where it is.** An agent-authored note would carry a violet mark
in the Dashboard, in the palette and on the note itself, with `Revert` in the canvas
menu. No new screen, and it puts the fact where the person meets it. Weaker on its
own for appends, where the agent's words sit inside a note the person also wrote —
which is why A was built first.

**They are not exclusive, and B is still worth doing.** A person who opens a note
an agent touched still sees nothing on the note itself — they have to already
suspect, and go to `/review`, to find out. A violet mark on the note and a `Revert`
in the canvas menu would close that, and is left for Brandon.

## Rating effect

**A new screen**, `/review`, scored 8/8 in [rating.md](../rating.md). The denominator
moves from 65 to 66 — regenerate it with `node scripts/persona-screens.mjs` rather
than trusting this line.
