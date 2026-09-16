# 041 — The marketing site has no dark palette, so it is pinned to light

**Status:** open — the pin is in place and is now inert; see issue 043
**Severity:** major
**Found by:** the dark pass for issue 002 · apex home · 2026-09-16
**Surface:** apex › every page
**Filed:** 2026-09-16
**Fixed:** — (pinned to light 2026-09-16; the palette itself is not written)
**Confirmed by:** 2026-09-16, for the pin
**Blocked on:** design

## What happened

Issue 002's parts 1 and 2 are done, so `prefers-color-scheme: dark` now reaches the
page. Part 3 of that issue predicted what would happen next:

> The canvas paints strokes, stickers, arrows, photos, comment pins and the paper
> grain, and several of those have colors that were only ever chosen against white.
> **This is where the real defects will be.**

It was right about the shape and wrong about the place. **The app came through
clean** — zero contrast failures on every route in dark. The marketing site did not:

```
apex home, dark, after revealing every band:   16 AA failures
apex home, light:                               3
```

## What it looked like

The page **half-flipped**. Everything driven by `--color-base-*` went charcoal, as
designed. Everything driven by the site's own ink tokens stayed exactly where it
was, because those tokens are hard-coded hexes:

```css
.jd-site      { --ink-2: #4c5257; }   /* a mid-grey, chosen against paper */
.jd-band-ink  { --ink-2: #c2c8cf; }   /* a light grey, for the dark band */
.jd-band-mint { --ink-2: #0d3f37; }   /* a dark teal, for the mint band */
```

`#4c5257` on paper `#ece6da` is 6.2:1 — correct, and the ADR-082 comment beside it
explains why it is a colour and not an alpha. The same `#4c5257` on charcoal
`#181c21` is **2.16:1**, and that one value accounts for most of the sixteen:

```
2.16  [jd-hero-status]  "Nothing to sign up for. Start typing o…"  rgb(76,82,87) on rgb(24,28,33)
2.16  [jd-story-gap]    "You put the phone away and go back to …"  rgb(76,82,87) on rgb(24,28,33)
2.16  [font-head]       "Product"                                  rgb(76,82,87) on rgb(24,28,33)
2.16  [] "© 2026 WizeWorks"                                        rgb(76,82,87) on rgb(24,28,33)
1.80  [] "A place to put things, not a system to…"                 rgb(76,82,87) on rgb(38,43,50)
```

And the ink band inverted outright — `#c2c8cf`, a light grey meant for a dark
ground, ended up on paper white at **1.52:1**:

```
1.52  [jd-fineprint]  "Jotacular works with MCP-compatible ag…"  rgb(194,200,207) on rgb(247,243,234)
1.68  [chat-header]   "You · three weeks later"                  rgb(60,66,71) on rgb(24,28,33)
```

`.jd-band-mint` is the one that held, and its comment says why — *"this band holds
its colours across both themes and base-300 does not"* (ADR-089). One band was
written to survive a theme change. Eight were not.

## Why this is a design decision and not a bug fix

The site is not a set of components with a token that needs re-pointing. It is a
**composed page of bands** — paper, ink, mint, story — whose whole argument is
material. `docs/10` spends a section on it. A dark version has to answer questions
no measurement can:

- Does the paper band become charcoal, or stay paper on a dark page?
- Does the mint full-bleed band stay mint at night, or is mint at that area too loud
  on a dark screen — the exact objection ADR-082 raised and ADR-089 answered *for
  the light page only*?
- The hero quotes the real canvas. Does it quote the light canvas or the dark one?
- The wordmark now has a white variant (issue 002, part 2). Which bands take it?

Picking hexes to clear 4.5:1 would answer none of those and would ship a page that
passes an audit and looks like nobody chose it.

## The interim fix, and what it costs

The site is **pinned to the light theme** until it has a palette:

```tsx
/**
 * Pinned to the light theme, on purpose and for now. Issue 041.
 *
 * `--ink-2` and the band inks here are hard-coded hexes chosen against paper,
 * with no dark counterpart, so the moment dark became reachable (issue 002)
 * this page half-flipped: base-driven surfaces went charcoal and the inks
 * stayed light, at 16 measured AA failures. The app has real dark tokens and
 * keeps them; the site gets a dark palette when somebody designs one.
 */
<div className="jd-site" data-theme="paper">
```

`data-theme` on the wrapper works because custom properties inherit, so the whole
subtree takes the light palette whatever the root is doing.

**What it costs is honest to say:** a visitor whose phone is in dark mode still gets
a white marketing page. That is exactly what issue 002 described as the complaint —
but it is what shipped yesterday and the day before, so this changes nothing for
them. What changes is that the app behind it is now dark, which is where they write.

**What it buys** is that dark could be turned on for the app at all. The alternative
was to leave `data-theme="paper"` hard-set on `<html>` and keep the canvas white at
11pm to protect a marketing page.

## Confirmed by

**2026-09-16.** The apex home page, with this machine's OS in dark mode, every band
revealed by scrolling:

```
osPrefersDark   true
siteTheme       "paper"      <- the pin
htmlHasTheme    false        <- the root is free, so the app is dark
--ink-2         #4c5257
background      rgb(255,255,255)
failures        1            <- was 16
```

The one survivor is not about dark at all — it is mint on paper, and it is issue
042.

**Since that measurement, dark mode was switched back off** for a different reason
— stored ink is invisible on a charcoal canvas, issue 043 — so this pin currently
changes nothing anybody can see. It is left in place deliberately: it is correct,
it is inert while `<html>` pins light, and it is one of the two things that has to
be true before dark can be switched on again.

## What finishing this looks like

1. Design the dark palette as a palette, band by band, answering the four questions
   above.
2. Redeclare `--ink-2` per band under the dark theme, or replace the hexes with
   `color-mix` against the band's own ground so they cannot drift again.
3. Swap the bands' wordmark to `/brand/wordmark-dark.svg` where the ground is dark.
4. Remove the pin, and re-run this audit expecting zero.

## Rating effect

Apex rows are scored **light only**, and now say so rather than saying
`dark: unreachable (002)` — the difference matters: dark is reachable, and the site
is deliberately opted out of it.
