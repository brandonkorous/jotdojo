# infra

Containers and Kubernetes manifests. See [docs/03-architecture.md](../docs/03-architecture.md).

**No Helm and no Kustomize.** Four services we control, one cluster, one
environment -- a templating language between us and our YAML would buy nothing.
Image tags move with `kubectl set image`, which gives real rollout and rollback
without `:latest`. ADR-026.

## The rule

**Keep workloads portable.** No AKS-specific APIs in application code, no service
mesh in the request path, no operator-managed CRDs the app depends on. AKS is used
because it is already paid for; if the economics change, moving to Azure Container
Apps should be a re-run of the Dockerfiles, not a rewrite.

## Layout

    infra/
      docker/     one Dockerfile per service. Build from the REPO ROOT.
      k8s/        plain manifests. `kubectl apply -f infra/k8s/` in filename order.

`web` is a compiled Next.js standalone server. `api`, `mcp` and `worker` run
through `tsx src/index.ts` — there is no build step, so those images ship source
and resolve the workspace at boot. That is why their `startupProbe` budgets are
generous; see the note in `k8s/api.yaml` before tightening one.

> **Deploying? Read [docs/17-shared-infrastructure.md](../docs/17-shared-infrastructure.md) first.** It carries the full contract: the three database constraints that do not exist locally (private-IP migrations, the server-level extension allow-list, the 50-connection ceiling), what the two workflows in `.github/workflows/` do, and the pre-flight checklist. What follows here is the part that matters while editing these files.

## It is a shared cluster, and that changes three things

Jotacular does not own the cluster. It belongs to **sparx** — a different product
in a different repository — which already hosts sparx itself, the piggles brand,
and kanNINJA, each in its own namespace behind **one shared Caddy ingress**.
Jotacular gets the `jotacular` namespace and shares the cluster and the Postgres
*server*. Nothing else.

**1. Adding a hostname is a two-repo change.** Routing lives in the sparx repo at
`k8s/ingress/Caddyfile`, and every hostname must *also* be allow-listed in
`wizeworks/services/api-rest/src/routes/internal/domain-check.ts`. Those blocks
use on-demand TLS, which asks that endpoint for permission before issuing a
certificate. Miss the allow-list entry and the failure looks nothing like its
cause: the first HTTPS request gets `403 unknown_host`, Caddy never issues, and
Cloudflare answers **525** for the whole product.

Four hostnames carry the product: the **apex** (and `www`), **`app.`**, **`api.`** and
**`mcp.`**. The apex is the marketing site and it is served by the **same `jotacular-web`
Service** as the app — one deployment, routed by Host in `apps/web/middleware.ts` (ADR-040).
So the apex needs a Caddy block and an allow-list entry like any other hostname, but it does
**not** need a new Service, Deployment or port. `www` needs the same two, and is matched by
the app rather than redirected in Caddy.

**The app is at `app.jotacular.com` and the apex is not an option.** ADR-010 and
ADR-018 both settle this, and ADR-018 calls it the one part of the first deploy
that cannot wait. A PWA's install origin is written into the home-screen icon at
install time; it does not follow a redirect. Ship the app at the apex once and
every user who installed it has to delete and reinstall to move — which is why
this has to be right *before* the first `kubectl apply`, not after.

**2. The connection budget is shared and exhaustible.** Jotacular has its own
`jotacular` **database**, but it is on sparx's server, and that server's tier caps
`max_connections` at **50 for the whole server** — a hard, tier-specific ceiling,
not a tunable. `packages/db/src/client.ts` reads `DB_POOL_MAX`; `infra/k8s` sets
it to 5/5/3/3 across web/api/mcp/worker for a total of **16**. The default is 10,
which across four services would be 40 and would not fit. Raising a pool size is
a decision about somebody else's product too.

**3. `MCP_RESOURCE` must match the public origin exactly.** RFC 8707 binds every
access token to that literal string. It is set in `k8s/01-config.yaml` to
`https://mcp.jotacular.com/mcp` and must equal what `apps/mcp` advertises and what
Caddy routes, character for character.

The Azure side — the database, the Key Vault, the blob account, and this repo's
CI identity — is Terraform in the sparx repo at
`terraform/envs/azure/jotacular.tf`. One file, so deleting it removes Jotacular's
whole Azure footprint and touches nothing of sparx's.

## Cost reality

AKS + HA Postgres Flexible Server + Front Door is a $200–400/month floor before a
single user signs up. Start with one small node pool and a burstable Postgres tier.

In practice Jotacular's *marginal* cost is far below that floor, because it is not
buying any of those things — they already exist and are paid for. What it adds is
compute on the shared node (~1.3 GiB of memory requests across four pods), a
second database on an existing server ($0 — Flexible Server bills per server),
a Key Vault (operations at $0.03 per 10,000, i.e. thousandths of a cent per
deploy), and blob storage billed from zero by consumption.

## The one thing not to get wrong

`DATABASE_URL` in every environment must point at the **restricted `jotacular_app`
role**, never at an admin or owner connection. PostgreSQL exempts superusers and
`BYPASSRLS` roles from every policy, so an admin connection string turns the entire
tenancy boundary off while every policy still reads as though it were enforced.

`pnpm db:smoke` proves the boundary holds. Run it against any environment you are
unsure about.
