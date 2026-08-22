# 10 — Design system

Built on **Silica UI** (`silicaui.com`), the in-house Tailwind v4 design system — and on **kanninja's existing brand kit**, because jotdojo is the second product in a house that already has a visual language.

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

## Brand: inherit from kanninja

kanninja's brand kit already defines the house:

| Pigment | Value | Role |
|---|---|---|
| **Vermillion** | `#E0432F` | The seal. **One per screen** |
| **Sumi** | `#0E0F12` | The ink. Primary text |
| **Washi** | `#F8F4EC` | Cream paper. The page |
| **Snow** | `#FBFAF6` | Elevated surfaces — cards, modals |

Type: **Fraunces** display, **Inter** body, **JetBrains Mono** for code.

The mark is a seal bearing 忍 (*nin*) — endure, persevere — described as 心 (heart) beneath 刃 (blade).

**jotdojo uses this palette and this type unchanged.** Two products from one workshop should look like it. This also happens to be exactly right for a product about napkins and notepads: washi is literally paper, sumi is literally ink.

### The vermillion rule

*"One per screen."* Vermillion is the seal, not a button colour. It marks the single most important thing in a view and nothing else. In jotdojo that is normally the capture affordance — and when the seal is on screen twice, one of them is wrong.

This is the strongest constraint in the visual system. Honour it.

## Theme: a declared `washi` theme, not a preset

Silica preset `dune` is close, but "close" is the wrong standard when the sibling product has exact values. Declare the house theme against Silica's tokens instead:

    @plugin "@wizeworks/silicaui";

    @plugin "@wizeworks/silicaui/theme" {
      name: washi;
      default: true;
      prefersdark: false;

      --color-base-100: #F8F4EC;   /* washi — the page */
      --color-base-200: #FBFAF6;   /* snow — elevated */
      --color-base-300: #EDE7DA;   /* hairline / rules */
      --color-base-content: #0E0F12; /* sumi — the ink */

      --color-primary: #0E0F12;    /* ink, not a brand blue */
      --color-accent: #E0432F;     /* vermillion — the seal */

      --depth: 0;                  /* ink on paper casts no shadow */
      --noise: 1;                  /* paper grain on the themed surface */
      --duration: 120ms;           /* capture must feel instant */
      --font-head: Fraunces;
      --font-sans: Inter;
      --font-mono: "JetBrains Mono";
    }

Then `<html data-theme="washi">`. A matching dark declaration inverts washi and sumi; vermillion holds in both.

`--noise: 1` deserves specific mention — one token puts a subtle grain on the themed surface while cards keep clean fills. For a brand whose base colour is named after paper, it is the highest ratio of atmosphere to effort available anywhere in the system.

**Never hardcode a hex in a component.** Every value above lives in the theme so islands and dark mode resolve correctly. The one sanctioned exception is stroke colour inside the ink canvas — that is user data, not design, and even those swatches are seeded from resolved tokens.

## The extra colour role: `agent`

The most important design decision in the product.

> **Human ink is sumi. Agent ink is `agent`.**

Everything an agent produced — comments, suggested edits, triage proposals — renders in a visually distinct ink. A person can tell at a glance, anywhere in the product, whether a human or a machine wrote something. It is a safety property expressed as colour, for the cost of one token.

Silica's colour list is open, so register it rather than reaching for a hex:

    @plugin "@wizeworks/silicaui" {
      colors: primary, secondary, accent, neutral, info, success, warning, error, agent;
    }
    @theme {
      --color-agent: oklch(52% 0.09 265);   /* indigo */
    }

`colors:` **replaces** the default list, so the eight built-ins are re-listed. Registering properly means `text-agent`, `border-agent`, `badge-agent`, `alert-agent` and every other `*-agent` variant exist automatically, in both modes, with a contrast-measured `-content` ink derived for us.

Indigo is deliberate: cool where washi is warm, and unmistakable against vermillion — so agent content reads as *visiting* the page rather than belonging to it, and never competes with the seal.

## Typography

Silica's scale. No magic numbers, never `text-[13px]`.

| Role | Face / size |
|---|---|
| Note body | Inter, `text-md` (16px) |
| Note title | Fraunces, `text-xl` |
| UI labels | Inter, `text-sm` |
| Metadata, provenance, confidence | Inter, `text-xs`, muted |
| Marketing headlines | Fraunces, `text-5xl`+ |

16px minimum for anything editable on iOS — smaller triggers zoom-on-focus and breaks the canvas layout.

## The mark

A seal in the same frame as kanninja's, carrying a different character. Two recommendations:

- **覚** (*oboe* / *kaku*) — remember, perceive. Appears in 覚え書き (*oboegaki*), "memorandum." This is the better choice: it names the half of the product that is not about action, which is exactly the distinction drawn in ADR-002.
- **記** (*ki*) — record, write down. Appears in 記録 (*kiroku*, record) and 日記 (*nikki*, diary). Safer, more literal, slightly less interesting.

Either sits in a vermillion seal square, legible at 16px as a favicon. The wordmark is `jotdojo` in Fraunces, lowercase always, including sentence-initial.

## The app shell: canvas-first, two pieces of floating chrome

**The app is a canvas.** Opening `app.jotdojo.com` puts a live writable surface on screen — content if there is any, otherwise blank with *Start jotting*. Zero clicks to write.

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
| Agent comments | `Card` with `border-agent`, `Badge` colour `agent` naming the client |
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
