# 10 — Design system

Built on **Silica UI** (`silicaui.com`), the in-house Tailwind v4 design system, and on Jotacular's own brand — see [design.md](../design.md), which is canonical for anything this doc does not settle.

> **Rewritten 2026-08-23 for the rebrand (ADR-072).** Until then this doc said Jotacular
> inherited kanninja's palette and type unchanged. It no longer does. What survives is the
> architecture below the brand line: the `agent` colour role, the canvas-first shell, the
> floating chrome, and the handedness setting.

## Packages

    pnpm add -D @wizeworks/silicaui tailwindcss
    pnpm add @wizeworks/silicaui-react

| Package | Used for |
|---|---|
| `@wizeworks/silicaui` | Tailwind v4 plugin: tokens + component classes. The vocabulary |
| `@wizeworks/silicaui-react` | Typed React components on Base UI. All app chrome |
| `@wizeworks/silicaui-editor` | TipTap + Silica toolbar. **Not in v1** — v1 is plain markdown. Held in reserve |
| `@wizeworks/silicaui-charts` | Not used. There is nothing to chart |

Everything outside the ink canvas is a Silica component. The canvas is a bare `canvas` element with imperative rendering (see [08-ink.md](08-ink.md)); only its floating chrome is Silica.

## Brand: Jotacular's own

| Pigment | Value | Role |
|---|---|---|
| **Mint** | `#00C2A8` | The primary. CTAs, active states, the dot over the `j` |
| **Violet** | `#6A39FF` | The agent, and the underline in the app mark |
| **Charcoal** | `#111418` | The ink. Primary text |
| **Warm paper** | `#F7F3EA` | The page |

Type: **Nunito** (rounded) for headings, **DM Sans** for body and UI, **JetBrains Mono** for
code. DM Sans over Inter because its rounded terminals sit under Nunito without a seam;
Inter stays in the stack as the fallback.

The mark is `jot` — white, on a charcoal tile, with a mint dot over the `j` and a violet
hand-drawn underline. The wordmark is `jotacular`, lowercase, with the mint dot and **no
underline**. Icon is the action; wordmark is the brand. design.md §24.

### No gradients

design.md §12, and it is a rule rather than a preference: no gradient fills, text, borders,
buttons or backgrounds, anywhere. Flat colour and contrast instead. Gradients read as
generic AI SaaS, which is the one thing this product must not look like.

### What replaced the vermillion rule

The old system's strongest constraint was *"one seal per screen"* — vermillion marked the
single most important thing in a view and nothing else. **That rule is retired.** Mint is an
ordinary primary now: it is the CTA colour, so it cannot also be scarce. ADR-073.

What carries the discipline instead is the flat surface and the whitespace. If a screen
feels loud, the answer is fewer elements, not a rationed colour.

## Theme: a declared `paper` theme, not a preset

No preset is close enough to be worth adapting. Declare the house theme against Silica's tokens instead:

    @plugin "@wizeworks/silicaui";

    @plugin "@wizeworks/silicaui/theme" {
      name: paper;
      default: true;
      prefersdark: false;

      --color-base-100: #F7F3EA;   /* warm paper -- the page */
      --color-base-200: #FBF8F2;   /* elevated */
      --color-base-300: #EBE5D8;   /* hairline / rules */
      --color-base-content: #111418; /* charcoal -- the ink */

      --color-primary: #00C2A8;    /* mint */
      --color-accent: #6A39FF;     /* violet */

      --depth: 0;                  /* ink on paper casts no shadow */
      --noise: 1;                  /* paper grain on the themed surface */
      --duration: 120ms;           /* capture must feel instant */
      --font-head: Nunito;
      --font-sans: "DM Sans";
      --font-mono: "JetBrains Mono";
    }

Then `<html data-theme="paper">`. A matching `paper-night` inverts paper and charcoal; mint holds in both, and violet lifts to `#8A63FF` so it clears the dark ground.

`--noise: 1` deserves specific mention — one token puts a subtle grain on the themed surface while cards keep clean fills. For a brand whose base colour is named after paper, it is the highest ratio of atmosphere to effort available anywhere in the system.

