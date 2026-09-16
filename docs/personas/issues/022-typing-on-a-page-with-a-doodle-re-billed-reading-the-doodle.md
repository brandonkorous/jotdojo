# 022 — Typing on a page with a doodle re-billed reading the doodle

**Status:** fixed
**Severity:** major
**Found by:** P01 Marisol · act 10 · 2026-09-16
**Surface:** worker › recognition metering · app › A note (the canvas)
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P01 Marisol · act 10 · 2026-09-16
**Blocked on:** —

## What happened

Act 10 is a hand count against the meter. Marisol typed all fourteen of her notes
and drew nothing, so her honest total is **zero of 100**.

`/account` said **3 of 100 read this month**.

The three are explicable — a single stray pen dot left on a scratch note during
testing. What is not explicable is that **one dot was charged three times**, on the
same block:

```
kind | units | block_id                             | created_at
ink  |     1 | 64f5f27b-ac3b-47bf-b466-7b291da337c5 | 09:47:30
ink  |     1 | 64f5f27b-ac3b-47bf-b466-7b291da337c5 | 09:49:30
ink  |     1 | 64f5f27b-ac3b-47bf-b466-7b291da337c5 | 10:05:—
```

Nobody drew between those times. What happened between them was **typing**.

## The cause

`applyInkDelta` asks for a fresh reading of the page on every delta, whatever moved:

```ts
const next = nextPage(row, parts);
const version = await store(tx, row, next);
await markPageChanged(tx, { blockId, noteId: row.noteId }, next.strokes.length > 0);
```

`next.strokes.length > 0` asks *"is there ink on this page"*, not *"did the ink
change"*. A page with one dot on it answers yes forever. So every text delta —
every pause in typing — queues another recognition of handwriting nobody touched,
and a recognition is metered whether or not it had anything new to look at.

**The line above it already knew better.** `store` is careful to re-index only what
moved:

```ts
const texts = changed(row.texts, next.texts);
...
if (texts || links || stickers) await syncTextBlock(...);
```

And `ink-recognition.ts` states the principle it broke, in a comment about cost:

> *Recognition is a VLM call over the whole page, so firing one per two-second batch
> would mean forty calls for a page someone spent two minutes writing — thirty-nine
> of them reading an unfinished drawing, and all forty billed.*

The thirty-second quiet period protects against a burst of **strokes**. Nothing
protected against text, and text is what people do for hours.

## Why it matters

**Wrong money, on the only thing this product meters.** docs/01 calls model calls
the cost of goods and makes the allowance the lever that keeps Solo margins viable.
Every one of these is a real VLM call against a real bill as well as against her
hundred.

The realistic case is worse than Marisol's. A page with one sketch and an afternoon
of notes typed around it costs a fresh reading of that sketch **every time the typist
pauses for thirty seconds**. Somebody working that way could spend a free month's
allowance on a single page, and the account screen would be truthfully reporting a
number nobody can explain.

It also poisons this exercise's own act 10: the persona's clean "zero of 100"
comparison could not be made, because the meter had counted something real.

## Where it lives

- `packages/domain/src/ink-delta.ts` — `applyInkDelta`
- `packages/domain/src/ink-recognition.ts` — `markPageChanged`, which queues both the
  transcript and the structural read
- `packages/domain/src/ink-apply.ts` — `changed`, which already existed and answers
  exactly the right question

## The fix

Ask whether the handwriting moved, using the comparison `store` already uses:

```ts
// Only when the HANDWRITING moved. Typing a note onto a page that happens
// to have a doodle on it used to queue a fresh reading of the doodle, and a
// recognition is billed whether or not it had anything new to look at.
// Issue 022.
const inkMoved = changed(row.strokes, next.strokes);
await markPageChanged(tx, { blockId, noteId: row.noteId },
  inkMoved && next.strokes.length > 0);
```

`changed` became exported, with a comment saying why the two callers are the same
question: *what to re-read, and what to BILL for re-reading.*

**`markPageChanged` still bumps `notes.updatedAt` on every delta**, which is what
the note list and the change feed sort on. Only the two model calls are skipped.

**`replacePage` in `ink.ts` is deliberately untouched.** It overwrites the whole page
without reading what was there — its comment explains that reading it would mean
pulling a page of handwriting across the wire to throw away — so it cannot compare,
and a whole-page replace is a real change anyway.

## Confirmed by

**P01 Marisol, act 10, 2026-09-16.** On the same note, with the same pen dot still
on it, a text box added through ⊕ and a sentence typed into it:

| | Before typing | After typing |
| --- | --- | --- |
| `block.recognize` queued for that block | 0 | **0** |
| `block.structure` queued for that block | 0 | **0** |
| the text itself | — | **saved** |

Nothing was queued and nothing was billed. Twelve smoke suites green afterwards —
`ink canvas recognize objects metering arrows stickers links history merge live`
— and `structure`, which is red for issue 023 and was red before this change.

## And the act 10 result, since this is where it was found

With the stray dot accounted for, the meter is honest:

| | |
| --- | --- |
| Hand count of her own captures | **0** — fourteen typed notes, no handwriting, no photos, no audio, no triage |
| `recognition_usage` rows in her space | **3**, all one test dot, all one block |
| What `/account` shows | **3 of 100 read this month** |

**The screen and the database agree exactly.** Plans and prices match
docs/01 line for line — Solo $5/1,000, Family $9/2,000, Team $19/10,000, free 100 —
and `app_plan_allowance` returns those same numbers.

## Rating effect

`Account › What you are on` scores 8/8 in act 10. The number it prints was wrong
because of what fed it, never because of what it did with it.
