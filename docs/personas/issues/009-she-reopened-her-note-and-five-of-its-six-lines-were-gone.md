# 009 — She reopened her note and five of its six lines were gone

**Status:** fixed
**Severity:** blocker
**Found by:** P01 Marisol · act 5 · 2026-09-16
**Surface:** app › A note (the canvas) — every note with typed text on it
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P01 Marisol · act 5 · 2026-09-16
**Blocked on:** —

## What happened

Marisol typed note 2 onto the canvas:

> `Nia's mum asked about the 6am slot again — third person this month. morning tier?`

It wrapped to six lines in the box and every word of it was on screen. She left
the box, went to the Dashboard, came back to the note.

**The page said `Nia's mum`.** Two words, floating in the middle of an otherwise
empty page. The other seventy characters were not there.

She had typed the sentence three minutes earlier and it was already gone.

## What should have happened

Her sentence is on the page she left it on.

## How to reproduce

1. Sign in at `http://localhost:3400`, at 360px.
2. ⊕ › **A note on the canvas**, tap the page, and type any sentence long enough
   to wrap — a tapped box is 120px wide on a phone, so about eight words.
3. Press Escape.
4. Reload the page, or navigate away and back.

Every time. It is not a race and it is not intermittent.

## What was actually lost — nothing

This is the one piece of good news, and it is why this is a `blocker` rather than
the end of the product. **The words were all safely stored.** Read back from the
page's object row:

```
"w": 120, "x": 40, "y": 97.2, "size": 16,
"text": "Nia's mum asked about the 6am slot again — third person this month. morning tier?"
```

The searchable companion row held the same eighty-one characters, so search would
still have found the note. The failure is entirely in the drawing.

Measured in the live page, before the fix:

| | |
| --- | --- |
| `textarea.value.length` | 81 — all of it |
| `scrollHeight` | 130px — six lines |
| `clientHeight` | **22px — one line** |
| `style.height` | `22px` |

The box was one line tall and the remaining five were clipped off the bottom.

## Why it matters

A person opens their own note and their thought is not on it. For a product whose
promise is **"Where the thought lands"** there is no worse thing that can happen on
the screen, and nothing on the screen suggests the words still exist — no scrollbar,
no ellipsis, no cut-off letter. The page simply looks like she never finished the
sentence.

It also makes act 6 impossible in the honest sense: she can search her way to a
note and still not be able to read it when she gets there.

**It hits every typed note on the canvas**, which is the app's front door — signing
in lands you there. The only notes that escaped it were the ones written through
the hero or a capture token, which render from the typed spine instead.

## Where it lives

`apps/web/lib/ink-plane.ts`, in `render`. The order of two statements:

```ts
const node = this.nodes.get(box.id) ?? this.create(box);
this.place(node, box);          // measures scrollHeight
if (this.editing !== box.id && node.value !== box.text) node.value = box.text;
```

`place` calls `grow`, which sets the height from `node.scrollHeight`. On the first
render of a loaded page the textarea has just been created and **is still empty**,
so its scrollHeight is one line. The text is assigned on the very next statement,
and nothing measures again.

While somebody types it is correct, because the `input` listener calls `grow`
directly with the text already in the field. That is why this is invisible until
you leave the page and come back — the bug lives only on the load path.

`grow` itself is right, and its comment already states the rule this broke:

> *Clipping is not an option on a surface whose whole job is not losing what you
> typed.*

## The fix

The two statements swapped, so the box is measured after it has its text:

```ts
const node = this.nodes.get(box.id) ?? this.create(box);
// NEVER overwrite the field somebody is typing into. [...]
if (this.editing !== box.id && node.value !== box.text) node.value = box.text;
// AFTER the text, never before: `place` measures scrollHeight, and a box
// measured while still empty is one line tall with the rest clipped off
// the bottom for as long as the page stays open. Issue 009.
this.place(node, box);
```

Nothing else changed. The guard that protects a box somebody is typing into is
untouched and still runs first, so a remote update still cannot move the caret.

## Confirmed by

**P01 Marisol, act 5, 2026-09-16.** Same note, same URL, reloaded at 360px:

| | Before | After |
| --- | --- | --- |
| `clientHeight` | 22px | **130px** |
| `scrollHeight` | 130px | 130px |
| On screen | `Nia's mum` | all six lines |

Read from the screen, not from the database — her whole sentence is on the page.

## Rating effect

`A note (the canvas)` was deliberately unscored before this, because it had only
ever been seen at desktop width. It is scored now, at 360px, and this defect is the
reason its Ease was going to be a 3. Fixed, it scores 8/7.
