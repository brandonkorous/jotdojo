# 19 — Rebrand: jotacular → Jotacular

> **Status: done, except the domain.** Phases 1, 2, 4 and 5 shipped on 2026-08-23 —
> ADR-072, ADR-073, ADR-074. Phase 3 (§5) is deliberately **not** done: the product is
> called Jotacular everywhere a person reads it, and is still served from `jotacular.com`,
> because `app.` is the PWA install origin and `mcp.` is the OAuth audience. ADR-074.
>
> All four conflicts in §1 were settled on the recommendation given: design.md wins on
> message, DM Sans, the seal rule retired, the domain staged.
>
> **§4 was done twice.** The first pass renamed the product and repainted it, and left the
> site saying everything jotacular used to say. That is not a rebrand. The marketing
> narrative was then rebuilt to design.md §18 — four bands replaced, two components
> deleted, two written from nothing — and the app's microcopy moved to the §22 register.
> ADR-075.
>
> **A third pass** put the visual work right: bands that fill their width, text that is
> not dimmed, a floating nav, the hero as two columns with the canvas in a tilted frame,
> and the middleware fix without which no image on the apex loads at all. ADR-076.
>
> **A fourth pass** gave the bands real colour and the page real elevation (ADR-077), put
> pictures on it — the Open Graph card, the ink drawings, the jot in Caveat, and the
> conversation as a Silica chat (ADR-080) — and fixed a background box that had been one
> viewport tall since the first canvas commit (ADR-081).
>
> **Numbering note:** a concurrent session took 078 and 079 while this work was in flight,
> so these two are 080 and 081.
>
> **One thing found on the way that is not a rebrand problem:** the dark theme has never
> worked. `paper-night` (and `washi-night` before it) is scoped `:root:not([data-theme])`,
> and `layout.tsx` has always set `data-theme` explicitly — so the dark declaration has been
> dead since it was written. Left alone here: fixing it changes the app's appearance for
> every dark-mode user, which is a decision, not a rename.

Source of truth for the new identity is [design.md](../design.md) (marked *canonical
design direction*) plus the two brand sheets in `images/`. Where those disagree, §1 says
which wins and why.

## The size of it

    860   case-insensitive `jotacular` occurrences, ~110 files
     79   `kanninja` mentions (the inherited brand rationale)
     61   washi / sumi / vermillion / Fraunces mentions
    100   `jd-` CSS class names across 36 files
      5   icon PNGs, 0 Open Graph images
     19   docs, of which 2 need rewriting rather than patching

This is not a find-and-replace. The current visual identity is *inherited from kanNINJA
on purpose* — [10-design-system.md](10-design-system.md) says "jotacular uses this palette
and this type unchanged. Two products from one workshop should look like it," and
[11-copy-and-tone.md](11-copy-and-tone.md) builds a whole register on the martial-arts
vocabulary that the word *dojo* anchors. Jotacular keeps neither. Both docs get rewritten.

---

## 1. Four conflicts to settle before any code moves

### 1.1 Which positioning is canonical — design.md or the brand sheet?

They are not the same product.

| | design.md | `images/jotacular.png` |
|---|---|---|
| Brand line | **Where the thought lands.** | Your thoughts. Connected. Multiplied. |
| Hook | **Don't organize it. Just jot it.** | Capture. Connect. Multiply. |
| What it is | "a capture layer between a user's brain and their AI agents" | "the canvas for your ideas, notes, and plans" |
| Pillar art | — | lightbulb, **node graph**, chart arrow |

design.md §3 explicitly rules out *"a knowledge workspace"* and *"a second brain"*
positioning; the sheet's "connect everything / multiply what matters" is exactly that
positioning. design.md §7, §14 and §23 explicitly ban node and network diagrams; the
sheet's CONNECT pillar is a node diagram.

