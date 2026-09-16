# 034 — A man who typed was told his strokes were safe

**Status:** fixed
**Severity:** nit
**Found by:** P07 Dele · act 8 · 2026-09-16
**Surface:** canvas › the live line, while the connection is down
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P07 Dele · act 8 · 2026-09-16
**Blocked on:** —

## What happened

Dele loses signal for about a fifth of his route. He typed a note in a dead spot and
the canvas told him:

> ● **Strokes are safe here and will retry**

He had not drawn a stroke. He had typed a sentence with his thumb.

## Why a nit is worth filing

**It is the only sentence the product says at the one moment he cannot check
anything.** He is standing at a van door with no bars, and this line is the entire
answer to "did that save?". Two of its words are wrong for him:

- **"Strokes"** is not what he made, and it is not the customer's word either. The
  copy guide is explicit: *"handwriting — ink internally is fine; **to users it is
  handwriting**"*. "Strokes" is further inside than "ink".
- **The queue it describes carries far more than strokes.** `InkSync` sends
  strokes, text boxes, arrows, stickers and photos through the same ops list. The
  message named the one kind he had not used.

So a man who typed is told about drawing, by a sentence meant to reassure him, about
a queue that is holding his typing.

## Where it lives

`apps/web/lib/use-ink-feed.ts` — one line, on the `retrying` branch.

## The fix

```ts
// Not only strokes: the same queue carries text boxes, arrows, stickers
// and photos, and "strokes" is our word rather than theirs (docs/11).
// Somebody in a tunnel needs to know the PAGE is safe. Issue 034.
? { tone: "trouble", line: "Saved on this device. It will send when the connection is back" }
```

**"Saved" first**, because that is the word he is looking for. **"on this device"**
rather than "here", because *here* is ambiguous when the whole question is where the
thing is. And **"when the connection is back"** instead of *"will retry"*, which is
our word for what the software does rather than his word for what he is waiting on.

## Confirmed by

**P07 Dele, act 8, 2026-09-16.** A note typed on the canvas, the connection cut
mid-save, read from the live line:

> **Saved on this device. It will send when the connection is back**

Connection restored, the line cleared, and both text boxes arrived in full:

```
_[2 text boxes, read top to bottom and left to right]_

42 is the one with the dog

no signal on the Bewdley road, 3 parcels left in the porch at 42 + 1 more
```

Nothing was lost and nothing was truncated.

## The behaviour underneath it, which was already right

Recorded because it is the thing act 8 exists to test, and it passes:

- **The capture is never refused when the network is gone.** It queues.
- **The page keeps working.** He carried on typing into a second box with no network
  at all.
- **It retries by itself** on reconnect, with no prompt and no lost keystrokes.
- **It says so while it is happening**, which is the part most apps skip.

## Rating effect

Part of the gap to 10 on `The canvas`. The behaviour was a 9; the sentence was a 6.