**Never hardcode a hex in a component.** Every value above lives in the theme so islands and dark mode resolve correctly. The one sanctioned exception is stroke colour inside the ink canvas — that is user data, not design, and even those swatches are seeded from resolved tokens.

## The extra colour role: `agent`

The most important design decision in the product.

> **Human ink is charcoal. Agent ink is `agent`.**

Everything an agent produced — comments, suggested edits, triage proposals — renders in a visually distinct ink. A person can tell at a glance, anywhere in the product, whether a human or a machine wrote something. It is a safety property expressed as colour, for the cost of one token.

Silica's colour list is open, so register it rather than reaching for a hex:

    @plugin "@wizeworks/silicaui" {
      colors: primary, secondary, accent, neutral, info, success, warning, error, agent;
    }
    @theme {
      --color-agent: #6A39FF;   /* violet */
    }

`colors:` **replaces** the default list, so the eight built-ins are re-listed. Registering properly means `text-agent`, `border-agent`, `badge-agent`, `alert-agent` and every other `*-agent` variant exist automatically, in both modes, with a contrast-measured `-content` ink derived for us.

Violet is deliberate, and it is the brand's own: design.md §11 gives violet the "AI/agent association", which is the job this token already had under a different hue. It is cool where paper is warm, so agent content reads as *visiting* the page rather than belonging to it — and it is the one accent that never appears on a control the user drives.

## Typography

Silica's scale. No magic numbers, never `text-[13px]`.

| Role | Face / size |
|---|---|
| Note body | DM Sans, `text-md` (16px) |
| Note title | Nunito, `text-xl` |
| UI labels | DM Sans, `text-sm` |
| Metadata, provenance, confidence | DM Sans, `text-xs`, muted |
| Marketing headlines | Nunito, `text-5xl`+ |

**Caveat** is available as a handwritten accent, and design.md §10 says sparingly: small
annotations and napkin moments only, never navigation or any string the user must read to
operate the product. It is not loaded unless something actually uses it.

16px minimum for anything editable on iOS — smaller triggers zoom-on-focus and breaks the canvas layout.

## The mark

**`jot`** — white lowercase on a charcoal rounded tile, a mint dot over the `j`, a violet
hand-drawn underline beneath. Flat: no gradient, gloss, bevel or shadow, at any size.

The underline should read as a real quick pen stroke — slightly imperfect, slightly
asymmetric — and never as a drawn rule. The dot stays flat and simple.

At favicon sizes the underline is the first thing to fail; test at 16, 24, 32, 48 and 64px
and keep it a single visible stroke. The icon survives small because it literally says
`jot`.

The wordmark is **`jotacular`**, lowercase always including sentence-initial, charcoal on
light and white on dark, carrying the mint dot and **no underline**. The icon carries the
underline; the wordmark carries the dot. design.md §8.

Both are committed artwork under `assets/brand/`, and `pnpm icons` derives every size the
app serves from them — see `scripts/make-icons.mjs`. The old generator drew a font glyph,
which meant a machine without that font silently produced a blank tile; reading committed
artwork removes that whole class of failure.

## Two rules the marketing pages kept breaking

### Fill the zone

**A section's content spans its band.** No `max-width` that leaves a dead column
down the right of the page.

Running prose still needs a measure -- but a measure is a property of a *paragraph*,
not of a section. A band of pure text gets `.jd-prose-2` and reads in two columns; a
band of items gets a grid. The one thing that may sit narrow is `.jd-lede`, at 52ch,
directly under a heading.

This was wrong site-wide until ADR-076: `--measure: 34rem` inside a 62rem band put
every paragraph at 55% of its own width, left-aligned, with nothing beside it. It
reads as a template nobody finished.

### Text you must read is not dimmed

**No `opacity` on text on the marketing site. None.** Not on body copy, not on
navigation, not on a date, a price cadence or a bullet glyph. The only survivor is
the hero input's `::placeholder`, which is not text anybody is reading.

Dimming text is a habit rather than a decision. It costs contrast, it fails users who
need it most, and it makes a page look tentative. And alpha does not produce a quieter
ink -- it produces the same ink half-applied, which on a page whose whole material
argument is *paper* reads as a page that has not finished loading.

