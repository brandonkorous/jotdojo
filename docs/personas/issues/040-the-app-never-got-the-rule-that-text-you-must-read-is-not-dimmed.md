# 040 — The app never got the rule that text you must read is not dimmed

**Status:** fixed
**Severity:** major
**Found by:** the dark pass for issue 002 · `/dashboard` · 2026-09-16
**Surface:** app › 14 files, 33 places — every account section, the Dashboard, the consent screen, the review inbox, sign-in
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** 2026-09-16
**Blocked on:** —

## What happened

Measuring the Dashboard's contrast turned up the timestamp under every note row:

```
2.50 : 1   [mt-1 text-xs opacity-40]  "9/16/2026, 10:23:24 AM"   light
3.35 : 1   [mt-1 text-xs opacity-40]  "9/16/2026, 10:23:24 AM"   dark
```

12px text needs **4.5:1**. It has 2.5 on paper. That timestamp is the only thing
separating one `Untitled` row from the next, which is exactly the situation issue
013 leaves Marisol in.

## This rule already exists, and the app is the half that never got it

`docs/10-design-system.md` has a section called **"Text you must read is not
dimmed"**:

> **No `opacity` on text on the marketing site. None.** Not on body copy, not on
> navigation, not on a date, a price cadence or a bullet glyph.
>
> Dimming text is a habit rather than a decision. It costs contrast, it fails users
> who need it most, and it makes a page look tentative. And alpha does not produce
> a quieter ink — it produces the same ink half-applied, which on a page whose whole
> material argument is *paper* reads as a page that has not finished loading.
>
> Genuinely secondary text gets **`--ink-2`**, a real flat colour.

It then counts the work: *"Twenty-six rules broke this before ADR-076… Seven more
survived that pass by claiming to be metadata, and went in ADR-082."*

**Thirty-three rules in the app broke it and were never counted**, because every
word of that section says "the marketing site". The same document, twelve lines
further down under *Accessibility*, does not:

> **WCAG AA for all text.** Silica's `contrastWarnings` is a publish gate, not a
> suggestion.

## What the numbers actually are

Measured in the running app, for `--color-base-content` at each alpha over each of
the three surfaces, in both themes:

| | 40% | 50% | 60% | 70% | alpha needed for 4.5 |
| --- | --- | --- | --- | --- | --- |
| light on base-100 | 2.59 | 3.48 | 4.82 | 6.87 | **58%** |
| light on base-200 | 2.55 | 3.40 | 4.67 | 6.55 | **59%** |
| light on base-300 | 2.50 | 3.31 | **4.49** | 6.20 | **61%** |
| dark on base-100 | 3.57 | 4.90 | 6.55 | 8.53 | 48% |
| dark on base-200 | 3.55 | 4.79 | 6.31 | 8.12 | 48% |
| dark on base-300 | 3.35 | 4.40 | 5.64 | 7.10 | 51% |

Read across: **`opacity-40` fails on every surface in both themes.** `opacity-50`
fails everywhere in light. `opacity-60` — the value 20 of the 33 used — misses by
**0.01** on light base-300, which is the Dashboard's own background.

That last row is the whole argument against alpha as a mechanism. Nobody picked
`opacity-60` believing it was 4.49:1; it is a number that feels like "a bit
quieter" and happens to land one hundredth under a hard gate.

## The fix

The one `docs/10` already specifies — a real flat colour, not alpha:

```css
/* Secondary ink as a REAL colour, which is what docs/10 asks for: "alpha does
 * not produce a quieter ink -- it produces the same ink half-applied". Mixed
 * toward base-300, the darkest surface, so it clears AA on all three. */
:root {
    --ink-2: color-mix(in oklab, var(--color-base-content) 70%, var(--color-base-300));
}

.jd-quiet {
    color: var(--ink-2);
}
```

and `opacity-40|50|60` → `jd-quiet`, 33 places in 14 files.

**Mixed toward base-300 on purpose**, because that is the worst case: a colour that
clears AA against the darkest surface clears it against the two lighter ones with
room to spare. And it is `color-mix` rather than two hard-coded hexes so it tracks
whatever the themes do next — which is precisely the mistake the marketing site
made and issue 041 is about.

The files: `account/page.tsx`, `dashboard/page.tsx`, `oauth/authorize/page.tsx`,
`review/page.tsx`, `signin/page.tsx`, `CaptureTokens.tsx`, `ConnectToClaude.tsx`,
`Connections.tsx`, `ExportSection.tsx`, `Fallback.tsx`, `PlanSection.tsx`,
`ReviewList.tsx`, `TranscriptCard.tsx`, `TriageSwitch.tsx`.

## What it costs, said plainly

**Three alphas became one colour.** Where a screen used `opacity-60` for a preview and
`opacity-40` for the timestamp beneath it, those were two steps of quiet and are now
one. On the Dashboard the two lines are still told apart — 14px against 12px — but by
size alone.

That is what `docs/10` asks for in the same breath: *"say 'secondary' with size, weight
or position; if something is so secondary it must be greyed to be bearable, cut it."*
So the collapse is the rule working rather than a casualty of it. It is still a visible
change to five or six screens and deserves a designer's eye, which is why it is written
here rather than left to be noticed.

The alternative — two `--ink-2` steps, one per old alpha — was not taken because the
lower one would have to clear 4.5:1 anyway, which puts it within a hair of the upper
one. Two tokens that resolve to nearly the same colour are worse than one.

## Confirmed by

**2026-09-16.** Every app route audited in both themes, after the change:

| route | light | dark |
| --- | --- | --- |
| `/dashboard` | **0** | **0** |
| `/account` | **0** | **0** |
| `/review` | **0** | **0** |
| `/signin` | **0** | **0** |
| `/n/[id]` | **0** | **0** |

`grep -rn "opacity-40\|opacity-50\|opacity-60" apps/web/app apps/web/components` →
**0 matches.** Typecheck, lint and the production build pass.

### Two false alarms, recorded because they nearly became findings

The auditor that found this was wrong twice before it was right, and both mistakes
looked exactly like defects:

- It parsed `oklch(0.95 0.004 250)` with an `rgb` regex and reported the Dashboard's
  **"Personal" badge at 1.62:1**. The badge is near-white on charcoal — about 12:1.
  Fixed by resolving every colour through a canvas instead of a regex.
- It read each element's **parent's** background rather than the element's own, and
  reported **"Back to the canvas" at 1.12:1** in light. That button is charcoal on
  paper — about 14:1.

Both were checked against a direct measurement before anything was filed. RULE #4
cuts both ways: a number that has not been verified is not a measurement either.

## Rating effect

Every screen scored from here reads at AA in both themes. The rows scored before
this — and before issue 038 — are noted as such in [rating.md](../rating.md).
