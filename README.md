# jotdojo

Where the thought lands.

A web-only capture app whose differentiator is a **hosted remote MCP server** — so an agent can read your notes from your phone with no computer running. Sibling product to [kanninja](https://kanninja.com).

Full documentation is in **[docs/](docs/)** — start with [docs/README.md](docs/README.md), then [docs/00-vision.md](docs/00-vision.md) and [docs/15-decision-log.md](docs/15-decision-log.md).

## Status

**M0 through M4 are code complete.** Auth and spaces, the canvas, capture (tokens,
`POST /v1/capture`, the Shortcut recipe, the Android share target), the OAuth 2.1
authorization server, the **MCP server** on `:3402`, semantic search, handwriting with
recognition, voice and photos, shared spaces and billing, and the marketing site at the
apex with a live-canvas hero.

**Nothing has been deployed**, and that single fact is what four of the five exit criteria
are waiting on — they all end with "and Claude can read it", and no hosted client can
reach a laptop. Everything involving a model or a card is also proven only against `fake`
providers, which read nothing, hear nothing, judge nothing and take no money. See
[docs/12-roadmap.md](docs/12-roadmap.md) for what that does and does not prove.

### Verifying

    pnpm db:smoke           9 checks  — the RLS tenancy boundary
    pnpm oauth:smoke       26 checks  — PKCE, audience binding, refresh rotation, grants
    pnpm search:smoke      18 checks  — outbox to pgvector, and that recall stays in-space
    pnpm ink:smoke         40 checks  — stroke storage, replay, gap refusal, one ink layer
    pnpm members:smoke     29 checks  — invites, roles, and what an outsider cannot see
    pnpm billing:smoke     35 checks  — the webhook signature contract and entitlement
    pnpm anon:smoke        34 checks  — capture before an account, and claiming it
    pnpm marks:smoke       28 checks  — the markdown toolbar: toggling, carets, headings
    pnpm reread:smoke      24 checks  — re-reading old pages, and never a correction
    pnpm triage:smoke      42 checks  — the agent that speaks first, and what stops it

    pnpm api:smoke         16 checks  — the capture endpoint over real HTTP
    pnpm mcp:smoke         22 checks  — a real MCP client, real HTTP, real OAuth token
    pnpm oauth:http-smoke  21 checks  — discovery, DCR, the token endpoint's contract
    pnpm billing:http-smoke 20 checks — the webhook, and everything it refuses
    pnpm site:smoke        45 checks  — the apex is crawlable, the app is not

The second group needs the servers running (`pnpm dev`). The full list, and what each one
is actually for, is in [docs/12-roadmap.md](docs/12-roadmap.md). `.github/workflows/ci.yml`
runs all of them against a real Postgres.

They must stay green. ADR-019 explains why that is not optional.

### One thing to do once, per clone

    git config core.hooksPath .githooks

Refuses any commit whose staged diff contains a Stripe key. Key exposure in a
repository is the leading cause of API key takeover, and a key committed once is
in the history for ever -- the next commit removing it does nothing.

### Signing in before Google OAuth is set up

Set `ALLOW_DEV_LOGIN=true` in `.env` for a local email-only sign-in. It is off by
default and the app **refuses to start** if it is enabled with `NODE_ENV=production`.
Remove it once Google OAuth works.

Known gaps in M0, both intentional:

- **No service worker yet**, so the app is installable (the manifest is there) but not
  offline-capable. A request for `/sw.js` 404ing in the dev log is expected. Offline
  caching lands with the capture work in M1 — and per ADR-003 it will be a cache, never
  a store.
- **No app icons yet.** `manifest.webmanifest` references `icon-192.png`,
  `icon-512.png` and `icon-maskable-512.png`, which do not exist. Installing to a home
  screen works but shows a default icon.

## Getting started

    pnpm install
    cp .env.example .env          # then fill in AUTH_SECRET and the Google OAuth pair
    pnpm db:up                    # Postgres 17 + pgvector on :5433
    pnpm db:setup                 # migrations + the local jotdojo_app password
    pnpm db:smoke                 # proves row-level security actually enforces
    pnpm dev                      # http://localhost:3400

Generate `AUTH_SECRET` with:

    node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

### Ports: jotdojo owns 3400-3409

| Port | Service |
|---|---|
| **3400** | `apps/web` — the app |
| 3401 | `apps/api` — REST v1, the Shortcuts endpoint (M1) |
| 3402 | `apps/mcp` — MCP + OAuth server (M1) |
| 3403 | `apps/worker` — health and metrics (M2) |
| 5433 | Postgres (docker compose) |

A block rather than the next free port, because jotdojo is four services and taking
single ports as we go would scatter them through whatever gaps exist that week. On this
machine `sparx.works` occupies 3000-3022 plus 3100/3200/3300, so jotdojo starts cleanly
after it. If kanninja ever runs locally, give it 3500-3509.

**Not port 3000**, and the reason is worth knowing because the failure is silent: if
another service already holds `:::3000` (IPv6), a Next dev server can still bind
`0.0.0.0:3000` (IPv4) and report itself started, while Windows resolves `localhost` to
`::1` first. The browser reaches the *other* service, and you get another product's JSON
at what looks like your own dev URL.

Keep 3400 stable: the Google OAuth redirect URI is registered against it.

**The marketing site shares 3400.** The apex and the app are one deployment routed by Host
(ADR-040), so locally the app is `http://localhost:3400` and the marketing site is
`http://jotdojo.localhost:3400` — browsers resolve `*.localhost` to loopback, so no hosts
file is involved. Node's resolver does not, which is why `site:smoke` sends the hostname as
`x-forwarded-host`, exactly as Caddy does.

### One `.env`, at the repo root

There is a single `.env` at the repository root and every workspace loads it explicitly
via `dotenv-cli`. This is deliberate: Next.js only reads `.env` from the Next app's own
directory, and the db scripts run from `packages/db`, so neither would find a root
`.env` on its own. The alternative — a copy per workspace — drifts out of step, and the
copy that drifts is usually the one holding the database credentials.

If you add a workspace that needs configuration, give its scripts the same
`dotenv -e ../../.env --` prefix rather than adding a second `.env`.

### Google OAuth setup

1. Google Cloud Console, APIs & Services, Credentials, Create OAuth client ID, Web application.
2. Authorized redirect URI: `http://localhost:3400/api/auth/callback/google`
3. Copy the client id and secret into `.env`.

## Layout

    apps/
      web/        Next.js PWA + BFF. Canvas-first shell
      api/        Fastify REST v1 (Shortcuts capture endpoint)   [M1]
      mcp/        MCP server + OAuth 2.1 authorization server    [M1]
      worker/     Recognition, embeddings, triage, outbox drain  [M2]
    packages/
      domain/     Entities, services, authorization. The core
      db/         Drizzle schema, migrations, RLS
    docs/         The specification
    infra/        Dockerfiles and plain k8s manifests (no Helm — ADR-026)

## The governing rule

**One domain core, three thin adapters.** `apps/api`, `apps/mcp`, and `apps/worker` all call `@jotdojo/domain`. Nothing but `@jotdojo/db` talks to Postgres, and nothing but the domain layer calls `@jotdojo/db`. If an agent can do a thing, it is because a domain method allowed it and the web UI could do the same thing the same way.

See [docs/03-architecture.md](docs/03-architecture.md).

## Tenancy

Row-level security keyed to space membership is the tenancy boundary. Two things keep
it real, and both are easy to get wrong (ADR-019):

- **The app connects as `jotdojo_app`, never as an admin role.** PostgreSQL exempts
  superusers from every policy, so an admin connection string turns tenancy off while
  every policy still reads as though it were enforced.
- **`pnpm db:smoke` must stay green.** It creates two users and asserts that neither can
  reach the other's notes. It caught two real leaks on its first run.
