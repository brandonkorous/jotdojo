# 016 — Her agent can search her notes properly and she cannot

**Status:** fixed
**Severity:** major
**Found by:** P01 Marisol · act 6 · 2026-09-16
**Surface:** app › the ⌘K palette › search
**Filed:** 2026-09-16
**Fixed:** 2026-09-16 — Option A
**Confirmed by:** P01 Marisol · act 6 · 2026-09-16
**Blocked on:** —

## What happened

Act 6 is one job: three days later she wants the lay-by idea back and does not
remember the words. The persona names the three she would reach for — **map**,
**leads**, **raining**.

She typed `raining`. The palette said:

> **Hmm — not in your jots.**

It is in her jots. It is note 6, she wrote it an hour ago, and the word `raining`
is sitting in the middle of it.

She tried `leads` and got it on the second attempt.

## What should have happened

Any word she actually wrote finds the note she wrote it in.

## The cause, measured

The palette does not search. It **filters a preloaded list in the browser** over
each item's label and description — the note's title and its `preview`. `previewOf`
is `body.replace(/\s+/g," ").trim().slice(0, 180)`.

**So the last character the palette can see is number 180.** Note 6 is 287
characters long:

| Word | Position | Found |
| --- | --- | --- |
| `leads` | 169 | **yes** |
| `raining` | 199 | no |
| `competitor` | 218 | no |
| `map` | 241 | no |
| `sentence` | 279 | no |

The cut is exact and it is not a ranking quirk. Everything before 180 is findable
and everything after it is invisible.

## The part that makes it `major` rather than `minor`

**A real search exists, is excellent, is tested, and the web app does not call it.**

`packages/domain/src/search.ts` exports `searchNotes`: reciprocal-rank fusion over
three independently ranked lists — Postgres full text, trigram for typos, and
pgvector embeddings — with date windowing and RLS enforced. `pnpm search:smoke`
proves it finds a note by a word in the middle, survives a misspelling
(`kubernets`), and refuses another customer's space.

Read directly against her space, it finds note 6 by `raining` in one statement:

```
SELECT ... WHERE b.searchable @@ plainto_tsquery('english','raining');
739444fa-d480-4e84-b83f-fb93e316271b | the whole difference is that a walker do...
```

Who calls it today:

| Caller | |
| --- | --- |
| `apps/mcp/src/tools-read.ts:37` | **her agent** |
| eleven smoke scripts | the suites |
| `apps/web/app/actions.ts:71` — `searchNotesAction` | **nothing calls this action** |

The server action is written, exported and wired to the right space. Nothing in
`apps/web` imports it. So **Claude can search her notes properly and she cannot**,
in a product sold on being the notebook her agent can read.

## And the empty state asserts something false

> **Hmm — not in your jots.**

That is a statement about her notes, made by something that looked at the first 180
characters of the hundred most recent. It is the rulebook's RULE #4 failure written
into the UI: absence presented as measurement.

For this customer it is the worst sentence in the product. Marisol came here
because she had a thought at 70mph and could not find where she put it. Being told
her idea is not there, by an app that did not really look, is the exact experience
she is paying to never have again.

## Where it lives

- `apps/web/components/Chrome.tsx` — builds `items` from `listNotesAction`, with
  `description: n.preview`, and hands them to `CommandPalette`
- `apps/web/app/actions.ts:71` — `searchNotesAction`, with no caller
- `packages/domain/src/note-body.ts` — `previewOf`, the 180-character cut
- `@wizeworks/silicaui-react` › `CommandPalette` — filters internally

The author already knew, and wrote the intended fix in a comment above the effect:

> *Preloaded once so filtering is instant with no round trip. When a collection
> outgrows this, the palette gains a "search everything" command that calls
> `searchNotesAction` instead of filtering locally.*

The judgement that turned out to be wrong is *"when a collection outgrows this"*.
It is not about how many notes she has. **One note longer than 180 characters is
already past it**, and she wrote one on her first day.

