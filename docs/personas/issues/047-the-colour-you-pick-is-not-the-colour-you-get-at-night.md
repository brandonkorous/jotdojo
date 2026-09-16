# 047 — The colour you pick is not the colour you get, at night

**Status:** fixed
**Severity:** major
**Found by:** the dark pass owed by issue 002 · 2026-09-16
**Surface:** app › A note (the canvas) › Tool options · Selection bar
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** the canvas, both themes and a live flip · 2026-09-16
**Blocked on:** —

## What happened

Open the pen options on a dark page. The **Charcoal** swatch — the default pen, the
one already selected — is drawn as a **near-black dot**.

Draw with it and the stroke comes out **warm paper white**.

Every one of the nine ink colours does this, because ADR-116 maps ink at paint time
and the swatch does not go through the map:

| swatch shows | canvas paints | |
| --- | --- | --- |
| `#1A1817` near-black | `#F7F3EA` warm paper | Charcoal — **the default pen** |
| `#6A39FF` | `#8A63FF` | Violet |
| `#00A38D` | `#00C2A8` | Mint |
| `#3F6B4A` | `#498C5B` | Moss |
| `#A2593B` | `#C46239` | Clay |
| `#F2D648` bright yellow | `#816F06` dark olive | Yellow marker |
| `#6FD6A8` pale mint | `#0B7F58` deep green | Mint marker |
| `#7EC8F0` pale sky | `#0F77A1` deep blue | Sky marker |
| `#F58BB0` pink | `#CC2C75` deep rose | Rose marker |

Measured live on the canvas in dark: the four marker chips render
`rgb(242, 214, 72)`, `rgb(111, 214, 168)`, `rgb(126, 200, 240)`, `rgb(245, 139, 176)`
— the day values, every one.

## What should have happened

The picker should show the mark you are about to make.

**This is not a new principle. The code already states it, twice, in its own words**,
and went to real trouble to honour it on a different axis:

`apps/web/components/ToolOptions.tsx:149`

```
/** Drawn at the alpha it will actually paint at, so the swatch is not a
 *  promise the canvas breaks. */
```

`apps/web/app/styles/chrome.css:66`

```
/* Drawn as a swipe at roughly the alpha it paints at, so the swatch is not a
   promise the canvas breaks: a marker is translucent, always. */
```

The marker chip is squashed to 0.6rem and dropped to `opacity: 0.75` **specifically
so it does not lie about what will land.** ADR-116 then broke the same promise on
colour, for all nine, and nobody noticed because dark mode had never been switched
on.

## Where it lives

`apps/web/components/ToolOptions.tsx:167`:

```tsx
<span
  aria-hidden
  className={marker ? "jd-chip jd-chip-marker" : "jd-chip"}
  style={{ background: color }}
/>
```

`color` is the **stored** colour. `ink-paint.ts` paints `inkFor(stroke.color)`. The
swatch is the one place that draws an ink without asking the page what theme it is.

Four call sites, all of them inks — `PEN_COLORS` and `MARKER_COLORS` in
`ToolOptions` and in `SelectionBar`. Card colours are a different control and are
**correctly** left alone: a card is a fill, not a mark, and a white card stays white
at night with `inkOn()` picking readable text for it.

## Why it is `major`

The default pen is Charcoal. So **the first thing a new person sees on a dark page
is a black dot that draws in white** — on the control whose entire job is to show
what the mark will be. It is not cosmetic: it makes the picker actively
misleading, and it is worse for the marker row, where picking "bright yellow"
produces a dark olive wash.

A contrast audit cannot see this. Both the swatch and the stroke pass AA against
their own grounds. The defect is that they disagree with each other.

## How to reproduce

1. Open a note with the OS in dark, or pick Night in ⌘K.
2. Click the pen, then click it again to open its options.
3. The selected Charcoal swatch is a near-black dot.
4. Draw. The stroke is warm paper white.

Every time. Same for all four marker chips.

## The fix

Send the swatch through the same map the canvas uses, and re-render it when the
theme flips — `watchPaper` exists for exactly that and `ink-painter.ts` already
uses it.

## Confirmed by

**2026-09-16**, on the real canvas, the screen it was found on.

Two lines in `ToolOptions.tsx`: the chip's background goes through `inkFor`, and
the component subscribes to the theme so it re-draws when somebody flips it.

```tsx
useSyncExternalStore(watchPaper, paperIsDark, () => false);
...
style={{ background: inkFor(color) }}
```

**The five pens, measured in dark** — every one now equals ADR-116's night column:

```
Charcoal  rgb(247, 243, 234)   #F7F3EA   was a near-black dot
Violet    rgb(138,  99, 255)   #8A63FF
Mint      rgb(  0, 194, 168)   #00C2A8
Moss      rgb( 73, 140,  91)   #498C5B
Clay      rgb(196,  98,  57)   #C46239
```

**The four markers, measured in dark:**

```
Yellow    rgb(129, 111,   6)   #816F06   was bright #F2D648
Mint      rgb( 11, 127,  88)   #0B7F58
Sky       rgb( 15, 119, 161)   #0F77A1
Rose      rgb(204,  44, 117)   #CC2C75
```

**And the flip is live.** With the options pane still open, `data-theme` was
switched to `paper` **without a reload**, and the same four chips re-read as
`#F2D648`, `#6FD6A8`, `#7EC8F0`, `#F58BB0`. That is what makes the ⌘K toggle
honest: somebody turning the lights up mid-sentence sees the swatches follow.

Light is otherwise unchanged — `inkFor` returns its input when the page is light,
so the day picker is byte-identical to what it was.

**Card colours were deliberately not touched** and were re-checked after: a card is
a fill, not a mark. A Paper card is still white at night, with `inkOn()` choosing
dark text to sit on it, which is correct.
