# 045 — "Comment on this" could not say what "this" was

**Status:** fixed
**Severity:** minor
**Found by:** screen scoring · `canvas › RemarkPopup` · 2026-09-16
**Surface:** app › the canvas — the comment popup, first comment on an object
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** 2026-09-16
**Blocked on:** —

## What happened

Select a note on the canvas, right-click, **Comment on this**. The popup opens
beside it and its heading reads:

> **Something on this page**
> Nothing about this yet.

The object it is attached to says `Pallet count: 40, not 38`. The popup could have
read those words; it did not.

**Say something, and the heading immediately corrects itself** to
`Pallet count: 40, not 38`. So the name was always available — it just arrived one
comment too late.

## Why the one moment it is wrong is the one that matters

A canvas can hold five notes, a photo and a stack of stickers. The popup floats
beside the thing it belongs to, which usually makes the connection obvious — but a
duplicated note sits 24px from its original, and two of those look identical.

**The heading is the only text that says which object this comment will land on.**
It is confident and generic in exactly the moment the reader is deciding whether to
type, and specific ever after, when they no longer need it.

The empty line beside it is right — *"Nothing about this yet."* — so the panel is
saying "this" twice and naming it neither time.

## The cause

Three correct decisions meeting badly, and the code says so itself.

`remarks.tsx` on `pins`:

> **One per commented object**, for the marks on the canvas.

and on `setLabels`:

> What the canvas calls each commented object. **Pushed by the pins**, which are the
> only part of this that can see the page.

So a label is computed for objects that have been commented on. `threadsOf` builds
threads out of comments, so an object with none has no thread. And `RemarkPopup`
invents one to render:

```tsx
const thread = remarks.threads.find((t) => t.anchorId === focus)
  ?? { anchorId: focus, label: null, comments: [], open: 0 };
```

**`label: null`, hard-coded.** `threadTitle` then does the only thing it can:

```ts
return thread.label ?? "Something on this page";
```

Everything on that path behaves as designed. The synthesised thread is the one place
that had to ask a question and answered it with a constant.

## The first fix was in the wrong place, and is recorded because that is useful

The obvious move was to make the labels include the focused anchor as well as the
pinned ones, in `RemarkPins`. It typechecked, it linted, and **the popup still said
"Something on this page"** — because the synthesised thread discards `labels`
entirely. It never reads them.

That change was reverted rather than left in as a second belt: it would have been a
correct-looking line that fixed nothing, sitting next to the line that actually
needed fixing. RULE #3 asks for the single point of change; this is what it is for.

## The fix

The popup already holds the engine — it needs it to follow the object around the
page — so it can ask the same question `RemarkPins` asks, for the one anchor it
cares about:

```tsx
// Not `label: null`. A thread only exists once something has been said, so
// the popup that "Comment on this" just opened had no name for `this` --
// on a page of five notes, the one moment it matters most. Issue 045.
const named = engine.current ? labelsFor(engine.current, [focus])[focus] : null;
const thread = remarks.threads.find((t) => t.anchorId === focus)
  ?? { anchorId: focus, label: named ?? null, comments: [], open: 0 };
```

`labelsFor` was already exported and already imported from the same module for
`anchorRect`. Nothing new was written — an existing answer was asked for one anchor
earlier than before.

It keeps the "No longer on the page" behaviour too: `labelsFor` returns that string
for an anchor the engine cannot find, which is what the adrift state wants.

## Confirmed by

**2026-09-16.** A note duplicated with **Make another one**, so it carries the same
words and has never been commented on, then **Comment on this**:

```
popupTitle   "Pallet count: 40, not 38"     <- was "Something on this page"
empty        "Nothing about this yet."      <- unchanged, and right
```

And the whole pinned-comment path re-walked on the original, which is what turned
this up: right-click → **Comment on this** → type → **Say it** → a violet numbered
pin lands on the object, the popup heads with the object's words, the comment reads
`you · just now` with **Mark done**, and the comments button in the chrome gains a
violet dot.

Typecheck and lint clean. `RemarkPopup.tsx` 117 lines, `RemarkPins.tsx` back to 36.

## Rating effect

`canvas › RemarkPins` and `canvas › RemarkPopup` are scored for the first time in
[rating.md](../rating.md), on the fixed build.
