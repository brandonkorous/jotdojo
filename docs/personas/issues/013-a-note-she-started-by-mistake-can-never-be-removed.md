# 013 — A note she started by mistake can never be removed

**Status:** fixed
**Severity:** major
**Found by:** P01 Marisol · act 5 · 2026-09-16
**Surface:** app › everywhere. There is no control for this anywhere
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** `undelete:smoke` 14/14, and the dashboard · 2026-09-16
**Blocked on:** —

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

---

## Fixed, 2026-09-16 — Option A, and the list the policy already promised

Brandon took this off the blocked list. This issue had already worked out that the
decision was made: `deleteNote` soft-deletes, docs/13 promises **30 days then a
purge**, so *"what is missing is not a decision, it is a control and a list."* Both
now exist.

**The control — Option A, on the Dashboard's History rows.** Each row gains
`Remove`, which **asks before it acts**:

> Throw this away?  **Remove**  **Keep**

`Keep` rather than `Cancel`, because it says what happens rather than what does not
— the same word Account's *Disconnect Marisol's Claude?* already settled on. A list
row is an easy thing to hit by accident, which is why a one-tap delete on one would
have been the wrong shape.

**The list — *Thrown away*.** A section that appears only when there is something in
it, saying plainly:

> Kept for 30 days, then gone for good. Put one back any time before that.

Each row shows the title, its first words and when it went, with **Put it back**.
The 30 is `DELETED_DAYS`, exported from the domain, so the sentence cannot drift
from the query that enforces it.

**Two new domain functions**, in `note-list.ts` beside `deleteNote`:

- `listDeletedNotes(actor, spaceId)` — what is still inside the window, newest
  first, each with the same first-words preview the live list uses. Without the
  preview a bin of *Untitled* rows is not a list anybody can act on.
- `restoreNote(actor, noteId)` — which **refuses a note that was never deleted**,
  so the button cannot quietly do nothing.

`actions.ts` reached 253 lines taking these, so it split on the seam they revealed:
`dashboard-actions.ts` is what the dashboard does to a **list** — the only place
somebody acts on something they are not looking at.

## The cheaper partial fix was NOT taken

This issue also floated *"do not create the note until there is something in it"*.
It is deliberately not done. It would remove the commonest cause and leave the
person who deliberately writes something and then wants it gone with nothing — and
that person is the one the privacy policy is making a promise to.

## Confirmed by

**2026-09-16.** `pnpm undelete:smoke`, a new suite — **14 of 14**:

```
ok    the window is the thirty days the policy promises
ok    a deleted note leaves the list
ok    ...and the one she meant to keep is still there
ok    ...and it is in the bin, with its words so she can tell which it was
ok    the note itself is not reachable while deleted
ok    restoring puts it back in the list
ok    ...and takes it out of the bin
ok    ...and it opens again
ok    restoring a note that was never deleted is refused
ok    a stranger's view of somebody else's bin is EMPTY, not an error
ok    ...nor restore out of it
ok    ...and it is still in the owner's bin
```

**The isolation check changed the code's mind rather than the other way round.** It
was written expecting a stranger to be REFUSED, and a stranger gets an empty list
instead — RLS answers it. Empty is the better answer, because it does not tell a
stranger whether the space exists, and it is the same shape `listNotes` already has.
The assertion was corrected to what is true and safe, not the code to what the test
guessed.

**And driven on the real dashboard**, on a real note, both ways round:

```
click Remove          -> "Throw this away?  Remove  Keep"      it asks first
confirm               -> History reads "Nothing here yet."
                      -> "Thrown away" appears, saying 30 days
click "Put it back"   -> the bin disappears, the note is in History again
```

Checked in the database afterwards: `deleted_at` is null and the note is whole.

## Rating effect

`Dashboard` scored 7 / 6 → 7 with this as a named gap. Re-scored in
[rating.md](../rating.md).
