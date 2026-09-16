# 053 — Two years in, her oldest notes cannot be reached from any screen

**Status:** fixed
**Severity:** major
**Found by:** P08 · Ruth Feinberg-Ngata · acts 2 and 3
**Surface:** app › Dashboard › History · and canvas › ⌘K palette
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** Ruth's dashboard at 115 notes · 2026-09-16
**Blocked on:** —

## What happened

Ruth has a two-year-old account. Her space was grown to **115 notes** of her own
garden-design work — site notes, plant lists, nursery invoices — and then the two
places a person can look for a note were measured.

**The Dashboard shows 100 and stops.**

```
notes in her space        115
rows rendered             100
page height              9574px
a "load more" control      none — no control of any kind
```

There is no next page, no "older", no count, and nothing on the screen says the
list is truncated. The fifteen oldest simply are not there.

**The ⌘K palette holds 50.** Her notes carry their number, so the window is exact:

```
notes offered by the palette     50
numbered                         (56) … (105)
notes (1) to (55)                absent — typing their words finds nothing
```

**And the search she needs already exists and nothing calls it.**
`searchNotesAction` wraps the real full-text `searchNotes` and has **zero callers**
in `apps/`. The palette filters an array it loaded instead.

**The MCP tools DO call `searchNotes`.** So an agent connected to her account can
search all 115 notes. **Ruth cannot search her own.**

## What should have happened

She came here to do one thing: *"find a note from the first week."* A product sold
on two years of notes has to be able to reach the second year.

At minimum the screen should say the list is cut. Silently showing 100 of 115 is
the rulebook's *absence behaves like fine* — a truncated list renders identically
to a complete one.

## How to reproduce

Every time.

1. Give a space more than 100 notes.
2. Open `/dashboard`. Count the rows: **100**. Look for a way to the rest: none.
3. Open ⌘K on the canvas. Count the Notes group: **50**.
4. Type a word that appears only in an older note. *"Hmm — not in your jots."*

## Why it matters

This is the whole of P08. She is auditing before renewing, and the question she is
answering is whether she is locked in or safely able to leave. **A note she cannot
find is a note she has already lost**, and she will conclude it from the screen
rather than from the database.

It is also the shape this codebase produces most reliably — a finished, tested
domain capability with no product caller:

| What exists | Tested by | Called from a screen |
| --- | --- | --- |
| `nextCursor` + `ListOptions.after` — keyset pagination, ADR-063 | `smoke-changes` | **no** |
| `searchNotesAction` → `searchNotes` — real full-text search | the MCP tools use `searchNotes` | **no** |

Both are green. Neither is reachable.

## Where it lives

- [dashboard/page.tsx:16](../../../apps/web/app/dashboard/page.tsx#L16) —
  `listNotes(actor, spaceId, 100)`. A hard 100, and no cursor.
- [actions.ts:69-71](../../../apps/web/app/actions.ts#L69-L71) —
  `listNotesAction` passes `{ words: true }` and **no limit**, so it takes
  `listNotes`'s default of **50**.
- [Chrome.tsx:94](../../../apps/web/components/Chrome.tsx#L94) —
  `recent.slice(0, 100)`. **It is slicing 50 items to 100**, which does nothing and
  states an intent the data never had. The comment above it says the palette is
  reloaded each open; it does not say it only ever holds 50.
- [actions.ts:74](../../../apps/web/app/actions.ts#L74) — `searchNotesAction`,
  defined and never imported.
- [note-list.ts:38](../../../packages/domain/src/note-list.ts#L38) — `nextCursor`,
  whose only caller is a smoke script.

## The fix

**The Dashboard pages, and it says so.** `NoteHistory` is a client component that
holds the first page the server rendered plus its cursor, and grows the list when
somebody asks:

```
Show older     100 so far, and there are older ones.
```

The sentence is half the fix. A list that stops is fine; a list that stops
*silently* is the defect, because a truncated list and a complete one look the
same. The button and the sentence both disappear when `nextCursor` returns null,
so "no button" means "that is all of them" and nothing else.

`olderNotesAction` calls `listNotes(..., { limit: 50, after })` and hands back the
next cursor. **This is the first caller `nextCursor` and `ListOptions.after` have
ever had outside a smoke script** — ADR-063 built keyset paging, and until now
nothing spent it.

**The palette now holds the hundred it always claimed.** `listNotesAction` passed
no limit, so it took `listNotes`'s default of **50**, and `Chrome.tsx` then sliced
50 items to 100 — a no-op that stated an intent the data never had. It asks for 100
now.

**`searchNotesAction` is deleted.** It wrapped the real full-text `searchNotes` and
had zero callers, and it could not gain one: Silica's `CommandPalette` filters
`items` itself and exposes **no query**, so there is nowhere in the current
component to hang a server search. Leaving a dead action beside a live one is how
this class of defect keeps happening. `searchNotes` itself is untouched and is
still what the MCP `search_notes` tool calls.

**So the palette's ceiling is real and is now honest**: a hundred recent notes,
with the Dashboard as the way to everything older. That is written into the comment
above the loader rather than left for the next person to measure.

## Confirmed by

**2026-09-16, on Ruth Feinberg-Ngata's own dashboard**, her space grown to **115**
notes of real garden-design work through `createNote` — the same door every smoke
script uses, because a run may not write `created_at` and did not.

```
                     before          after
rows on first load     100             100
a way to the rest      none            "Show older · 100 so far, and there are older ones."
after one press        —               115 rows, button gone
oldest reachable       no              yes — "Site notes, Ashby Road … (2)"
```

`nextCursor` returning null is what removes the control, so the absence of a button
is itself the statement that the list is complete.

Measured on the same screen:

| | |
| --- | --- |
| light | button **15.46**, sentence **7.04** |
| dark | button **15.46**, sentence **6.64** |
| 360px | no horizontal scroll, 0 elements past the edge |

**What this does NOT fix.** Typing a word from note (2) into ⌘K still finds
nothing, because the palette searches the hundred it loaded. Reaching an old note
means the Dashboard. That is a smaller gap than it was — it used to be fifty, and
there used to be no Dashboard route at all — but it is a gap, and P08 should say so
rather than call search fixed.

## Rating effect

`Dashboard — Ease 8 → 9`, and `canvas › Chrome` keeps its 8: the palette's ceiling
is unchanged in kind, only doubled and told the truth about.