Genuinely secondary text gets **`--ink-2`**, a real flat colour declared on `.jd-site`
and redeclared lighter inside `.jd-band-ink`. Otherwise say "secondary" with size,
weight or position; if something is so secondary it must be greyed to be bearable,
cut it.

Twenty-six rules broke this before ADR-076 -- the main navigation and the one privacy
disclosure that appears nowhere else among them. Seven more survived that pass by
claiming to be metadata, and went in ADR-082.

### One body size, and it has a name

`--body` (1.0625rem) is the marketing site's running text, set on `.jd-site` and used
by every nested rule that needs to name a size. Writing `font-size: 1rem` inside a
section does **not** inherit it -- `rem` resolves against the root -- so a card that
looked like it matched the prose beside it was in fact a step smaller. ADR-082.

### Vertical rhythm

Bands are `clamp(2rem, 4.2vw, 3.5rem)`. A page with more air than content reads as
stretched, and the fix is never to add another section.

## Icons

**Font Awesome Whiteboard Semibold, everywhere, through `components/Icon.tsx`.**
Nothing imports an icon library directly and nothing draws its own SVG glyph.
ADR-083.

- The map lives in `lib/icons.ts`, keyed by the **job** — `remove`, `agent`,
  `zoomOut` — not by the picture. Changing artwork must never mean editing a
  caller.
- **Size with `font-size`, never with `width` and `height`.** A Whiteboard glyph
  is rarely square (`pen-line` is 640x512), and a square box squashes it.
  `.jd-icon` is one em tall and as wide as its own artwork.
- The family is 492 icons, not the whole library. `eraser`, `highlighter` and
  `lasso` are not in it; `SUBSTITUTED` lists what stands in for them —
  `paintbrush`, `arrow-pointer`, and a **trash can** for the eraser. A slashed
  brush was tried and rejected: it sat beside the paintbrush standing in for the
  highlighter, so the rail read "highlighter on, highlighter off". Rubbing out
  and throwing away are the same idea, and the two never appear side by side.
- Installing needs `FONTAWESOME_NPM_TOKEN` — on a laptop, in CI, and as a
  BuildKit secret in `web.Dockerfile`.

## Motion

**A reveal plays once and never plays backwards.** ADR-093.

- Reveals are **one-shot** animations, held paused until an
  IntersectionObserver marks their section seen (`components/site/Reveal.tsx`),
  and never unmarked. `animation-delay` staggers them; `both` fill holds the
  end state.
- **Not `animation-timeline: view()`.** That is a function of scroll position,
  not a trigger — it plays in reverse as you scroll up. Somebody scrolling
  around is looking for something, and the page must not hide it again.
- **It must fail open.** The resting state of a reveal is *invisible*, so
  anything that stops the marking leaves a blank page. Two floors: whatever is
  already on screen reveals from its own rect, and a watchdog reveals
  everything if the observer has not reported in 1.5s. This is not
  hypothetical — the observer does not fire at all in automated Chrome.
- **Never clip text on a range you do not control.** `clip-path` and `width`
  have no legible half-state: caught part way, "Paste one link into Claude's
  settings" reads "…settin". Opacity and transform can be caught anywhere and
  still say the right thing. ADR-092.
- Two animations are deliberately still scroll-driven: the bar's elevation and
  the dot-grid drift. They report where you are rather than deliver content,
  and they are *meant* to run backwards.

## Images

**Every marketing page carries at least one real image.** A page of type on paper is
not "clean", it is unfinished -- and it is the single loudest tell that nobody looked
at the page after writing it.

What counts, in order of preference (design.md §15, §16):

1. **A real situation** -- someone jotting outdoors, a phone at a lake, a photo taken
   during a project. Never stock-photo offices, never a robot, never a glowing brain.
2. **Loose ink illustration** -- simple black lines, a sketch, a handwritten arrow, a
   scribbled circle. The napkin, drawn.
3. **The product itself**, framed -- what the hero does.

