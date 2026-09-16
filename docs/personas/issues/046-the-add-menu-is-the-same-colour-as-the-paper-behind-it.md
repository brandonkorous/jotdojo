# 046 — The ⊕ menu is exactly the same colour as the paper behind it

**Status:** fixed
**Severity:** minor
**Found by:** the dark pass owed by issue 002 · 2026-09-16
**Surface:** app › A note (the canvas) › the ⊕ Add menu
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** the canvas, both themes · 2026-09-16
**Blocked on:** —

## What happened

The ⊕ menu opens over the canvas and its panel is `#111418`. The writing surface
behind it is `#111418`. **Measured at 1.00:1 — they are the same colour.**

What separates the menu from the page it floats over is a 1px border at **1.30:1**
and a drop shadow of `rgba(0, 0, 0, 0.22)`, which is black on a near-black page and
therefore does nothing at all.

In light it is fine, and the comparison is the whole point:

| | light | dark |
| --- | --- | --- |
| paper | `#ece6da` | `#111418` |
| panel | `#ffffff` | `#111418` |
| **panel vs paper** | **1.24:1** | **1.00:1** |
| shadow | black 22% — reads on warm paper | black 22% — invisible |

A white card lifted off beige paper becomes a charcoal card on charcoal paper.

## What should have happened

A menu floating over a page should look like it is floating. In light that is done
by making the raised surface **lighter** than the page. In dark the same rule gives
the opposite instruction — lighter still — and nothing applies it.

## Where it lives

`apps/web/components/AddMenu.tsx:53` renders Silica's `DropdownMenuContent`, and
**nothing in this repo styles `.dropdown`.** The values above are Silica's defaults,
which are written for a light ground.

**This is the same shape as issues 041, 042 and 043**: a hard-coded value where a
token exists, so it cannot follow the theme. Here the literal is the shadow's
`rgba(0, 0, 0, 0.22)`.

**The repo already solved this, ten lines away.** `apps/web/app/styles/canvas.css:90`
gives every piece of app chrome a shadow mixed from the INK colour rather than from
black:

```css
/* Not a border. A soft, wide shadow lifts the pill off the canvas without
   drawing the hairline that would make it read as a docked panel. */
box-shadow: 0 6px 24px -8px color-mix(in oklch, var(--color-base-content) 22%, transparent);
```

In dark, `--color-base-content` is warm paper, so that shadow becomes a soft light
glow and the toolbar lifts correctly. **The toolbar is right in dark for exactly the
reason the ⊕ menu is wrong.**

## Why it is only `minor`

Nothing is unreadable: the menu's own text measures well against its own background,
which is why the contrast audit reported 0 failures on this route in both themes. A
contrast audit asks whether text can be read, not whether a panel can be seen. The
menu is findable, usable and correct — it just does not look like a menu.

It is filed because it is the **first thing the dark pass found that a contrast
audit structurally cannot**, which is the argument for doing the pass by looking.

## Scope

`AddMenu.tsx` is the **only** component in the app using Silica's `DropdownMenu`, so
this is one panel, not a class of them.

Checked and NOT affected:

- **The ⌘K palette** is also `#111418`, but it renders over a scrim that dims the
  page, so it separates. Correct as it stands.
- **The toolbar, tool options and pen size** use `.jd-chrome.glass`, which carries
  the ink-mixed shadow above. Correct.

## How to reproduce

1. Open a note on the canvas with the OS in dark mode, or pick Night in ⌘K.
2. Click ⊕.
3. The menu's edge is a faint hairline. There is no sense of a panel over a page.

Every time.

## The fix

Give the dropdown what the app chrome already has. One rule, in `canvas.css`,
beside the one it is copying.

## Confirmed by

**2026-09-16**, on the real canvas, the same screen it was found on.

The rule added to `canvas.css`, beside `.jd-chrome`'s:

```css
.dropdown[class][class] {
  box-shadow: 0 6px 24px -8px color-mix(in oklch, var(--color-base-content) 22%, transparent);
  border-color: color-mix(in oklch, var(--color-base-content) 16%, transparent);
}
```

Measured on the open menu:

```
dark   shadow  was  rgba(0, 0, 0, 0.22)          <- black on #111418, does nothing
       shadow  now  oklch(0.9647 ... / 0.22)     <- warm paper, a glow that lifts
       border  was  rgb(38, 43, 50)    1.30 vs paper
       border  now  rgb(54, 55, 59)    1.55 vs paper

light  unchanged in appearance: a white panel on warm paper, 1.24:1,
       and the shadow is still dark because the ink still is
```

**The panel background is deliberately left alone.** It is still `#111418` in dark,
the same as the paper, and the lift comes entirely from the rim and the glow — which
is exactly how `.jd-chrome` lifts the toolbar, on the same page, and that reads. One
mechanism for elevation is better than two.

At **360px**, in a same-origin iframe (a desktop window will not go that narrow),
both themes, menu open:

```
viewport 360   panel left 15, right 207   overflows: none
document.scrollWidth 360                  no horizontal page scroll
shadow oklch(0.9647 ...) in dark          the glow is applied at this width too
```

Looked at in both themes at both widths: the menu reads as a panel over a page, its
corners are distinct against the ground, and the note title behind it is cleanly
occluded rather than bleeding through.
