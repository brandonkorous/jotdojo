# 08 — Ink

Handwriting is not a feature bolted onto a notes app. It is load-bearing: **an agent cannot read a stroke.** If a third of the notes are coordinate arrays, we have built an agent-native product whose best content is opaque to agents. Recognition is what makes ink and MCP the same product.

## What the web actually gives us

Honest capabilities on an iPad, because planning against the fantasy version wastes months.

**We get:**
- Pointer Events with `pressure`, `tiltX`, `tiltY`, and `twist` from Apple Pencil in Safari.
- `pointerType` cleanly separating `pen` from `touch`, which makes palm rejection nearly free — ignore touch while a pen is down.
- Real stylus support on Android Chrome too.

**We do not get:**
- **`getCoalescedEvents()` in Safari.** Apple Pencil samples up to 240Hz; without coalesced events we read `pointermove` at roughly display rate and see a fraction of the samples. Native PencilKit sees all of them.
- Background sync, so nothing uploads while the tab is closed.
- Anything close to native latency.

**Amusing inversion:** Chrome on Android *does* support `getCoalescedEvents`, so S Pen ink can be smoother in our web app than Apple Pencil ink is. Expect this to be reported as an iPad bug. It is not one.

**`pointerleave` and `setPointerCapture` do not mix.** Moving capture to an element fires
`pointerout`/`pointerleave` as the capture target changes, with the same `pointerId`, while
the pen is still down. A handler that ends the stroke on leave therefore ends it on the
first sample — drawing nothing, raising nothing, and only on touch, because a mouse does
not fire leave when capture lands on the element it is already over. It cost an iPhone all
of its ink while every desktop worked. Capture already guarantees `pointerup`, so leave
buys nothing; `pointercancel` is the only abort worth listening to.

**Set expectations accordingly.** Our ink should feel good. It will not feel like Procreate, and no amount of engineering closes that gap in a browser.

## Rendering

- Dedicated `canvas` element, 2D context with `desynchronized: true` for the low-latency path.
- The in-flight stroke draws on its own compositing layer, committed to the main layer on `pointerup`.
- Curve fitting to compensate for the missing samples: Catmull-Rom through the captured points, converted to cubic béziers.
- Width modulated by `pressure`; a subtle tilt response on the pen tool only.
- **No React re-render in the stroke hot path.** The canvas is an imperative island. Touching component state per `pointermove` will destroy the feel.
- Render at device pixel ratio, cap at 2x. 3x on a large canvas costs more than it returns.

## Tools

Four. Not fourteen.

| Tool | Behaviour | Settings |
|---|---|---|
| Pen | Pressure-modulated width, the default | Five colours, three widths |
| Highlighter | Fixed width, multiply blend, low alpha | Four colours. Alpha is **always** applied |
| Eraser | Stroke-wise, not pixel-wise. Removes whole strokes | — |
| Select | Lasso: move, recolour, resize, delete | Acts on what it caught |

**Style is held per tool** (ADR-045). One shared colour is what made the highlighter
useless: it inherited the pen's near-black, and a near-black marker at 35% is a grey smear.
Opacity belongs to the tool and is applied when painting, never baked into a stored colour —
the schema takes six-digit hex precisely so it cannot be.

**A selection can be changed, not just moved.** Recolour and resize apply to the caught
strokes in place, so the marquee survives and somebody can try three colours without
lassoing again. Resizing skips highlighters, because a marker has one width.

Stroke-wise erase keeps the data model clean and matches what people expect from vector ink. Pixel erase would force rasterization and break re-recognition.

## Storage

Vectors, never flattened rasters. Format in [04-data-model.md](04-data-model.md).

Reasons this matters more than it looks:
- Strokes are small — thousands of points is tens of kilobytes.
- They can be **re-recognized** by a better model later, so old handwriting silently improves.
- Vector strokes are what recognition engines consume. A PNG is a one-way door.

We render a raster preview for thumbnails and for VLM-based recognition, but the vectors remain the truth.

### Sync must be eager

Safari evicts script-writable storage under pressure and after disuse. Therefore:

- Upload **stroke batches as they are drawn**, not on save. Roughly every 10 strokes or 2 seconds, whichever first.
- Never let a completed drawing exist only in IndexedDB.
- Losing a hand-drawn page is unforgivable in a way that losing a typed paragraph is not — the user cannot retype it from memory.