Assets live in `apps/web/public/img/`, and that path is in the middleware's
`PASSTHROUGH` (ADR-076) -- without it the apex rewrites `/img/...` to `/site/img/...`
and every image on the marketing site is a broken icon.

## The app shell: canvas-first, two pieces of floating chrome

**The app is a canvas.** Opening `app.jotacular.com` puts a live writable surface on screen — content if there is any, otherwise blank with *Start jotting*. Zero clicks to write.

A dashboard, a notes list, and history all still exist. **They are simply not the landing page.** They are reached from the chrome and return to the canvas.

The canvas is edge to edge. Nothing docks or takes a fixed column. Two floating pieces sit above it:

    +---------------------------------------------------+
    | [pen]                              [ dash | hist ] |  <- nav bar
    | [ink]                                              |
    | [txt]                                              |
    | [mic]            the canvas, edge to edge          |
    | [cam]                                              |
    |                                                    |
    | [ @ ]                                              |  <- avatar, rail foot
    +---------------------------------------------------+
       ^ tool rail (handed side, flippable)

### Tool rail — the handed one

Vertical rail on the user's chosen side. Holds the things you reach for *while working*:

- Pen, and its colour/width popover
- Text box
- Microphone
- Camera
- At the foot: **user avatar — sign-in, account dropdown, space switcher**

The avatar at the foot of a persistent rail is a well-worn pattern (Slack, Discord, Figma) and it keeps account access permanent without spending nav-bar space on it.

### Nav bar — the navigational one

Small, opposite corner from the rail. Holds the things you reach for *between* pieces of work:

- Dashboard
- History / notes list
- Search

Both open as a Silica `Sheet` sliding over the canvas. Neither ever replaces it — closing returns you to exactly where you were, cursor intact.

### Handedness — a real setting

**Setting: *Toolbar side* — Left / Right.** Defaults by form factor, overridable by anyone, stored per user.

| Form factor | Default | Why |
|---|---|---|
| Desktop | Right | A mouse reaches anywhere equally; right matches expectation |
| Tablet + stylus | **Left** | A right-handed writer's hand and forearm cover the right side of the tablet. GoodNotes, Notability and Procreate all keep primary tools left for this reason |
| Phone | Rail becomes a **bottom bar**; the setting controls which end the avatar sits at | Top corners are unreachable one-handed. Capture belongs in the thumb zone |

The setting flips more than the rail's position:

- The nav bar moves to the opposite top corner, so the two never collide.
- Popovers anchor **away from the hand** — a colour picker that opens under the user's palm is worse than no picker.
- Sheets slide in from the rail side, so the hand that opened them is already there.

Ship the setting in M2 alongside ink, but build the layout with the flip in mind from M0 — retrofitting a mirrored layout is far more work than designing for it.

### Behaviour

- Chrome auto-dims to ~40% opacity after 3s of drawing, restores on any pointer movement toward it.
- Nothing ever covers the top-left of the writing area, where a page starts.
- Floating surfaces use `--radius-box`, a hairline `base-300` border, and **no shadow** — the theme is flat by design.

## Component usage

| Need | Silica component |
|---|---|
| Rail and nav buttons | `Button` ghost, icon-only; `Tooltip` on desktop only |

**Icons are lucide, at 16px with a 1.75 stroke.** Never Unicode characters: Inter serves
almost none of the symbol block, so a glyph in the chrome is really a request for whatever
font the operating system reaches for — and `U+270E` renders as a colour emoji on Apple
platforms. One import, one rail, in `apps/web/components/ToolRail.tsx`, shared by the app
and the marketing hero so the two cannot drift. ADR-044.
| Pen colour and width | `Popover` anchored away from the writing hand |
| Dashboard, history, search | `Sheet` over the canvas |
| Account, space switcher | `DropdownMenu` from the rail foot avatar |
| Agent comments | Agent-ink rule down the left of the card, with the client named beside it |
| A comment about one object | A pin at the object's corner, and the thread in a popup beside it — never in the drawer. ADR-107 |
| Review inbox | `Alert` colour `agent` per pending change, with revert |
| Confirmations | `Dialog`, sparingly |
| Transient feedback | `Toast` — bottom on mobile, opposite the rail on desktop |
| Recognition pending | `Progress` indeterminate, inline, never a blocking overlay |

