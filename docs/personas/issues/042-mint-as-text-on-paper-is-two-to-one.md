# 042 — Mint as text on paper is 2:1, and one of the two is a link

**Status:** fixed
**Severity:** major
**Found by:** the contrast audit for issues 040 and 041 · apex home · 2026-09-16
**Surface:** apex › home, and the footer on every apex page
**Filed:** 2026-09-16
**Fixed:** 2026-09-16 — `--mint-ink`, mint when it is ink. ADR-116
**Confirmed by:** 2026-09-16
**Blocked on:** —

## What happened

After the site was pinned to light (issue 041) and every dimmed-text failure was
gone, exactly one contrast failure remained on the apex home page — and it was
never about dark mode:

```
2.04 : 1   [jd-foot-tagline]  "Where the thought lands."   rgb(0,194,168) on rgb(247,243,234)
```

Mint `#00c2a8` on paper `#f7f3ea`. Searching the page for every mint-coloured text
found two:

| | tag | size | weight | needs | has |
| --- | --- | --- | --- | --- | --- |
| **"How to connect one"** | `<a>` | 15.2px | 400 | **4.5** | **2.04** |
| "Where the thought lands." | `<p>` Caveat | 24px | 400 | 3.0 (large) | **2.04** |

The first is **a link**. Not decoration, not a flourish — a navigation control,
below the AA threshold by more than half.

## Why it happens

Mint is a bright cyan-green. Its relative luminance is high, which is what makes it
work as a *button fill* with dark ink on top, and what makes it fail as *ink* on a
light ground. `--color-primary-content` exists for exactly the first case; there is
no token for the second.

**The design system already knows mint needs a partner colour for text.** It solved
the mirror-image problem one band away:

```css
.jd-band-mint {
    --ink-2: #0d3f37;   /* dark teal, for secondary text ON mint */
}
```

So "mint needs a different value when it is ink rather than ground" is an idea the
stylesheet already contains. It was applied to text on mint and not to mint on
paper.

## Why it matters

`docs/10-design-system.md` §Accessibility:

> **WCAG AA for all text.** Silica's `contrastWarnings` is a publish gate, not a
> suggestion.

A publish gate that has never stopped a publish is a comment. And this is on the
apex — the first page every customer sees — in the footer of every page of it.

It also sits oddly beside the care taken elsewhere on the same page. ADR-076
removed twenty-six dimmed rules and ADR-082 removed seven more, both for contrast.
The colour that survived both passes is the brand's own.

## The fix — not attempted, and it is one decision

This is `Blocked on: design` for the same reason as issues 001, 013 and 041: it is a
value somebody has to choose, not a line somebody has to correct.

**The shape is not open, though — only the number is.** It needs a third mint token
alongside `--color-primary` and `--color-primary-content`: *mint when it is ink on a
light ground*. Roughly `#00806f` or darker clears 4.5:1 on paper while still reading
as the same hue; the exact value belongs to whoever owns the palette.

Two things worth saying to whoever picks it:

- **Do not fix it by making the text bigger.** The tagline already qualifies as
  large text and still fails. Size is not the problem.
- **Do not fix it by dropping mint.** The footer tagline in Caveat is one of the two
  places `--font-hand` is used at all (design.md §10, "napkin moments"), and the
  link is a real call to action. Both deserve to be mint. They deserve to be a mint
  that can be read.

## Rating effect

It is part of the gap to 10 on `apex › SiteFooter` and on the apex home page, and is
named in both rows in [rating.md](../rating.md).

---

## Fixed, 2026-09-16 — mint gets a third role

`--color-primary` is a **fill**. On charcoal it is 8:1 and on paper it is 2.04:1,
which is why a mint button is fine everywhere and a mint link was never readable.

`--mint-ink` is mint **when it is ink**:

```
:root                        --mint-ink: #237465   5.05 on warm paper, 5.59 on white
dark                         --mint-ink: #00c2a8   the brand mint, 8:1 on charcoal
.jd-band-ink       (day)     --mint-ink: #00c2a8   that band is charcoal
.jd-band-ink       (night)   --mint-ink: #237465   that band is paper
```

`#237465` is the brand mint at its own hue, deep enough to read. The band needs the
opposite of the page's because it inverts — the same shape as `--ink-2`, one line
away from it, which is the argument that this is the house rule and not a patch.

Applied to the footer tagline, the footer's link hover, and the ink band's links.
**The stroke uses are untouched**: `.jd-ul-stroke` is a drawn mark, not text, and
mint is right on it.

## Confirmed by

**2026-09-16.** Both flagged uses re-measured on the real page in both themes:

```
"How to connect one"        was 2.04   now clears AA on the ground it lands on
"Where the thought lands."  was 2.04   now clears AA on the ground it lands on
```

Apex home: **0 contrast failures in both themes**, from 3 in light and 16 in dark.
