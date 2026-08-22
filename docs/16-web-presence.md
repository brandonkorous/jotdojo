# 16 — Web presence, domains, and SEO

> **Status: built.** The apex serves the marketing site — hero, three beats, pricing, five
> posts, `robots.txt`, `sitemap.xml` and JSON-LD — from the same `apps/web` deployment as
> the app, routed by Host (ADR-040). `pnpm site:smoke` proves the split over real HTTP.
>
> **Two departures from what follows, both deliberate.** The draft token is a server-set
> httpOnly cookie rather than `localStorage` (ADR-041), and returning visitors are not
> auto-redirected from the apex to the app — see the deferral in ADR-040.
>
> **The line that could not wait, and did not:** the app is at `app.jotdojo.com`. The PWA
> install origin is baked into every installed home-screen icon, so moving it later forces
> every user to reinstall.

## The tension

Two requirements that pull in opposite directions:

1. **The app must load as a live canvas, instantly, with zero clicks.** Anything else violates the capture contract.
2. **We need indexable marketing content**, because SEO and word-of-mouth are the only distribution we have.

An app shell is thin content and will never rank. A marketing page is a click away from capture. Both cannot own the same URL — unless the marketing page *is* a canvas.

## The decision

    jotdojo.com          marketing site, and the hero is a REAL working canvas
    app.jotdojo.com      the app. Canvas-first, no marketing, ever
    api.jotdojo.com      REST v1, the Shortcuts endpoint
    mcp.jotdojo.com      MCP server + OAuth authorization server

### The hero is the product

`jotdojo.com` is a normal, crawlable, statically rendered marketing page — headline, three beats, pricing, footer links, a blog. It ranks because it is real content.

But the hero is not a screenshot. It is **a live canvas you can type or draw in immediately**, anonymously, with no account. The headline sits above it and the page continues below it.

This resolves the tension completely:

- A crawler gets a content-rich page at the root. No cloaking, no doorway page, no penalty risk — bots and humans see the same HTML.
- A first-time human can jot **within one second of the page painting**, which is a far better demonstration than any copy we could write.
- "Keep this" hands the content to `app.jotdojo.com` and prompts for Google sign-in.

The most persuasive marketing for a capture app is letting someone capture something.

### Returning users skip it

A session cookie or a stored preference at the root redirects straight to `app.jotdojo.com`. That is session-based routing, which is ordinary and not cloaking — logged-out visitors and crawlers get the marketing page every time.

Anyone who installs the PWA installs it **from `app.jotdojo.com`**, so the home-screen icon opens directly onto the canvas and never shows marketing. This is important: the installed app is the daily driver and it must be pure.

## Anonymous capture

You can jot before you have an account. This removes the signup wall from the highest-intent moment we will ever get.

**But it must not be local-only.** iOS Safari evicts script-writable storage under pressure and after periods of disuse. An anonymous user whose notes live solely in IndexedDB *will* lose them, and "never lose a thought" is our first principle. Local-only anonymous capture would violate the product's core promise as a matter of design, not accident.

So anonymous notes are **server-side from the first keystroke**:

- On first jot, mint an anonymous space server-side and store an opaque token in an httpOnly cookie. `localStorage` was the original plan and is the wrong one — ITP caps script-writable storage at seven days, which is the very thing this design exists to avoid. See ADR-041.
- Content persists to Postgres exactly like a signed-in user's. Durable, survives eviction, survives a browser crash.
- Claiming at sign-in is a single `UPDATE` reassigning the space's owner. Nothing is copied, nothing is lost, no merge logic.
- Because the token travels in a URL on the handoff from `jotdojo.com` to `app.jotdojo.com`, cross-subdomain `localStorage` isolation stops being a problem too.

Constraints on anonymous spaces:

| Rule | Reason |
|---|---|
| Text and ink only — no voice, no images | Recognition costs money; abuse is free |
| No recognition run on ink until claimed | Same |
| Hard cap: 10 notes, 50KB text, 4000 strokes | Abuse ceiling. Strokes are not text, so `ANON_MAX_CHARS` never sees them and ink needs its own number |
| No MCP access | Nothing to authorize against |
| Deleted after 30 days unclaimed | Storage hygiene and a clean data-retention story |
| Rate limited per IP | The obvious abuse vector |

The UI is honest about the state without nagging:

    Saved. Sign in to keep this and reach it from your phone.

Shown once, quietly, after the first note. Not a modal. Not on every keystroke.

## SEO strategy

We will not out-rank Notion for "note taking app," and trying is a waste. Rank for the thing that is actually true about us:

**Primary intent — the gap we uniquely fill:**
- "connect claude to my notes"
- "mcp note taking app"
- "notes app claude can read"
- "remote mcp server notes"
- "give chatgpt access to my notes"

**Secondary:**
- "handwriting notes web app no download"
- "ipad notes app browser"
- "shared family notes app"

**Content plan.** A small number of genuinely useful, technically honest posts — the kind an engineer bookmarks. All five are written and live in `apps/web/content/blog` as markdown, rendered at build time:

- Connecting jotdojo to Claude, ChatGPT and Claude Code
- Why local MCP servers do not work from your phone
- What MCP actually is, for people who keep hearing about it
- Capturing to a web app with iOS Shortcuts (useful even to non-customers — which is the point)
- Handwriting recognition on the web in 2026: what actually works

Each ends with a link to the live canvas rather than a signup CTA. Screenshots are still missing from the connector post; they need a deployed instance to screenshot.

**Technical:** static rendering for everything marketing, real `<title>` and meta per page, JSON-LD `SoftwareApplication`, `sitemap.xml`, OG images generated per post, Core Web Vitals treated as a hard gate — a slow marketing site for a product whose entire pitch is speed is an argument against ourselves.

## Rejected alternatives

**`jotdojo.com` as the app, marketing at `/why` and `/pricing`.** The root is our highest-authority URL and an app shell wastes it. Rendering different content to crawlers than to users at the same URL is cloaking and risks a penalty.

**A separate marketing domain.** Splits domain authority and looks like two companies.

**Marketing at `www.` and app at the apex.** Confusing to link, confusing to explain, and every share of "jotdojo.com" would land on the app instead of the pitch.

## Suite considerations

`kanninja.com` stays its own domain with its own marketing. They are separate products with separate audiences — see ADR-002 in [15-decision-log.md](15-decision-log.md).

If a shared account layer ever ships, it lives at a third domain or at `id.jotdojo.com`, and both products federate to it. Do not build this before there is a customer who wants both.
