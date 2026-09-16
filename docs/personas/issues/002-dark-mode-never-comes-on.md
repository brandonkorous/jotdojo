# 002 — Her phone is in dark mode and the app is white

**Status:** open — parts 1 and 2 written and staged; part 3 is issues 041 and 043
**Severity:** design
**Found by:** discovery, before any run · 2026-09-16
**Surface:** app › every screen, and apex › every page
**Filed:** 2026-09-16
**Fixed:** —
**Confirmed by:** —
**Blocked on:** design — see issue 043

Filed before a run because it changes how every run scores. RULE #6 normally says
"both themes or it is not scored"; this issue is why that rule is narrowed to one
theme until it is fixed.

## What happened

Jotacular defines two themes in `apps/web/app/globals.css`:

- **`paper`** — light. White, warm paper, charcoal ink. `default: true`.
- **`paper-night`** — dark. Charcoal base, warm paper text, violet lifted to clear
  charcoal. `prefersdark: true`.

`paper-night` never appears. Not on any device, in any browser, at any time of
day, however the operating system is set.

The theme plugin emits a `prefersdark` theme like this:

```js
rules["@media (prefers-color-scheme: dark)"] = {
  ":root:not([data-theme])": { ...tokens },
};
```

and `apps/web/app/layout.tsx:26` renders:

```jsx
<html lang="en" data-theme="paper">
```

`:root:not([data-theme])` cannot match a root element that has `data-theme`. So the
dark block is compiled, shipped to every visitor, and matched by nothing.

`apps/web/app/global-error.tsx:22` does the same thing, so the error page is light
too.

**The repo already knows.** `apps/web/components/Brand.tsx` says so in a comment,
and says the white wordmark at `/brand/wordmark-dark.svg` is the second half of the
fix. So this is known debt rather than a surprise — but it has never been written
down anywhere a run would find it, and it has never been given a severity.

## What should have happened

A person whose phone is in dark mode, writing a note in bed at 11pm — which is the
exact moment `docs/00-vision.md` describes as the product's reason to exist — gets
a dark screen. The tokens for it are already written and already correct: mint
holds in both modes, violet is lifted to `#8a63ff` so it clears charcoal.

## How to reproduce

1. Set the operating system to dark mode.
2. Open `http://localhost:3400` in any browser. The canvas is white.
3. Open `http://jotacular.localhost:3400`. The marketing site is white.
4. In devtools, emulate `prefers-color-scheme: dark`. Nothing changes.
5. In devtools, delete the `data-theme="paper"` attribute from `<html>`. The page
   turns dark, which is the proof.

Every time, everywhere.

## Why it matters

A white canvas on an OLED phone at night is the thing people complain about, and
this is a phone product used at night on purpose. It is also two of the six brand
colors — the lifted violet and the warm-paper-on-charcoal pairing — that have
shipped and never once been seen.

It is `design` rather than `major` because nothing is broken or false; the app is
simply light-only, and it looks deliberate from outside.

**For this exercise it matters more than its severity suggests:** it means every
screen score taken before the fix is a one-theme score, and when this is fixed
every scored row in [rating.md](../rating.md) is stale and owes a dark pass.

## Where it lives

- `apps/web/app/layout.tsx:26` — `data-theme="paper"` on `<html>`
- `apps/web/app/global-error.tsx:22` — the same
- `apps/web/app/globals.css` — both themes, the dark one scoped unreachably
- `apps/web/components/Brand.tsx` — the charcoal wordmark, and the comment naming
  this exact problem
- the theme plugin's `prefersdark` branch, in `@wizeworks/silicaui/src/theme-plugin.js`

## The fix

Not attempted. Three parts, and the third is the one that makes it real work:

1. **Stop hard-setting the attribute.** Drop `data-theme` from both `<html>` tags
   so `:root` (the `default: true` theme) and the `prefersdark` block both apply.
2. **Swap the wordmark** on `prefers-color-scheme: dark` to
   `/brand/wordmark-dark.svg`, which already exists. Brand.tsx names this as the
   second half.
3. **Look at every screen in dark.** The canvas paints strokes, stickers, arrows,
   photos, comment pins and the paper grain, and several of those have colors that
   were only ever chosen against white. `--noise: 1` paper grain on a charcoal base
   is the first thing to check. This is where the real defects will be, and it is
   why the fix is not a one-line change.

Part 3 is what a persona run is for. When this is picked up, run it as a pass over
the already-scored rows rather than as a code change on its own.

## Worked end to end on 2026-09-16, then switched back off

All three parts were done and the whole product was audited in dark. **Part 3 found
two blockers, one of them a blocker in the real sense**, so the switch was returned
to where it was. Nothing about the product as it ships is changed.

