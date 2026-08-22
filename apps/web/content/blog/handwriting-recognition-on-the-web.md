---
title: Handwriting recognition on the web in 2026 — what actually works
description: What a browser really gives you for stylus input, the one free trick most people miss on iPad, and why you should store strokes rather than pixels.
date: 2026-08-21
---

We built handwriting into a web app on purpose, and the research phase was mostly
a process of finding out which capabilities are real and which are blog posts.
Here is the honest state of it.

## What a browser gives you

**Pointer Events are good.** On an iPad in Safari, a `pointermove` from an Apple
Pencil carries `pressure`, `tiltX`, `tiltY` and `twist`. On Android Chrome the S
Pen reports the same. This is enough for pressure-modulated width and a tilt
response, which is most of what makes ink feel like ink.

**Palm rejection is nearly free.** `pointerType` cleanly separates `pen` from
`touch`, so "ignore touch events while a pen is down" is a five-line rule that
works.

**Sampling is where it hurts.** Apple Pencil samples up to 240 Hz. Safari does
not implement `getCoalescedEvents()`, so you read `pointermove` at roughly
display rate and see a fraction of the samples the hardware produced. Native
PencilKit sees all of them; you do not.

The amusing consequence: Chrome on Android *does* support `getCoalescedEvents`,
so S Pen ink can be measurably smoother in a web app than Apple Pencil ink is.
Expect that to be filed as an iPad bug. It is not one.

You also do not get background sync, and you do not get anything close to native
latency. Web ink can feel good. It will not feel like Procreate, and no amount of
engineering closes that gap inside a browser.

## Making it feel right anyway

Four things carry most of the improvement:

1. **A dedicated canvas with `desynchronized: true`.** This opts into the
   low-latency path and is the single largest win available.
2. **Two layers.** The in-flight stroke draws on its own canvas and is committed
   to the main one on `pointerup`. Redrawing the whole page per sample is what
   makes cheap ink feel like cheap ink.
3. **Curve fitting.** Since you are missing samples, fit rather than connect:
   Catmull-Rom through the captured points, converted to cubic béziers. This is
   what turns a visibly polygonal line into a stroke.
4. **No framework in the hot path.** The canvas has to be an imperative island.
   Touching React state on `pointermove` means a re-render every few
   milliseconds, and the feel is gone. This is not an optimisation to do later;
   it decides the architecture.

Render at device pixel ratio, capped at 2×. 3× on a large canvas costs more than
it returns.

## The free trick most people miss

On iPadOS, **Apple Pencil Scribble works in any text field, including ordinary
web inputs in Safari.** Handwrite into a `<textarea>` and you get real text, with
zero engineering on your part and no recognition cost.

Very few people know this works on the web. If your goal is "let me write with my
pencil," surfacing Scribble satisfies a large share of users before you build a
recognizer at all. Say so in onboarding instead of hiding it.

It is not a complete answer — Scribble is iPadOS-only, it converts as you write
rather than preserving the handwriting, and it cannot read a diagram. But it is
free, it is excellent, and shipping it first is the right order.

## Actual recognition: models, not SDKs

For real handwriting — a page of notes, a sketch with labels — the pragmatic 2026
answer is a vision model over a rendered image of the strokes.

Render the ink to a clean, high-contrast PNG (plain black on white regardless of
the pen colour the user chose), send it to a vision model, and store the returned
text as a transcript with a confidence estimate. Split long pages into horizontal
bands so the model stays focused, and ask it to report its own confidence
alongside the text.

Why this over a dedicated handwriting SDK: no licence, no new infrastructure, no
per-seat cost, and frontier models read handwriting genuinely well. If you are
already paying for a model, the marginal cost is a few cents a page. Buying an
SDK before you have users is optimising the wrong thing.

## Store strokes, never pixels

This is the decision that matters most in a year's time, and it is easy to get
wrong on day one because a PNG is so much simpler.

Keep the vectors:

- **They are small.** Thousands of points is tens of kilobytes — smaller than the
  image of them.
- **They can be re-read later.** When a better model ships, every page anyone has
  ever drawn gets re-recognized and silently improves. A stored PNG can be
  re-read too, but at the quality of your renderer on the day it was saved.
- **Editing stays possible.** Stroke-wise erase, lasso-select, move. Pixel erase
  forces rasterization and closes both doors at once.
- **A raster is a one-way door.** You can always render pixels from strokes. You
  can never recover strokes from pixels.

Render a raster for thumbnails and for the recognizer. Keep the vectors as the
truth.

## Sync eagerly, and mean it

Safari evicts script-writable storage under memory pressure and after periods of
disuse. This is documented behaviour, not an edge case.

So upload stroke batches **as they are drawn** — every ten strokes or two
seconds, whichever comes first — and never let a finished drawing exist only in
IndexedDB. Empty the queue on confirmation from the server and never before.

The asymmetry is worth stating plainly: losing a typed paragraph is annoying,
because it can be retyped. Losing a hand-drawn page is unforgivable, because it
cannot. The two deserve different amounts of paranoia.

---

jotdojo keeps every stroke you draw, so a page you wrote by hand is searchable by
what it says — and gets better as the models do, without you doing anything.
[Draw something on the home page](/) without signing up.
