# 008 — Every note she writes on the canvas is called "Untitled"

**Status:** fixed
**Severity:** major
**Found by:** P01 Marisol · act 5 · 2026-09-16
**Surface:** app › Dashboard › History · app › the ⌘K palette › NOTES
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P01 Marisol · act 5 · 2026-09-16
**Blocked on:** —

## What happened

Marisol made her second note from the ⌘K palette and typed into it on the canvas.
Then she opened the Dashboard to check it had landed:

```
History
Untitled
Nia's mum asked about the 6am slot again — third person this month. morning tier?
9/16/2026, 2:31:56 AM
route planner should assume the walker knows the roads better than the …
route planner should assume the walker knows the roads better than the map does
9/16/2026, 2:04:53 AM
```

Note 1 — the one she jotted in the hero before she had an account — has a name
taken from its first line. **Note 2, which she typed herself, is called
`Untitled`.** The ⌘K palette says the same thing.

She is going to write fourteen of these. Twelve of them would have been headed
`Untitled`.

## What should have happened

A note is named after the first line of what is in it. That is what
`inferTitle` does and it is what happened to note 1.

## How to reproduce

1. Sign in at `http://localhost:3400`.
2. ⌘K › **New note**, or ⌘N.
3. ⊕ › **A note on the canvas**, tap the page, type a sentence, press Escape.
4. Open the Dashboard, or ⌘K.

The new note is `Untitled`. Every time.

## How widespread it was

Counted read-only across the whole local database — notes that have words on their
canvas and are still nameless:

```
untitled | total
      66 |   144
```

**Sixty-six of the hundred and forty-four.** The seventy-eight that escaped it did
so because they also had text in the typed spine, which is a different write path.

## Why it matters

`major` rather than `blocker` for one reason: both lists print the note's first
line underneath the heading, so she can still tell her notes apart by reading the
grey line. She is not locked out of anything.

It is still bad. Two lists — the Dashboard's History and the ⌘K palette, which are
the only two ways to see what you have — become a column of the same word repeated
down the page. The product's own answer to "where is that thing I wrote" is a list
of fourteen identical headings.

It also reaches an agent. `NoteSummary.title` is what an MCP client is handed when
it lists notes, so every note Marisol connects Claude to in act 7 announces itself
as `Untitled`.

## Where it lives

`packages/domain/src/ink-text-block.ts`, in `syncTextBlock`. It writes the
searchable companion row and queues the embedding, and stops.

Its own doc comment names four things that row is supposed to make work:

> *text living only in jsonb is invisible to lexical search, to embeddings, to
> `inferTitle` and to `renderBlock`. A companion row makes all four work with no
> new paths at all.*

Three of the four are true. **`inferTitle` is never called on this path at all.**
`notes.title` is only ever written by `createNote` and `saveBody` in
`packages/domain/src/notes.ts`, and both of those take their text from the typed
SPINE — the block at position 0 with no `artifact_id`. A note started on the canvas
has an empty spine forever, so its title stays null forever.

This is the *fix leaves its neighbour behind* shape from the rulebook, with the
comment as the tell: the sentence describing the behaviour was written, and one
quarter of it was never implemented.

## The fix

`syncTextBlock` now names the note, at the one point every canvas text change
already passes through — it has exactly one caller, `ink-apply.ts:93`.

```ts
async function nameFromPage(tx: Tx, noteId: string, body: string): Promise<void> {
  const spine = await tx.select({ body: blocks.body }).from(blocks)
    .where(and(eq(blocks.noteId, noteId), eq(blocks.kind, "text"), isNull(blocks.artifactId)))
    .orderBy(blocks.position).limit(1);
  if (spine[0]?.body?.trim()) return;

  await tx.update(notes).set({ title: inferTitle(body) })
    .where(and(eq(notes.id, noteId), ne(notes.titleSource, "user")));
}
```

Two guards, and both are the point:

- **The typed spine wins when it has any words.** `saveBody` renames from the spine
  on every save, so without this check a note with both a spine and a canvas box
  would have two writers fighting over one column.
- **`title_source = 'user'` is never touched.** A name somebody chose is not
  something to recompute, which is the rule `saveBody` already follows.

It recomputes rather than filling in a blank once, so editing the first line of a
canvas note renames it — the same behaviour typed notes have always had.

**No migration, deliberately.** The sixty-six existing nameless notes are named the
next time their canvas text is edited. A backfill would need a migration, and
migrations are Brandon's to run; this repairs itself without one.

## Confirmed by

**P01 Marisol, act 5, 2026-09-16.** Her note 2 touched once on the canvas — one
space typed and deleted — and the Dashboard read back from the screen:

```
History
Nia's mum asked about the 6am slot again — third person this month. mor…
Nia's mum asked about the 6am slot again — third person this month. morning tier?
```

`Untitled` is gone. Note 1's title is unchanged, which is the spine guard working.

## Rating effect

`Dashboard` Ease 6 → 7. The remaining gap to 10 is issue 003 (one badge called
`Personal` that cannot be renamed) and issue 001 (nothing to click on it).
