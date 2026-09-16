# 030 — A capture that was merely waiting was reported as unreadable

**Status:** fixed
**Severity:** major
**Found by:** P04 Priya · acts 5 and 6 · 2026-09-16
**Surface:** MCP › `get_note` · Account › Export · canvas › the transcript chip
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P04 Priya · 2026-09-16
**Blocked on:** —

## What happened

P04 exists to cross the free allowance on purpose, and her deliverable names the
line that matters more than any other in her run — docs/01:

> Capture still works, recognition queues until next cycle, and **we say so
> plainly. We never refuse a capture.**

**The first half is kept, carefully.** The second half was not said at all — what was
said instead was the opposite.

When a space is over its allowance, `app_claim_recognize_jobs` marks the block
`transcript_state = 'deferred'`, pushes the job to the start of next month and
**decrements `attempts`** so a deferral does not count as a failure. The artifact is
untouched. That is a well-made piece of work.

Then `renderBlock` looked at the block, found no transcript, and said:

> `_[from a voice note, nothing legible on it]_`

Her forty-minute interview. Reported to her agent, and written into her export, as
**unreadable** — when in truth it had not been read yet and would be next month.

## The measurement

The word `deferred` appeared in exactly two places in this repository: the database
function that sets it, and three smoke scripts that assert it. **Nothing in
`packages/domain/src/render.ts` and nothing in `apps/web` handled it.**

```
transcript_state | count
ready            |  6748
pending          |   274
deferred         |    76
failed           |    60
```

**Seventy-six blocks in this database were already in that state**, and every one of
them was being described as having nothing legible on it.

## Why it matters

**It is the exact sentence docs/01 promises never to say**, in the exact situation it
promises never to say it. A person who has just hit a limit, and who was told her
capture was safe, is then shown the word *nothing* against the thing she captured.

**It reaches an agent.** `renderBlock` is what MCP's `get_note` returns. An assistant
asked about that interview reports that the tape has nothing legible on it, which is
worse than not answering: it is a confident wrong answer about whether her work
exists.

**And it lands on the person least able to absorb it.** Priya's stated fear is losing
a line somebody said. Her whole job is that the good sentence was captured. The one
moment the product tells her it was not is the moment she is over her allowance and
being asked to pay.

It is the same shape as issue 027 — a state the renderer had no branch for, falling
through to a sentence that is false — and it is the third time a *missing* fact has
been reported as a *negative* one.

## What was already right

`PlanSection.tsx` says the true thing, on the account page:

> You have used this month's reading. **Everything still saves**, and what is waiting
> gets read when the month turns over.

So the promise was written, correctly, in one place — and every other place that
could have repeated it said the opposite instead.

## The fix

**`renderBlock` gained the missing branch**, between `failed` and the
nothing-legible fallback:

```ts
// Waiting for the month to turn over, not unreadable. Without this a capture
// made after the allowance ran out was reported as "nothing legible on it",
// which is the one thing docs/01 promises never to say. Issue 030.
if (b.transcriptState === "deferred") {
  return `_[${label}, saved but not read yet. This month's reading is used up;`
    + ` it gets read when the month turns over.]_`;
}
```

It reuses `label`, so it says **"handwritten"**, **"from a photo"** or **"from a
voice note"** — the customer's words, not `ink`/`image`/`audio`.

**The canvas chip gained it too.** It was not lying — it fell through to *"This page
has not been read"*, which is true — but it did not say why or when, and to somebody
who has just hit a limit a bare negative reads as a failure:

```tsx
// The allowance ran out, not the page. Same promise the account page makes,
// said where she is rather than where the billing is. Issue 030.
if (ink.transcriptState === "deferred") {
  return { ...base, line: "Saved. It gets read when the month turns over" };
}
```

**"Saved" is the first word on purpose.** It is the one thing she needs before
anything else.

## Confirmed by

**P04 Priya, 2026-09-16.** Rendered through the real `renderBlock`:

```
ink deferred   : _[handwritten, saved but not read yet. This month's reading is
                  used up; it gets read when the month turns over.]_
audio deferred : _[from a voice note, saved but not read yet. This month's reading
                  is used up; it gets read when the month turns over.]_
untouched ink  : ""
```

The third line is issue 027 still holding. Seven suites green — `metering reread
render mcp export view api` — and typecheck clean across all thirteen packages.

## The promise itself: kept

Checked separately, because it is the `blocker` P04 was told to look for.

**Nothing refuses a capture.** There is no quota check anywhere on any write path —
`assertAgentMayWrite` is about plans, not about the allowance, and no capture route
consults `app_space_over_quota`. The only thing quota changes is whether the
*reading* happens now or next month.

**An `anon` space proves it structurally.** `app_plan_allowance('anon')` returns
**0**, so every anonymous draft is over quota from the instant it exists — and the
marketing hero writes to one of those, successfully, which P01 proved in act 2 and
P02 proved again today. **The product's most-used capture path runs permanently over
quota and has never refused anything.**

## What was NOT checked

- **Crossing the line at 99, 100 and 101 with her own captures.** Not reachable here:
  `SPEECH_PROVIDER=fake` and `VISION_PROVIDER=fake` make every capture cost the
  minimum one unit, and one surface is capped at 8 units (`MAX_TILES / TILES_PER_UNIT`).
  Reaching 100 by hand would take a hundred captures. **The exact screen at 99, 100
  and 101 is `not checked`** — and it is the one thing act 5 asked for.
- **Whether she is warned before rather than after.** Same reason. `PlanSection`
  shows `trouble()` only once `over` is true, so on reading the code the answer looks
  like *after* — but that is reasoned, not measured, and is recorded as such.

## Rating effect

`Account › Plan and usage` keeps 8/8; its own sentence was always right. The gap is
named on `canvas › InkTranscript`, which is where the wrong sentence appeared.