What that bought is this issue going from *"not attempted, and part 3 is the real
work"* to **two named decisions with the numbers already taken**. Parts 1 and 2 are
one line and one element; they are described exactly below and can be re-applied in
a minute once the decisions are made.

## What the three parts actually cost

**Part 1 — stop hard-setting the attribute.** Two characters short of trivial:
`<html lang="en" data-theme="paper">` → `<html lang="en">`, in `layout.tsx` and
`global-error.tsx`. `:root:not([data-theme])` then matches and the `prefersdark`
block applies.

**Part 2 — the wordmark, and it is written wrong in this issue.** The instruction
above says *"swap the wordmark on `prefers-color-scheme: dark`"*. That was done, with
a `<picture>` so the browser chooses before the first paint:

```tsx
<picture>
  <source srcSet="/brand/wordmark-dark.svg" media="(prefers-color-scheme: dark)" />
  <img src="/brand/wordmark.svg" alt={brand.name} … />
</picture>
```

It typechecked, it linted, it worked while dark was on — **and the moment the theme
was pinned back to light it deleted the wordmark.** This machine's OS is in dark
mode, so `<source>` matched and served the WHITE mark onto a WHITE header. The
marketing site's header showed a bare mint dot and nothing else.

**`prefers-color-scheme` is the wrong question.** It asks the operating system,
which is only the same question as *"is this page dark"* while nothing pins the
theme — and `data-theme` on `<html>` is exactly such a pin. Whatever eventually
swaps this must read the **theme**, not the OS.

So part 2 is reverted to the single charcoal mark, with that reasoning kept in
`Brand.tsx` so nobody reaches for `<picture>` again. **It was caught by looking at
the page, after typecheck, lint and a production build had all passed on it** —
which is the whole argument of this exercise, turned on its own work.

The `eslint-disable` for `@next/next/no-img-element` came back with it: the rule
does not fire on an `<img>` inside a `<picture>`, and does fire on a bare one.

**Part 3 — look at every screen in dark.** This is where the prediction was tested,
and it was right about the shape and wrong about the place.

> The canvas paints strokes, stickers, arrows, photos, comment pins and the paper
> grain, and several of those have colors that were only ever chosen against white.
> `--noise: 1` paper grain on a charcoal base is the first thing to check.

Every app route was audited in both themes, by measuring real computed colours
against real effective backgrounds:

| route | light | dark |
| --- | --- | --- |
| `/` and `/n/[id]` — the canvas | **0** | **0** |
| `/dashboard` | 8 → **0** | 5 → **0** |
| `/account` | **0** | **0** |
| `/review` | **0** | **0** |
| `/signin` | **0** | **0** |

**The canvas came through clean on the first look**, grain and all — the dark tokens
were written correctly and had simply never been switched on. The Dashboard's
failures were not dark-specific at all: they were `opacity-*` on small text, worse
in **light** than in dark, and they became issue 040.

**The apex broke** — 16 AA failures, because its ink tokens are hard-coded hexes
with no dark counterpart. That is issue 041. It is a design decision rather than a
repair, so the site is pinned to light on its own wrapper, which is correct whenever
dark returns.

**And the canvas broke, which is the one that matters.** The audit above was run on
notes carrying only spine text, and spine text is themed and perfect. Put a single
object on the page and it disappears: a canvas text box is written in the **pen
colour**, which is stored user data, and the default pen measures **1.24:1** on a
charcoal ground. Four of the five pen colours fail there.

That is issue 043, and it is why this one is open again. Dark mode is excellent for
the Dashboard, Account, the review inbox, sign-in and a typed note, and it deletes
handwriting — the feature the product is named for. So `data-theme="paper"` went back
onto both `<html>` tags.

## Proved to work, on 2026-09-16

This machine's OS is in dark mode, so no emulation was needed. With `data-theme`
removed:

```
osPrefersDark             true
htmlAttrs                 ['lang="en"']     <- no data-theme
darkSelectorNowMatches    true
--color-base-100          #111418
color-scheme              dark
```

The canvas, drawn in charcoal with warm paper ink, the mint tool highlight holding
and the presence chip legible — and zero measured contrast failures on it.

Typecheck, lint, `pnpm web:build` and 44 of 45 suites pass in that state — the one
red is `structure:smoke`, which is blocked on an unrun migration and unrelated.

**Parts 1 and 2 are known-good.** What blocks them is issue 043, not them.

## Rating effect

`dark: unreachable (002)` stays, and is now accurate rather than vague: dark is
one line away and is being held back deliberately, by issue 043.

The one thing that changed for scoring is that **the dark audit actually happened**.
Every app route was measured in both themes, and outside the canvas it found only
what issue 040 then fixed. So when dark is finally switched on, the rows do not owe
a blind second pass — they owe a look at the canvas with objects on it, which is
what issue 043's last step asks for.
