# 038 — The brand body typeface never rendered, on any screen

**Status:** fixed
**Severity:** major
**Found by:** screen scoring · `canvas › SaveIndicator` · 2026-09-16
**Surface:** app **and** site › every screen, both themes, every width
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** 2026-09-16
**Blocked on:** —

## What happened

Reading the computed styles of the live save line, its font came back as the
Windows system stack rather than DM Sans. That turned out not to be about the save
line at all.

**Every piece of body text in Jotacular — app and marketing site, light and dark,
every width — was rendering in the operating system's UI font.** On this machine
Segoe UI; on a Mac, SF; on Android, Roboto. Never DM Sans, which `design.md` names
as the body face and which `layout.tsx` downloads on every page load.

## How it was measured

Not by eye. The same string was laid out at the spine's own size and weight in the
font the page actually resolved, and then in each candidate, and the widths compared.
An exact match is the same font; there is no judgement in it.

**Before the fix**, on `/n/[id]`:

```
asRendered  173.19        <- what the spine actually draws
ifSegoe     173.19        <- exact match
ifDmSans    174.78
```

**The same probe on the marketing home page**, matching each element to its nearest
candidate:

| Element | Renders as | Should be |
| --- | --- | --- |
| `h1` — *"Don't organize it. Just jot it."* | **Nunito** ✓ | Nunito |
| the Caveat accent — *"the corner by the window"* | **Caveat** ✓ | Caveat |
| body paragraph — *"Write it, type it, say it, or snap it…"* | **Segoe UI** ✗ | DM Sans |

All three deltas were exactly `0`. Two of the three brand faces worked. The third —
the one that carries almost every word in the product — did not.

**The webfont was never the problem.** `document.fonts.load('400 16px "DM Sans"')`
resolves immediately; the file is linked, served and available. Nothing ever asked
for it.

## The cause — one token, lost to a layer

`globals.css` sets the brand fonts in `@theme`, which is correct and reads correctly:

```css
@theme {
    --font-sans: 'DM Sans', Inter, ui-sans-serif, system-ui, sans-serif;
    --font-head: Nunito, 'DM Sans', ui-sans-serif, system-ui, sans-serif;
    --font-mono: 'JetBrains Mono', ui-monospace, monospace;
    --font-hand: Caveat, ui-rounded, cursive;
}
```

In the compiled sheet, `--font-sans` is declared **twice**:

```
line    6:  @layer theme, base, components, utilities;

line    9:  @layer theme { :root, :host {
              --font-sans: 'DM Sans', Inter, ui-sans-serif, system-ui, sans-serif;

line 3160:  @layer base  { :root {
              --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", …
```

The second is Silica's preset — the same `:root` rule that sets `--color-base-100`
and `--color-primary`. Both selectors are `:root`, so **specificity never decides
it: the later layer does.** Line 6 puts `base` after `theme`, so Silica wins, every
time, everywhere.

### Why the other two faces survived

Because Silica's base block declares exactly four font tokens — `--font-sans`,
`--font-serif`, `--font-mono` and nothing else. `--font-head` and `--font-hand` are
Jotacular's own names, Silica has never heard of them, and they came through
untouched.

**That is what made this invisible for so long.** Headings were Nunito and the
napkin accent was Caveat, so every screen looked like the design system had been
applied. The one face nobody could name by looking at it was the only one missing.

`--font-mono` was lost the same way, which is why `.jd-prose code` was not
JetBrains Mono either.

## Why it matters

**It is the widest defect this exercise has found.** Not one screen — all of them,
in both themes, at every width, for every persona. Every Design score already
recorded in [rating.md](../rating.md) was given to a page set in the wrong body face.

**It is also the exact shape the rulebook warns about.** Nothing is broken, nothing
errors, no suite can see it, and the page looks deliberate: a well-set system font
in a good layout reads as a choice. `pnpm site:smoke`, typecheck, lint and the
production build were all green across it, and stayed green after the fix — none of
them can tell one sans-serif from another.

**And it is a cross-package trap, not a typo.** The app's CSS is correct on its own
terms. It was defeated by a package it imports, through a mechanism — cascade layers
— where being right and being later are different things.

## The fix

Assert the two lost tokens **unlayered**. Unlayered declarations beat every layered
one regardless of order, so this cannot be lost again to whatever Silica adds next:

```css
/* UNLAYERED, and it has to be. Silica's preset re-declares `--font-sans` and
 * `--font-mono` on `:root` in `@layer base`, which beats `@theme` outright --
 * so the brand body face never rendered anywhere. Issue 038. */
:root {
    --font-sans: 'DM Sans', Inter, ui-sans-serif, system-ui, sans-serif;
    --font-mono: 'JetBrains Mono', ui-monospace, monospace;
}
```

**The `@theme` block stays exactly as it is.** It is what generates the `font-sans`
and `font-mono` utilities, and removing the keys would take those with it. The new
rule changes only what the variable resolves to.

### Two shapes not taken

**Fix Silica's preset.** Correct in principle and wrong here: `@wizeworks/silicaui`
is shared with other products, and a font opinion is the last thing a shared preset
should carry from one of its consumers.

**Re-declare inside `@layer base` after the import.** Works, and depends on import
order staying as it is forever. The unlayered rule does not depend on anything.

## Confirmed by

**2026-09-16.** The identical probe, same string, same size and weight, before and
after:

| | before | after |
| --- | --- | --- |
| spine, as rendered | **173.19** | **174.78** |
| if DM Sans | 174.78 | **174.78** ← exact match |
| if Segoe UI | **173.19** ← exact match | 173.19 |

And the marketing home page re-measured, all three deltas `0`:

```
h1          -> nunito    "Don't organize it. Just jot "
handAccent  -> caveat    "the corner by the window"
paragraph   -> dmSans    "Write it, type it, say it, o"
```

`pnpm typecheck`, `pnpm lint`, `pnpm site:smoke` and `pnpm web:build` all pass.

## Rating effect

**Every Design score in [rating.md](../rating.md) was awarded against the wrong body
face**, so strictly all 54 predate this fix. They are not being re-scored: the
deduction this would have earned is typographic and uniform, it applied equally to
every row, and re-walking 54 screens to move each one by the same amount would teach
nobody anything.

What is recorded instead is this line, and the fact that from here on a Design score
is given against a page set the way `design.md` specifies. Rows scored after this
point say so.
