# 027 — Her export told her successor every note was illegible handwriting

**Status:** fixed
**Severity:** major
**Found by:** P02 Hazel · the export standing check · 2026-09-16
**Surface:** Account › Take it with you · MCP › `get_note` · anywhere a note is rendered
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P02 Hazel · 2026-09-16
**Blocked on:** —

## What happened

Hazel's standing check is the one that matters most to her: **six months from now,
could she hand the village hall diary to whoever takes over?** So she exported it.

The zip is good — a `README.txt`, thirteen markdown files named after their own
first line, and the original of everything. Then she opened one:

```markdown
# the fire extinguisher certificate runs out 31 May, it is in the kitchen…
_note 656e5e3b · revision 1 · updated 2026-09-16T10:33:45.259Z_

_[handwritten, nothing legible on it]_

the fire extinguisher certificate runs out 31 May, it is in the kitchen drawer behind the tea towels

## Attachments

- handwriting: [c537d964….svg](../ink/c537d964….svg)
```

**Hazel has never handwritten anything in her life on this product.** She types with
one finger on a Moto G. Every one of her thirteen notes carried that line.

## Why it matters

The whole point of the export is to be **the artifact somebody else reads**, and
this is the sentence it leads with. A successor opening the hall diary is told, on
every page, that the note is handwriting and that none of it can be read — directly
above the sentence, in plain type, that can be read perfectly.

It is also the product contradicting its own first promise. The apex says:

> **Your notes are yours.** Export every one of them, any time, as markdown that
> opens anywhere. Leaving is a supported operation, not a support ticket.

It is a supported operation that describes her notes as unreadable.

**And it is not only the export.** `renderBlock` is what MCP's `get_note` returns, so
an agent reading any typed canvas note was handed the same line — the rulebook's
*absence presented as measurement*, told to a machine that will repeat it.

## The cause

**A canvas creates its ink layer the moment it opens**, whether or not anybody picks
up a pen. That was established in issue 007: *"opening the canvas auto-writes an
empty note and an ink layer holding `\"strokes\": []` all by itself."*

`renderBlock` then sees an `ink` block with no transcript and says the only thing it
knows how to say about one:

```ts
if (!b.transcript?.trim()) return `_[${label}, nothing legible on it]_`;
```

It is right about a page somebody drew on badly. It has no way to tell that apart
from a layer nobody ever touched, because `RenderableBlock` carries a transcript and
no notion of whether a stroke exists.

So **every note typed on the canvas, by anybody, exported as illegible handwriting.**

## The fix

`renderBlock` is told whether a pen was ever used, and says nothing when it was not:

```ts
// An ink layer is created the moment a canvas opens, so a note somebody only
// typed has an empty one. Calling that "handwritten, nothing legible on it"
// tells a person their own typed note is unreadable. Issue 027.
if (b.kind === "ink" && b.hasStrokes === false && !b.transcript?.trim()) return "";
```

`renderNote` already drops empty blocks, so nothing else changed.

Both block loaders answer the question, because there are two:

- **`readBlocks`** (`note-body.ts`) — what MCP reads — gains an `EXISTS` over
  `media_assets.strokes`.
- **`shapeBlock`** (`export.ts`) — what the export reads — already had the whole
  `InkDocument` in hand and now derives it from `doc.strokes.length`.

`hasStrokes` is optional on the type, so a caller that does not know stays exactly as
it was: the line is suppressed only when something has positively said *no pen*.

**And the attachment label.** The zip still contains an SVG per note, and that is
right — `inkSvg` renders text boxes as well as strokes, so it is a picture of the
page as she laid it out, which is worth keeping. But calling it `handwriting:` was
the same lie in miniature:

```ts
const drawn = (block.document?.strokes.length ?? 0) > 0;
const label = { ink: drawn ? "handwriting" : "the page", ... }
```

## Confirmed by

**P02 Hazel, 2026-09-16.** The same note, re-exported and read out of the zip
without ever writing it to disk:

```markdown
# the fire extinguisher certificate runs out 31 May, it is in the kitchen…
_note 656e5e3b · revision 1 · updated 2026-09-16T10:33:45.259Z_

the fire extinguisher certificate runs out 31 May, it is in the kitchen drawer behind the tea towels

## Attachments

- the page: [c537d964….svg](../ink/c537d964….svg)
```

Seven suites green — `export mcp view render reread api db` — and typecheck clean
across all thirteen packages.

## What the export gets right, and is worth not losing

Recorded as a pass, because it is the best-made thing found in two runs:

- **`README.txt` explains the folders in her words** — *"one markdown file per note,
  newest first"*, and why the SVG is the drawing rather than a picture of it.
- **Filenames are readable**: `0007-the-fire-extinguisher-certificate-runs-out-31-ma-656e5e3b.md`.
  A stranger can find a note in a file listing without opening one.
- **Nothing is lost by exporting** and the page says so.
- It is **one tap** from `/account`, per space, with no email and no waiting.

## Rating effect

`Account › Export` scores 8/8 in P02's run, with this fixed. Before it, Ease was a 5
— the mechanism was perfect and what came out misdescribed every note in it.
