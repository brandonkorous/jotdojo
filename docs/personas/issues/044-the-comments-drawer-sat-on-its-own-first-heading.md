# 044 — The comments drawer sat on its own first heading

**Status:** fixed
**Severity:** minor
**Found by:** screen scoring · `canvas › RemarksDrawer` · 2026-09-16
**Surface:** app › the canvas — the Comments drawer
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** 2026-09-16
**Blocked on:** —

## What happened

Opening the Comments drawer, the first section label read as a row of sliced
letters — the bottom halves of **THIS PAGE** with the tops cut off, sitting right
against the header's rule.

Measured at rest, with the panel not scrolled at all:

```
.drawer-header   painted  top  24  ->  bottom 107    background rgb(255,255,255), z-index 1
.jd-remarks-heading       top  99  ->  bottom 114    height 15
```

**Eight of the heading's fifteen pixels are under an opaque white header.** Not a
scroll artefact: `scrollTop` was 0 and the panel was not scrollable.

## The cause, from the compiled stylesheet

Two Silica rules that are each fine alone:

```css
.drawer-header {
  margin-inline: -1.5rem;
  padding-inline: 1.5rem;
  &:first-child {
    margin-block-start: -1.5rem;    /* bleed into the panel's inset */
    padding-block-start: 1.5rem;    /* and put it back, visually */
  }
}
.drawer-header-sticky {
  position: sticky;
  top: 0;
  z-index: 1;
  background-color: var(--color-base-100);
}
```

The `:first-child` pair is the ordinary "let the header bleed to the panel edge"
trick. It works because the negative margin shrinks the header's **layout** box
while its padding keeps the **painted** box the same size — the content below
follows the smaller box, and the header's own padding fills the difference.

`sticky` breaks that bargain. A sticky element paints where it is pinned rather
than where it was laid out, so the 1.5rem the negative margin gave away is never
given back — the header paints 1.5rem taller than the room reserved for it, and
lands on whatever is underneath.

## Proved by changing one thing at a time

Each candidate applied to the live panel, measuring the gap between the header's
bottom and the first section's top. Negative is an overlap:

| | gap |
| --- | --- |
| as shipped | **−8** |
| drawer's own `padding-top: 0` | −8 — not the cause |
| **header `margin-block-start: 0`** | **+16** |
| **header not `sticky`** | **+16** |
| first section `margin-top: 1rem` | +8 — treats the symptom |

Two things fix it and they are the two ingredients named above. The panel's own
padding is innocent.

## The fix

**Silica is a shared package and this is not the place to edit it.** The override
lives in our own sheet, scoped to exactly the broken combination — a sticky header
that is also a first child — so a non-sticky drawer header keeps the bleed it was
designed for:

```css
/* Silica bleeds a first-child DrawerHeader into the panel's inset with
   `margin-block-start: -1.5rem`, so it reserves 1.5rem less room than it
   paints. Harmless until `sticky` pins it: then it sits ON the first heading. */
.drawer-header-sticky:first-child {
  margin-block-start: 0;
}
```

**The header does not move.** Before and after, its box is `top 24 → bottom 107`
and its title sits at 48. The only thing that changes is that the content starts
below it instead of under it.

**Worth passing upstream.** `<DrawerHeader sticky>` as a first child is wrong in
Silica itself, not only here, and any other product that reaches for the sticky
variant will meet this. One line of ours is the right local answer; it is not the
right permanent one.

## Confirmed by

**2026-09-16.** The real drawer, reopened on a fresh load:

```
heading top   99  ->  123
gap          -8   ->  +16
header       24 -> 107   (unchanged)
title top    48          (unchanged)
```

**THIS PAGE** reads in full, clear of the rule. Typecheck and lint clean.

## Rating effect

`canvas › RemarksDrawer` was already scored before this — it was scored on a panel
whose first heading was sliced, which is a deduction that was never taken. Its gap
column now names this issue.
