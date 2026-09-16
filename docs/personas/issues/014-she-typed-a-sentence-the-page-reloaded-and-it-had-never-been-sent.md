# 014 — She typed a sentence, the page reloaded, and it had never been sent

**Status:** fixed
**Severity:** major
**Found by:** P01 Marisol · act 5 · the reload standing check · 2026-09-16
**Surface:** app › A note (the canvas)
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P01 Marisol · act 5 · 2026-09-16
**Blocked on:** —

## What happened

The standing check is one line: *press F5 with an unsaved sentence on screen.*

Marisol put a note on the canvas and typed `half a sentence and then the phone`,
leaving the caret in the box — which is what somebody looks like at the exact moment
a phone runs out of battery. The page reloaded.

```
before: "half a sentence and then the phone"
after : null
```

No box. No words. Nothing in the database.

## What should have happened

The sentence is somewhere the product can still find, which is the promise made on
the front page of the marketing site.

## The cause

**Canvas text was sent to the server only when the box lost focus.** Nothing else
sent it — not a timer, not a keystroke count.

`ink-plane.ts` fires two callbacks. `onEdit` runs on every keystroke, and
`ink-text-layer.ts` answered it by re-rendering and telling the camera:

```ts
onEdit: () => { this.plane.render(this.boxes); this.host.onGeometry(); },
onDone: () => this.publish(),
```

Only `publish()` reaches `onDelta`, and only `onDone` — blur — calls it. So
everything typed since the caret landed lived in one `<textarea>` and nowhere else.

**Strokes do not work this way.** `ink-sync.ts` uploads them every ten strokes or
two seconds, and says why in a comment that turns out to be the whole finding:

> *The asymmetry is deliberate and worth stating: losing a typed paragraph is
> annoying because it can be retyped. Losing a hand-drawn page is unforgivable,
> because it cannot.*

The asymmetry is defensible. What was not defensible is how far it went: a typed
paragraph was not synced *less eagerly* than a drawing, it was not synced **at all**
until the person happened to tap somewhere else.

**And the defence that was supposed to catch this already existed.** `InkCanvas.tsx`
listens on `pagehide` and `visibilitychange`, with a comment naming iOS by name. But
it flushed the sync queue — and the text had never been put in the queue, so it
flushed nothing:

```ts
const flush = () => { void syncRef.current?.flush(); };
```

Its own heading said *"The last line of defence for unsaved strokes."* Strokes. The
neighbour was left behind.

**One more inversion worth stating.** The apex hero protects an anonymous stranger's
half-typed jot with `sendBeacon` — that was proved in act 2 of this same run. So the
product guarded a stranger's sentence and not a paying customer's.

## The fix

The last line of defence now includes the box with the caret in it:

```ts
const flush = () => {
  // A box with the caret still in it has published nothing -- text leaves
  // on blur -- so without this the queue being flushed is empty and the
  // half-typed sentence is gone. Issue 014.
  engineRef.current?.blurText();
  void syncRef.current?.flush();
};
```

`blurText()` already existed on the engine. Blurring fires the box's own `blur`
listener, which calls `publish()`, which queues the delta — and the flush on the
next line sends it. **No new write path, no new endpoint, no extra traffic, and no
change to how often anything is saved while somebody is typing.**

### Why not save on a timer instead

The obvious alternative — publish every second while typing — was written, weighed
and rejected. Every publish goes through `InkDoc`, which records an undo step
(ADR-109), and `InkHistory` has a depth of 80 with no coalescing. One sentence typed
over twenty seconds would spend twenty of those eighty steps, and Ctrl+Z would walk
backwards through fragments of it. That is a worse product for a smaller gain than
the one-line fix above.

## Confirmed by

**P01 Marisol, act 5, 2026-09-16.** Text typed into a fresh box at 360px with the
caret left in it, then `pagehide` delivered. Read back from the database:

```
half a sentence and then the phone
```

The box was blurred by the handler (`document.activeElement` became `BODY`) and the
words were on the server three seconds later.

## What is still true, and is NOT fixed

**A hard reload still loses it, and this is measured, not assumed.** Repeating the
original F5 test after the fix gives the same empty result. The reason is not the
handler — that runs — it is that `flush()` sends a `fetch`, and a browser cancels
in-flight fetches when the document goes away. Only `navigator.sendBeacon` survives
that, which is exactly what the hero uses.

So after this fix:

| What she does | Her sentence |
| --- | --- |
| Switches to another app on her phone | **safe** — `visibilitychange`, the page lives |
| Swipes jotacular away on iOS | **safe** — `pagehide`, the page lives |
| Taps another part of the page | safe — this always worked |
| Reloads, or closes the tab | **still lost** |
| Battery dies | **still lost** |

The last two are the same guarantee strokes have had since ADR-058, so text is no
longer the poor relation — but "best effort" is now the honest description of both,
rather than of one.

**Closing that gap needs a decision and is not taken here.** It means beaconing the
sync queue to a new endpoint, and `ink-sync.ts` is explicit that op ordering is
load-bearing:

> *draw a stroke and rub it out inside the two-second window, and a delta sent ahead
> of the queue would remove an id the server has never heard of and the append
> behind it would then put the stroke back. The person watches their erased line
> return.*

A beacon returns no confirmation, and the queue is documented as being emptied only
on confirmation. Reconciling those two is the author's call, not a run's.

## Rating effect

`A note (the canvas)` Ease is 7 rather than 9 with this half-open. The gap to 10 is
named on its row in [rating.md](../rating.md).