**Recommendation: design.md wins on message, the sheet wins on marks.** Take the logo
suite, icon variations, favicon, palette and type from the sheet — they are excellent and
match design.md's construction rules exactly. Drop the sheet's taglines and its three
pillar icons. "Where the thought lands." is already the live hero headline
([site/page.tsx:22](../apps/web/app/site/page.tsx#L22)) and already the manifest
description, so this choice is also the one that costs nothing.

### 1.2 DM Sans or Inter for body?

design.md §10 prefers **DM Sans**, allows Inter as fallback. The brand sheet shows Inter.
The repo ships Inter today.

**Recommendation: DM Sans.** The reason design.md gives is real — DM Sans's rounded
terminals sit under Nunito without a seam, Inter's don't. Cost is one changed word in the
Google Fonts URL and one token. Keep Inter in the stack as the fallback it already is.

### 1.3 Does the vermillion rule survive?

Today's strongest visual constraint is *"one per screen"* — vermillion is a seal, not a
button colour. design.md §11 assigns mint to "Primary CTA, active states, helpful
highlights", which is an ordinary primary, used freely.

**They are incompatible.** Mint cannot be both rare and the CTA colour.

**Recommendation: retire the seal rule.** Jotacular is friendly and immediate, not
restrained and ceremonial; a scarce accent is a kanNINJA idea. Mint becomes a normal
primary. This wants an ADR, because it reverses the loudest sentence in
[10-design-system.md](10-design-system.md).

### 1.4 Domain: when, and what breaks

`jotacular.com` replaces `jotacular.com`. Two hostnames are load-bearing in a way the others
are not:

- **`app.jotacular.com`** is the PWA install origin. [16-web-presence.md](16-web-presence.md)
  already flags this: it is baked into every installed home-screen icon, so moving it
  forces every existing user to reinstall.
- **`mcp.jotacular.com/mcp`** is `MCP_RESOURCE`, and every access token is bound to that
  exact string as its audience ([mcp/src/index.ts:64](../apps/mcp/src/index.ts#L64)).
  Changing it **invalidates every live agent connection**; every user reconnects Claude by
  hand.

**Recommendation: serve both, cut over deliberately.** Add the jotacular hostnames
alongside the jotacular ones, make jotacular canonical for marketing immediately, and hold
`app.` and `mcp.` on the old host until there is a reconnect path worth shipping. Note
that adding *any* hostname is a two-repo change — the Caddy site block and the
domain-check allow-list both live in the sparx repo
([17-shared-infrastructure.md](17-shared-infrastructure.md)).

---

## 2. What we deliberately do not rename

Brand is not infrastructure. Renaming these buys nothing a user can see and costs a
migration with downtime:

| Identifier | Where | Why it stays |
|---|---|---|
| `@jotacular/*` package names | 14 package.json, every import, 4 Dockerfiles | Internal. Churns nearly every file in the repo for zero user-visible gain |
| `jotacular_app`, `jotacular_owner`, `jotacular_worker` | 76 references across migrations | Renaming a Postgres role rewrites grants and RLS policies on a live database |
| database `jotacular` | sparx's Flexible Server | Rename means dump, restore, downtime |
| k8s namespace `jotacular` | `infra/k8s/`, sparx's Caddy | Namespace rename is a full redeploy plus a two-repo routing change |
| `kv-jotdojo-prod-cus`, `stjotdojoprodcus` | sparx `terraform/envs/azure/jotacular.tf` | Azure storage account names are global and immutable; this is a data migration |
| `jd-` CSS prefix, 100 classes | 36 files | Invisible to users, high churn, high diff noise |

**This table was overtaken. ADR-086 decided the opposite for most of it** — the
package scope, the roles, the namespace and the database all moved after all, and
`0034` renames the roles. Only the two Azure names above and the `jd-` prefix
actually stayed. The sweep then rewrote the identifiers *inside this table*, so
for a while it named a vault that does not exist while claiming it had not
changed. Read ADR-086's consequences for what really did and did not move; this
table is the plan, not the record.

Each of these should get one line in the rebrand ADR saying it was considered and left,
so the next reader does not think it was missed. Note also that production has already
drifted ahead of the pipeline by hand — treat anything in the sparx repo as needing a
look at live state first, not just at the terraform.

---

## 3. Phase 1 — Brand foundation in code (no name change yet)

Shippable on its own. The product looks like Jotacular before it is called Jotacular.

**Palette.** Two of the four house colours barely move, which is lucky:

| Role | Now | Jotacular | Note |
|---|---|---|---|
| page | washi `#F8F4EC` | warm paper `#F7F3EA` | near-imperceptible; keep the paper grain (`--noise: 1`) |
| ink | sumi `#0E0F12` | charcoal `#111418` | near-imperceptible |
| accent | vermillion `#E0432F` | **mint `#00C2A8`** | the real change; see §1.3 |
| agent | indigo `oklch(52% 0.09 265)` | **violet `#6A39FF`** | design.md §11 assigns violet to "AI/agent association" — it lands exactly on the slot that already exists |

Files: [globals.css](../apps/web/app/globals.css) (both the `washi` and `washi-night`
theme blocks — rename them too; `washi` is kanNINJA vocabulary), and the `@theme` block
for `--color-agent` and the three font tokens.

**Type.** Fraunces → **Nunito** (Nunito Rounded), Inter → **DM Sans**. One `<link>` in
[layout.tsx](../apps/web/app/layout.tsx#L26) and `--font-head` / `--font-sans`. Add
**Caveat** only if a napkin annotation actually ships — design.md §10 says sparingly, so
do not load a font speculatively.

**Ink swatches.** [ink-style.ts](../apps/web/lib/ink-style.ts#L23) names pen colours
`Sumi, Vermillion, Indigo, Moss, Clay` — user-visible, and two of those are the old
register. Retune to the new house: charcoal, mint, violet, plus two neutrals. The
highlighter set is already "tuned to multiply onto washi cream"; warm paper is close
enough that the values probably hold, but check them against `#F7F3EA` rather than
assuming.

**Gradients.** design.md §12 is a strict rule. Audit for any gradient before claiming
compliance — the current theme has `--depth: 0` and flat surfaces, so this is likely
already clean, but it needs the grep, not the assumption.

**Icons.** Waiting on your icon and wordmark files. Then regenerate:
`app/icon.png`, `app/apple-icon.png`, `public/icon-192.png`, `public/icon-512.png`,
`public/icon-maskable-512.png`. design.md §7 asks for a 16/24/32/48/64px legibility test —
the mint dot and the violet underline are the two things that die first at 16px.
**Gap worth closing here: there is no Open Graph image at all today.** The rebrand is the
moment to add one.

## 4. Phase 2 — The name

**Metadata and manifest** — small, high-visibility:

- [manifest.webmanifest](../apps/web/public/manifest.webmanifest): `name`, `short_name`,
  `theme_color`, `background_color` (both currently `#F8F4EC`)
- [layout.tsx](../apps/web/app/layout.tsx): `title`, `appleWebApp.title`, both `themeColor` entries
- [site/layout.tsx](../apps/web/app/site/layout.tsx#L15): title default and template,
  `openGraph.siteName`, and the header wordmark
- [site/page.tsx](../apps/web/app/site/page.tsx#L55): JSON-LD `name`
- [SiteFooter.tsx](../apps/web/components/site/SiteFooter.tsx#L93): footer wordmark

The header and footer wordmarks are `<span className="font-head">jotacular</span>` today.
They should become the actual wordmark SVG, not restyled text.

**Marketing copy.** [16-web-presence.md](16-web-presence.md) and the live site already
say "Where the thought lands," so the hero survives §1.1 intact. What changes is every
sentence naming the product: `HeroCanvas` aria-label, `Objection.tsx`, `AgentDemo.tsx`,
`Promises.tsx`, `Beats.tsx`.

**Content.** Five blog posts and two legal pages. `connect-jotacular-to-claude.md` needs a
**file rename**, which means a redirect — it is linked from the footer and is our best SEO
asset. The legal pages name the entity and the venue; the product name changes but check
whether the legal entity does.

**MCP server identity.** `{ name: "jotacular", version: "0.1.0" }`
([mcp/src/index.ts:68](../apps/mcp/src/index.ts#L68)) is what a user sees in Claude's
connector list, and the server instructions string below it says "jotacular holds the user's
captured notes". Both are user-visible copy. Tool names (`search_notes`, `get_note`,
`create_note`) are unprefixed and carry no brand — they stay.

**Voice.** design.md §22 gives a warmer register than we ship today ("Jot saved. Nice
one.", "Nothing here. Go have a thought."). That is a genuine tone shift, not a rename —
worth doing, and worth doing as its own pass so it can be judged on its own.

## 5. Phase 3 — Domain

Per §1.4, staged rather than atomic:

1. jotacular hostnames added in the sparx repo (Caddy site block and domain-check allow-list)
2. `SITE_URL` → `https://jotacular.com`; canonical tags, `robots.txt`, `sitemap.xml` and
   JSON-LD `url` follow it automatically via [hosts.ts](../apps/web/lib/hosts.ts)
3. `isMarketingHost` must accept both apexes during the overlap, or the old domain serves
   the app tree at the apex — which [16-web-presence.md](16-web-presence.md) says can never happen
4. `jotacular.com` → 301 to `jotacular.com`
5. `app.` and `mcp.` **held**, with a dated decision on when and how users reconnect

The fallback in `hosts.ts` (`?? "https://jotacular.com"`) is deliberately "correct in
production" — it must move with `SITE_URL`, or a missing env var silently un-rebrands the
site.

## 6. Phase 4 — Docs

**Rewrite, not patch:**

- **[10-design-system.md](10-design-system.md)** — its thesis is "inherit kanNINJA
  unchanged". That thesis is now false. New palette, new type, and the vermillion rule's
  replacement.
- **[11-copy-and-tone.md](11-copy-and-tone.md)** — an entire section justifies the
  martial-arts register as house vocabulary. Jotacular's personality is design.md §6
  (70% capable, 20% playful, 10% weird). Its one durable conclusion — *don't rename
  "note"* — survives and should be kept with its reasoning intact.

**Name pass:** 00, 01, 02, 03, 05, 06, 08, 12, 13, 16, 17, 18, docs README, plus root
[README.md](../README.md) and [CLAUDE.md](../CLAUDE.md).

**Do not touch:** [15-decision-log.md](15-decision-log.md) prose. ADRs are a dated record
of what was decided when, under the name it had then. Rewriting history to say "Jotacular"
makes the log lie. Add new ADRs instead; the last is ADR-071, so:

- **ADR-072** — the rename, and what deliberately keeps the old name (§2)
- **ADR-073** — the accent stops being a seal (§1.3)
- **ADR-074** — the domain cutover, and why `app.` and `mcp.` lag (§1.4)

Migrations under `packages/db/migrations` are never edited (CLAUDE.md) — the role names in
them are a literal record of what ran.

## 7. Phase 5 — Verify

Green suites did not catch the last three canvas defects, so:

- `pnpm site:smoke` — the marketing/app Host split still holds with two apexes
- `pnpm mcp:smoke` — the server still identifies and still authorizes
- **Open it in a browser.** Marketing hero, canvas, toolbar, save indicator, agent
  content, both light and dark. Nunito and DM Sans are rounder and wider than Fraunces and
  Inter; the toolbar and the plan cards are where that will show first.
- Icons at 16/24/32/48/64, and the maskable icon inside a circle mask
- Every gradient-free claim actually grepped, not assumed

## 8. Suggested commit sequence

Each of these stands alone and is separately revertible:

1. `feat(brand): the house palette is mint and violet, not vermillion` — tokens, fonts, ink swatches
2. `feat(brand): the mark is jot, the wordmark is jotacular` — icons, manifest, OG image, wordmarks
3. `feat(site): the product is called Jotacular` — copy, metadata, JSON-LD, content
4. `docs: the design system stops inheriting kanNINJA` — docs 10 and 11 rewritten, ADR-072 and ADR-073
5. `feat(site): jotacular.com is the apex` — domain, ADR-074

## 9. Fifth pass — the design review

A review of the finished landing page produced nine notes. All nine are done.

| Note | Outcome |
| --- | --- |
| Body copy too small and too light | `--body` at 1.0625rem, and `--ink-2` replaces every text `opacity`. ADR-082 |
| Page too long for its content; three sections stretched | Band padding down ~22%, lede gap down 30%, copy tightened in *Objection* and *Promises* |
| The dark "Connect your AI" band is right | Kept, untouched |
| The mint CTA field is too saturated | The close runs on charcoal; mint is the button. `.jd-band-mint` deleted. ADR-082 |
| The violet underline is working | Kept, and it no longer breaks across a line (`.jd-ul-keep`) |
| The four capture icons are generic | Font Awesome **Whiteboard Semibold**, from a package-manager Kit — and applied across the whole product, not just this page. `lucide-react` is gone. ADR-083 |
| The footer is weak; "Writing" reads as documentation | Blog teasers off the home page (`PostList` deleted); footer gets the dot grid, a bigger wordmark and the brand line in Caveat |
| Pricing has no personality | "Simple pricing. No notebook math." on both the band and the pricing page |
| The CTA wording is inconsistent | "Start jotting" everywhere; the bar's button is no longer `btn-sm` |

The strategic note — *keep telling one story, capture fast now and use it later* — is
what the `LakeStory` band was already for, and it kept its heading: **Capture now.
Use later.**

## 10. Done

**jotacular.com went live on 2026-08-24.** Apex and `www` serve the site, `app.`
the app, `mcp.` the agent endpoint with its RFC 8707 discovery, and production
runs as `jotacular_app`. `docs/20-rename-runbook.md` is the record of the move
itself.

Three things were only ever going to be found by opening the page, and the
green suites had nothing to say about any of them:

- **A post redirected to itself, forever.** The sweep rewrote both ends of the
  rule in the commit that created it. The smoke tested `slugs[0]` and stopped,
  so four working posts hid one infinite loop. It checks every post now — and
  the redirect is deleted outright, because nothing was linked to the old slug
  (ADR-095).
- **"Connect your AI" shipped unreadable.** A `clip-path` reveal on a scroll
  range finished around mid-viewport, so stopping where a reader stops gave
  *"Paste one link into Claude's settin"* (ADR-092).
- **Every reveal played backwards on the way up**, because scroll position is
  not a trigger. Reveals are one-shot now, and they fail open — the resting
  state is invisible, and the observer does not fire at all in some browsers
  (ADR-093).

### What did not move, and why

| | |
| --- | --- |
| `migrations/0000`–`0033` | A literal record of what ran. `0034` renames on top. |
| `jotdojo_owner` | Migrations run *as* it; Postgres refuses to rename the session user. |
| The production database name | Invisible, and renaming it needs a no-connections window. |
| `kv-jotdojo-prod-cus`, `stjotdojoprodcus`, `brandonkorous/jotdojo` | Their other end is outside this repo (ADR-090, ADR-091). |
| The repo directory | Still `jotDOJO`. No reader sees it. |

### Still open

- **Real photography.** The rule is in `10-design-system.md` and
  `public/img/` is plumbed, but the page still carries only ink and product.
  This is the largest remaining gap between the design system and the site.
- The old `jotdojo` namespace still runs a superseded copy of all four
  workloads against the shared connection budget.
- Two backup Postgres volumes on the dev machine, and `jotdojo.tf` /
  `HANDOFF-jotdojo.md` in sparx, whose contents are migrated but whose
  filenames are not.