**Prefer undo over confirm.** A dialog asking "are you sure" is a design failure in a capture app. Do the thing; show a toast with Undo.

## Motion

`--duration: 120ms`, standard ease. Fast and few.

- Capture sheet: one duration, no spring, no bounce. This is a tool.
- Chrome dim: 400ms, deliberately slower — it should go unnoticed.
- Recognition landing: transcript cross-fades in beneath the ink. Reserve the space while pending so there is never a layout jump.
- Under `prefers-reduced-motion` Silica forces `--duration` near zero. Everything must still make sense with no animation at all.

### The marketing site is the other case

The rules above are the app's: it is a tool somebody is working in, so motion there is fast and few. The apex is a brochure somebody is reading, and design.md §21 gives it a longer vocabulary — ink drawing in, a note settling, an underline appearing, a mint dot on save.

All of it is CSS driven from a scroll position, never an observer and never a client component. ADR-088 has the reasoning and the traps; the sheets are `motion.css` (the keyframes) and the `site-motion*` files (who uses them).

Two rules that bite:

- **Never animate `transform` on anything that also moves under a pointer.** A filling animation outranks a declared value, so the hover state stops working permanently. Use `translate` / `rotate` / `scale`, which compose.
- **Every scroll-driven rule goes behind `@supports (animation-timeline: view())` as well as `prefers-reduced-motion`,** and there is no hidden initial state outside those gates. A crawler must be served the finished page.

## Accessibility

- WCAG AA for all text. Silica's `contrastWarnings` is a publish gate, not a suggestion.
- **The agent-ink distinction must never be colour alone.** Every agent element also carries a label — "Claude · via MCP". Colour is the fast signal; the label is the accessible one.
- Touch targets 44px minimum, 48px in the mobile bar.
- Everything drawable is also typeable, and every transcript is reachable and editable by keyboard.
- Full keyboard navigation for all chrome. Base UI provides focus management; do not fight it.

## The `glass` traps

Two of them, both silent. Neither is discoverable from the markup.

### 1. Specificity

Silica ships `glass` as `.glass[class]`. Two selectors' worth of specificity outranks
every single-class Tailwind utility, so **an element carrying `glass` cannot be
positioned by a Tailwind class** — `class="glass absolute"` silently resolves to
`position: relative`.

It fails invisibly. The element renders, sits at its static position, and if that
position is inside an `overflow: hidden` container it is simply gone. Nothing errors,
nothing logs, and typecheck and build both pass.

Positioning for all chrome therefore lives in `.jd-chrome[class][class]` in
`globals.css`, doubled so it does not depend on emission order. If you add a new glass
surface, give it `jd-chrome` or position it from CSS with matching specificity — do not
reach for `absolute`, `fixed` or `sticky` on the glass element itself.

Offset utilities (`bottom-3`, `left-1/2`, `top-1/2`, `z-20`) are untouched by `glass`
and work normally.

### 2. `--u-accent` inherits

`glass` does not tint from a fixed colour. It tints from `--u-accent`, and **that
variable inherits**.

Silica's `bg-*` and `text-*` utilities each set `--u-accent` as a side effect. Our
`<body>` carries `bg-base-100 text-base-content`, and `.text-base-content` is emitted
later, so `--u-accent` resolves to the **ink** colour for everything inside. A glass pill
under that body tinted itself 55% near-black and rendered as a dark slab — with icons
drawn in that same near-black on top of it. Contrast zero. Nothing errored.

**Every glass surface must declare its own `--u-accent`.** `.jd-chrome` sets
`--u-accent: var(--color-base-100)`, so the chrome tints from the paper it floats over
regardless of what an ancestor is doing with text colour. It also raises `--glass-tint`
to 72%, because a pill that reads as paper needs more opacity than a pill that reads as
a smoked panel.

### Why both of these are written down here

Neither failure produces an error, a warning, or a failing test. Typecheck, production
build and every smoke suite were green while the chrome was first invisible off screen
and then invisible in place. If a glass surface looks wrong, check these two before
anything else.