## The fix — Option A, taken

`CommandItem` accepts `keywords: string[]` and the palette filters on those as well
as on label and description. So the palette is given **every word of every note**
rather than the first 180 characters, and nothing about the component changes.

**The list query returns the words when asked.** `listNotes` gained a `words`
option and a second lateral join, bounded by the same `LIMIT` the page already has:

```sql
LEFT JOIN LATERAL (
  SELECT left(string_agg(coalesce(b.body, b.transcript), ' ' ORDER BY b.position),
              2000) AS words
    FROM blocks b
   WHERE b.note_id = n.id
     AND coalesce(b.body, b.transcript, '') <> ''
) said ON true
```

Three things in that are deliberate:

- **`ORDER BY b.position` is not decoration.** Without it `string_agg` may order
  differently between calls, and the same note would filter differently on two
  devices for no visible reason.
- **`coalesce(body, transcript)` means handwriting is searchable too**, by whatever
  the recogniser read, which is the same rule `preview` already follows.
- **2000 characters a note.** Enough for any note a person types; a hundred of them
  is 200KB in the worst case and far less in practice, fetched once when the palette
  opens rather than per keystroke.

`words` is opt-in, so the MCP server and every other `listNotes` caller send and
receive exactly what they did before. Only `listNotesAction` asks for it.

### Why not B or C

Both are still better and both are still open to you. **B** — `onQueryChange` on
`CommandPalette` — is the real answer and would buy the typo tolerance and semantic
matching that `searchNotes` already has, for every product using the component;
this fix does none of that, it only matches substrings. **C** is a screen.

**What this fix does not do:** a misspelling still finds nothing, ranking is the
component's rather than RRF's, and a space with thousands of notes still only
preloads a hundred. The 180-character cliff is gone; the ceiling has moved, not
vanished. `searchNotesAction` still has no caller.

## The fix that was NOT taken

`Blocked on: the component` was the original verdict, and it was right about this
much: `CommandPalette` takes a flat `items` array and filters it internally. It
exposes `open`, `onOpenChange`, `placeholder`, `emptyMessage` and `hotkey` — **no
`onQueryChange` and no controlled query** — so there is no supported way to hear
what she typed and go and ask the server about it.

Three ways out, and choosing between them is Brandon's:

**Option B — `onQueryChange` on `CommandPalette`.** The right long-term answer and
the one the author's comment assumes. It needs a change in `silicaui-react`, and it
buys the real search — typo tolerance and semantic matching included — for every
product that uses the component.

**Option C — stop using `CommandPalette` for notes.** Keep it for the three actions,
and give notes their own search screen that calls `searchNotesAction`. Most work,
and the only one that has somewhere to put a result count, a date filter and "no
matches" told honestly.

**`emptyMessage` keeps its wording**, and under Option A it is very nearly true: it
now speaks for every word of the hundred most recent notes rather than for the first
180 characters of them. It becomes fully true under B or C.

## Confirmed by

**P01 Marisol, act 6, 2026-09-16.** The same six queries at 360px, through the real
palette, before and after:

| She types | Before | After |
| --- | --- | --- |
| `raining` | *"Hmm — not in your jots"* | **note 6** |
| `map` | notes 7 and 1 | notes 7, **6** and 1 |
| `competitor` | nothing | **note 6** |
| `poo bag` | nothing | **note 6** |
| `sentence` | nothing | three notes |
| `Trot` | note 13 | note 13 |

Seven smoke suites green afterwards — `search changes mcp api worker db anon` — and
`pnpm typecheck` clean across all thirteen packages.

## Rating effect

`Canvas chrome and ⌘K palette` was scored 8/8 in act 5 for **navigation**, which is
what act 5 used it for. Act 6 used it to **search**, and that is the other half of
the same screen: Ease 8 → 5, with this issue as the whole reason.