## Recognition, in three tiers

Ship in this order.

### Tier 1 — Apple Scribble (free, day one)

On iPadOS, Apple Pencil Scribble works in **any text field, including web inputs in Safari**. Handwrite, get real text, zero engineering.

Most people do not know this works on the web. Making it the default pencil-to-text path satisfies a large share of "I want to jot with my pencil" before we write a single recognizer. Surface it in onboarding rather than hiding it.

### Tier 2 — VLM over rendered strokes (the v1 recognizer)

Render the ink to a clean high-contrast PNG, send it to a vision model, store the result as the transcript with a confidence estimate.

Chosen because: no licence, no new infrastructure, no per-seat cost, and frontier models read handwriting well. We already have an LLM budget. **Do not buy an SDK before there are users.**

Practical notes: render at generous resolution with plain black ink on white regardless of the user's pen colour, split the surface into overlapping tiles to keep the model focused, and ask for a confidence self-report alongside the text.

**The frame comes from the ink, never from the stored canvas** (ADR-053). That canvas is the viewport the layer was created at — written once and never updated — so ink has always been able to live outside it, and did: rotate an iPad, write in the newly exposed strip, and those strokes were stored correctly and then clipped out of every read, silently and permanently. Tiling is two-dimensional because a surface spreads sideways as readily as down, and tile size is expressed in *rendered pixels* rather than document units, because on an endless canvas 700 units is four pages of writing when drawn zoomed out and two letters when drawn zoomed in.

### Tier 3 — MyScript iink (only if forced)

The only serious *web* handwriting SDK — `iinkJS` / `iinkTS`, commercial licence. Move here only when accuracy or per-page cost genuinely demands it.

Google's ML Kit Digital Ink Recognition is Android and iOS native only. It is not an option for a web app, regardless of how often it comes up in search results.

## Confidence and honesty

Recognition output always carries a confidence value, and it is always shown — subtly in the UI, explicitly over MCP:

    > [handwritten, confidence 0.82] check with Dana about the margins

Below roughly 0.6, the UI offers a one-tap "fix this" that opens the transcript for editing next to the ink. A user correction sets `transcript_source = 'user'` and confidence to null, and that block is never re-recognized again.

## The camera

The page is endless in both directions, and what you are looking at is a camera over it: three numbers, `x`, `y` and `k`, sitting between the pointer and the document (ADR-054).

**Two fingers move the canvas; one finger draws.** Pan and zoom are the same gesture — a two-finger drag that doesn't change the spread simply pans — so there is nothing to switch between and no mode to be in. On a desktop, ⌘/Ctrl with the wheel zooms about the cursor and a plain wheel pans. While a stylus is on the glass, touch does nothing at all, which is what stops a resting palm from dragging the page out from under the nib.

**Opening a note frames its writing.** A page you have never touched opens exactly where it always did; a page with ink on it opens showing that ink, never blank paper somewhere off to the side. Zoom never exceeds 1:1 on load, because a three-word note blown up to fill a monitor looks like a mistake. Rotating a tablet or opening the keyboard widens the window onto the same place rather than re-framing — being teleported mid-sentence is worse than a slightly awkward view.

**The zoom readout is the way back.** Nothing clamps how far you can pan, so it is possible to end up somewhere with no ink in sight. Tapping the readout frames the writing again. It only appears once you have actually moved.

A faint dot grid gives the surface somewhere to be. It scales with the zoom on a doubling ladder, so the dots stay roughly the same distance apart on screen whatever `k` is, and it stays quiet enough not to argue with washi's paper grain.

Nothing about the camera is stored. Where you were last looking is not a property of the note, and two people opening the same shared page should both land on the writing rather than on each other's scroll position.

## Not in v1

Shape recognition and beautification, handwriting search that highlights within strokes (search the transcript instead), layers, PDF annotation.

> **"Infinite canvas panning (fixed page size is enough)" used to be on this list.** It came off on 2026-08-22 (ADR-053, ADR-054). The deciding argument was not the feature: it was that recognition already read the wrong rectangle, and fixing that meant deriving geometry from the strokes — which is the whole of what an endless canvas needs from the server.
