# 013 — A note she started by mistake can never be removed

**Status:** open
**Severity:** major
**Found by:** P01 Marisol · act 5 · 2026-09-16
**Surface:** app › everywhere. There is no control for this anywhere
**Filed:** 2026-09-16
**Fixed:** —
**Confirmed by:** —
**Blocked on:** scope

## What happened

Marisol pressed **New note**, then could not write in it — that was issue 012, now
fixed. She pressed New note again and carried on.

The first one is still there. It is empty, it is called `Untitled`, it sits at the
top of her Dashboard's History and in her ⌘K palette, and **there is nothing
anywhere in the product that removes it.**

Her space is meant to be fourteen notes. It is fifteen, and the fifteenth is
nothing at all.

## What should have happened

A note she did not mean to make can be thrown away.

## How to reproduce

1. Sign in at `http://localhost:3400`.
2. ⌘K › **New note**. Write nothing.
3. Look for a way to delete it. Check the Dashboard, the ⌘K palette, the canvas
   right-click menu, and `/account`.

There is none. The canvas menu's `Delete` removes the **selected objects on the
page** — a stroke, a box, a photo — not the note. Every time.

## Why it matters

**`New note` creates the note immediately**, before a single word is typed, so
changing your mind is not free. Every abandoned tap is a permanent row in the two
lists she uses to find things. Marisol works one-handed in a car and will do this
often.

It also compounds issue 008 in the one case 008 cannot repair: an empty note has no
words to take a name from, so it is `Untitled` forever and by definition.

And it is the *screen over a dead function* shape from the rulebook, in its purest
form — the same shape as issue 001:

```
packages/domain/src/note-list.ts:85   export async function deleteNote(...)
```

`deleteNote` is written, it soft-deletes, it writes an audit row, and **its only
caller in the entire repository is `apps/worker/scripts/smoke-triage.ts:192`.**
Nothing in `apps/web`, `apps/api` or `apps/mcp` calls it. There is no server
action, no route, no MCP tool and no button. `pnpm triage:smoke` is green and
proves it works.

## Where it lives

- `packages/domain/src/note-list.ts:85` — `deleteNote`, with no product caller
- `packages/db/src/schema/content.ts` — `notes.deletedAt` **and** `notes.archivedAt`.
  Nothing writes `archivedAt` at all, from anywhere
- `apps/web/components/CanvasMenuItems.tsx:143` — the `Delete` that is about objects
- `apps/web/app/dashboard/page.tsx` — History rows are links and nothing else

## The privacy policy already describes the delete that does not exist

Found while scoring `/privacy`, and it raises this from a gap to a contradiction.
The published policy carries a retention table:

| What | Kept for |
| --- | --- |
| **A note you deleted** | **30 days, then purged for good** |

and a paragraph headed *"Taking it with you, and deleting it"*:

> **Deletion means deletion.** Deleting a space removes its stored files, not only
> the rows that point at them. After the 30-day window a deleted note is gone and we
> cannot recover it for you.

**There is no way to delete a note, and no way to delete a space.** So the policy
documents the lifecycle of an action nobody can perform, in the one document a
customer is most entitled to read literally.

It also answers the open question below. The policy has already decided: a deleted
note is recoverable for 30 days and purged after. So the design is settled on paper
— what is missing is the control and the screen that shows the 30 days.

## The fix

Not attempted. `Blocked on: scope`, for the same reason as issue 001: this is a
control that does not exist rather than a repair to one that does, and the shape of
it is a product decision, not a code decision.

**The decision is where it goes**, and there are two honest answers:

**Option A — on the Dashboard's History rows.** Cheapest and most obvious. Each row
gains a remove control; `deleteNote` is already a soft delete so nothing is
destroyed. Fits the page's existing shape and needs one server action.

**Option B — in the ⌘K palette and the canvas menu, as "Delete this note".** Puts it
where she already is when she realises, rather than making her navigate to a list to
throw away the thing in front of her. Needs care in the canvas menu, which already
has a `Delete` meaning something else — the two would have to be worded apart.

**The question underneath both is already answered**, which is what the privacy
section above changes. `deleteNote` sets `deleted_at` and every query filters on
`IS NULL`, so today a deleted note is invisible and unrecoverable from inside the
product — but the published policy says it is kept **30 days, then purged for good**.

So the shape is settled: a delete is reversible for 30 days, and somewhere has to
show her the notes in that window. **What is missing is not a decision, it is a
control and a list.** That is a smaller piece of work than this issue originally
implied, and it is why 013 is now the cheapest of the open ones to close.

**A cheaper partial fix exists and is worth considering on its own:** do not create
the note until there is something in it. `New note` could open an unsaved canvas and
write the row on the first character, the way the hero already treats an anonymous
jot. That removes the commonest cause of this without answering the delete question
at all.

## Confirmed by

—

## Rating effect

None yet. It is part of the gap to 10 on `Dashboard` and on the ⌘K palette, and both
are noted there.
