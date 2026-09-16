# NNN — What the person could not do, in their words

**Status:** open
**Severity:** blocker · major · minor · design · copy
**Found by:** P0N · Person Name · act N
**Surface:** app › canvas › Handwriting transcript
**Filed:** YYYY-MM-DD
**Fixed:** —
**Confirmed by:** —
**Blocked on:** — (pipeline · decision · scope, only if the fix could not be made now)

Title it the way they would say it — "Tomás wrote a page and nothing came back",
not "HTR job never enqueued on ink block commit". The mechanism goes in **Where it
lives**.

## What happened

What you saw, in the order you saw it. **Quote the exact words on screen** — the
sentence is often the defect.

## What should have happened

What this person had every reason to expect. If the expectation comes from a rule,
a doc or a sentence on the marketing site, name it and quote it.

## How to reproduce

1. Numbered, from the apex (or from a signed-in session, if it starts later).
2. **Include the data** — the actual note text, the actual space, the actual word
   searched for.
3. Say how reliably it happens: every time, or once in five. For anything the
   worker touches, say how long you waited before calling it a failure.

## Why it matters

Who is hurt and how. "A thought was lost", "they could not finish the job", "the
count is wrong and the count is the business model", "it says something false". If
it is cosmetic, say that plainly rather than inflating it.

## Where it lives

Files and lines. **Leave blank rather than guessing** — a wrong pointer costs more
than no pointer.

## The fix

What changed and in which files. Fix it where it propagates, not at the call site.
**If the same defect could exist on a sibling surface, say whether you checked** —
this product renders the same note through the canvas, the MCP `view_note` tool,
the SVG renderer and the export, and a rule fixed in one of four is the classic
shape here.

## Confirmed by

**Required before `Status: fixed`.** The step re-run as the person, on the screen,
with the same data, and what you saw:

> Re-ran P03 act 4. Wrote the same page on the iPad, waited for the worker, opened
> the transcript — it read "site meeting Thurs, Ferreira's boundary wall" against a
> page that said the same thing.

A typecheck, a smoke script or a `fetch` is not a confirmation.

If the fix touched the shared spine, add a **second** confirmation line naming the
earlier persona you reopened and the real job you did there (RULE #7).

## Rating effect

If this moved a screen's score, record it here and in [rating.md](../rating.md):
`Account › Plan and usage — Ease 4 → 8`.
