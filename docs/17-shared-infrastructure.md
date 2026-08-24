# 17 — Shared infrastructure, and the deploy that follows from it

Jotacular does not own the cluster or the database server. Both belong to **sparx**
— a different product in a different repository — which already runs sparx
itself, the piggles brand, and kanNINJA on them.

This document is the contract. It exists because almost every rule below is
invisible from inside this repo: the code compiles, the tests pass, and
`pnpm db:migrate` works perfectly on a laptop right up until it is pointed at
production and fails for a reason nothing here would have suggested.

## What is shared, what is ours

| Thing | Owner | Ours |
|---|---|---|
| AKS cluster `aks-sparx-prod-cus` | sparx | the `jotacular` **namespace** |
| Caddy ingress + its routing table | sparx | nothing — see [Cross-repo](#the-cross-repo-part) |
| Postgres server `psql-sparx-prod-cus` | sparx | the `jotacular` **database** |
| Key Vault | — | `kv-jotdojo-prod-cus`, ours alone |
| Blob storage | — | `stjotdojoprodcus`, ours alone |
| Azure CI identity | — | ours alone, `brandonkorous/jotdojo` only |

Everything on the right is defined in the **sparx** repo at
`terraform/envs/azure/jotacular.tf` — one file, so deleting it removes Jotacular's
whole Azure footprint and touches nothing of sparx's.

## The database

**Our own database on their server.** Not a schema inside `sparx`, and the
distinction is load-bearing: a schema would mean two independent migration
runners taking locks on one database, two different RLS regimes (`sparx` keys on
`current_tenant_id()`, we key on `app.actor_id`) where one `GRANT` mistake is a
cross-*product* leak, and pgvector installed into sparx's schema for no reason.

A second database on an existing Flexible Server costs **$0** — Azure bills per
server.

### Three constraints that do not exist locally

**1. The server is private-IP only, so migrations cannot run from CI directly.**
`public_network_access_enabled = false`, and the server sits in a delegated
subnet inside the VNet. A GitHub-hosted runner is on the public internet and
**cannot reach it at all** — not with a firewall rule, not with a connection
string. `pnpm db:migrate` from a runner will hang and then fail.

Migrations must run **as a Kubernetes Job inside the cluster**, which is where
sparx runs its own. That is the single most important line in this document.

**2. Postgres extensions are allow-listed at the SERVER level, and we cannot
change the list.** Azure Flexible Server refuses `CREATE EXTENSION` for anything
not named in the `azure.extensions` server parameter, and that parameter is
server-wide — there is no per-database version of it. The list currently reads:

    PGCRYPTO, BTREE_GIST, VECTOR, PG_TRGM, CITEXT

The last three are ours (`0000_init.sql`). **If a future migration adds a fourth,
it will fail in production and only in production** — and it fails in the worst
possible place, after the roles exist and the pods have already rolled. Adding
one is a change to sparx's `terraform/envs/azure/main.tf`, so it needs to be
raised *before* the migration that needs it is written.

**3. The connection budget is exhaustible and small, and it used to be shared.** The tier
caps `max_connections` at **50 for the whole server**, and sparx is already
drawing on it.

**Fifteen of those fifty are not ours, and nobody can give them back.** Azure
holds `superuser_reserved_connections` at 10 and `reserved_connections` at 5,
and both are `isReadOnly: true` -- they cannot be lowered. So the ceiling
`jotacular_app` actually meets is **35**, and the refusal it meets there does not
say "too many clients":

    FATAL: remaining connection slots are reserved for roles with privileges of
    the "pg_use_reserved_connections" role

Every number below is against 35, not 50.

**Since 2026-08-24 that 35 is ours alone.** jotacular has its own B1ms,
`psql-jotacular-prod-cus`, in its own delegated subnet, and sparx keeps
`psql-sparx-prod-cus`. Two small servers beat one bigger shared one on both
counts that mattered: ~$18 each against ~$60 for a B2s, and neither product can
starve the other however it grows. ADR-099 is how we found out; ADR-100 is the
move. **The DATABASE SERVER is no longer a shared resource. The CLUSTER still
is.**

`packages/db/src/client.ts` reads `DB_POOL_MAX`. `infra/k8s` sets it per service:

| Service | `DB_POOL_MAX` | Live channel | Why |
|---|---|---|---|
| web | 5 | +1 | BFF, concurrent user requests |
| api | 5 | — | concurrent third-party requests |
| mcp | 3 | — | one agent tool call at a time |
| worker | 3 | — | one batch at a time |
| | **16 total** | **+1 per web pod** | **17, or 18 mid-deploy** |

The default is 10, which across four services is 40 and does not fit. Exceeding
the ceiling does not make anything slow — Postgres refuses the connection with
`FATAL: sorry, too many clients already`, and which service loses depends on pod
start order. **Raising a pool size is a decision about sparx too.**

**The live channel is a connection, and it is not in a pool.** `LISTEN` holds a
backend open for the life of the process, so `packages/db/src/live.ts` opens its
own client (`application_name=jotacular-live`) rather than taking a fifth of web's
pool and never giving it back. It is opened lazily, on the first subscriber, so
a web pod that nobody has a note open on does not hold one at all.

Count it as **one per web pod**, and two during a rolling update, because web
surges. If web ever scales past a couple of replicas, this line grows with it
and the number above has to be redone. ADR-058.

Scaling the tier is the alternative and it is not cheap: B1ms is ~$14/mo and the
next step B2s is ~$56/mo — 4×, not 2×. Cap the pools first.

### Roles

`DATABASE_URL` must point at the **restricted `jotacular_app` role**, created by
`0001_app_role.sql`. Never the owner. PostgreSQL exempts superusers and
`BYPASSRLS` roles from every policy, so an owner connection string turns the
entire tenancy boundary off while every policy still reads as though it were
enforced. `DATABASE_ADMIN_URL` is the owner connection and is for **migrations
only**. `pnpm db:smoke` proves the boundary holds — run it against any
environment you are unsure about.

## Secrets

Key Vault `kv-jotdojo-prod-cus`, read at deploy time and materialised into a
Kubernetes Secret named `jotacular-secrets` in the `jotacular` namespace. The
manifests in `infra/k8s` mount it with `envFrom.secretRef`; nothing in this repo
contains a secret value.

Our CI identity holds **Key Vault Secrets User** — get and list, never write — so
a compromised workflow cannot rewrite a credential the product then deploys.
Loading a secret is a human action:

```
az keyvault secret set --vault-name kv-jotdojo-prod-cus --name DATABASE-URL --value '...'
```

Key Vault secret names allow only alphanumerics and hyphens, so an env var like
`DATABASE_URL` is stored as `DATABASE-URL` and the workflow maps it back.

## The deploy pipeline

This repo has its own workflows, and needs them: sparx's pipeline cannot deploy
Jotacular, because its release is scoped to its own overlay and its Azure identity
is a different OIDC subject. Two are enough, and both are written:
`.github/workflows/ci.yml` and `.github/workflows/release.yml`.

What follows describes what they do and why the order is what it is. Read it
before changing either.

### `ci.yml` — on pull request

`pnpm install --frozen-lockfile`, then `pnpm typecheck` and `pnpm lint`. No Azure
credential, no cluster access. Fast enough to be a gate.

### `release.yml` — on push to `main`

The stage order is the deployment, and it is the same order sparx uses for the
same reason: **data before containers**. If a migration fails, the old pods are
still serving.

**1. Authenticate.** OIDC, no stored credential. Needs
`permissions: { id-token: write, contents: read }` and these repository
variables:

| Variable | Value |
|---|---|
| `AZURE_CLIENT_ID` | from `terraform output jotacular_github_setup` |
| `AZURE_TENANT_ID` | ” |
| `AZURE_SUBSCRIPTION_ID` | ” |
| `AZURE_KEY_VAULT_NAME` | `kv-jotdojo-prod-cus` |

Run `terraform output jotacular_github_setup` in the sparx repo — it prints the
four `gh variable set` commands verbatim.

**2. Build and push four images** to `ghcr.io/brandonkorous/jotdojo/<service>`,
tagged with the commit SHA — never `latest`. Dockerfiles are in `infra/docker/`
and all four **build from the repo root**:

```
docker build -f infra/docker/api.Dockerfile -t ghcr.io/brandonkorous/jotdojo/api:$SHA .
```

**3. Get cluster credentials.**

```
az aks get-credentials -g rg-sparx-prod-cus -n aks-sparx-prod-cus --overwrite-existing
```

**4. Apply namespace, config, and the Secret** — before anything that reads them.
`kubectl apply -f infra/k8s/00-namespace.yaml -f infra/k8s/01-config.yaml`, then
read Key Vault and write `jotacular-secrets` with
`kubectl create secret generic ... --dry-run=client -o yaml | kubectl apply -f -`.

**5. Migrate, as a Job in the cluster.** This is the step that cannot be a
`pnpm db:migrate` on the runner (see constraint 1). Mount the migrations, run
them with `DATABASE_ADMIN_URL` from the Secret, and **wait for the Job and fail
the release if it fails** — a migration whose failure is not awaited is the same
as no migration at all, discovered later by a user.

**6. Roll the containers.** Apply the four manifests, then move each tag off the
`:latest` placeholder:

```
kubectl set image -n jotacular deploy/api api=ghcr.io/brandonkorous/jotdojo/api:$SHA
```

Then `kubectl rollout status` on each, with a timeout, so a wedged rollout fails
the release rather than going green.

### Two things to get right

**GHCR must be publicly readable, or the pull needs a long-lived credential.**
Do not authenticate the pull with a workflow-run token: it expires in hours,
while the pods it serves live for weeks. sparx lost twelve hours of production
to exactly that — a node evicted a pod, the replacement presented an expired
token, GHCR answered 403, and the API sat in `ImagePullBackOff`. Anonymous pull
has no expiry to get wrong.

**The worker rolls with `Recreate`, and that is deliberate.** Two workers
draining one outbox doubles concurrent vision and embedding calls — billed per
token, against a rate limit, on every deploy.

## The cross-repo part

Two things live in sparx and cannot be changed from here.

**Routing** — `k8s/ingress/Caddyfile`. **Five** hostnames carry the product, and
three of them proxy to the same Service:

The Services are named `web`, `api` and `mcp` — plainly, inside our namespace,
not prefixed with the product. Caddy addresses them by cluster DNS, so the
namespace is part of the address and is the half that moved in the rename:

| Hostname | `reverse_proxy` target | What it serves |
|---|---|---|
| `jotacular.com` | `web.jotacular.svc.cluster.local:80` | the marketing site |
| `www.jotacular.com` | `web.jotacular.svc.cluster.local:80` | the same, matched by the app (ADR-040) |
| `app.jotacular.com` | `web.jotacular.svc.cluster.local:80` | **the app.** Never the apex — ADR-010, ADR-018 |
| `api.jotacular.com` | `api.jotacular.svc.cluster.local:80` | REST v1, the Shortcuts endpoint |
| `mcp.jotacular.com` | `mcp.jotacular.svc.cluster.local:80` | MCP + the OAuth authorization server |

**Check the namespace, not just the hostname.** A block can name
`jotacular.com` and still proxy to `web.jotdojo.svc.cluster.local` — that is
exactly what the first cutover attempt did, and it is invisible from outside
because the old namespace answers perfectly well. It serves the wrong build,
and it means our deploy lands somewhere no traffic reaches. ADR-091.

This table used to name a `jotacular-web` Service, and a `jotdojo-web` before
the rename. Neither has ever existed. The sweep renamed a wrong string into a
differently wrong string, which is what a name nothing resolves gets you.

**TLS authorisation** — `wizeworks/services/api-rest/src/routes/internal/domain-check.ts`.
Those Caddy blocks use on-demand TLS, which asks that endpoint for permission
before issuing a certificate. Every hostname in the table above must be
allow-listed there, `app.` included.

**Adding a hostname is therefore a two-repo change**, and missing the allow-list
half produces a failure that looks nothing like its cause: the first HTTPS
request gets `403 unknown_host`, Caddy never issues, and Cloudflare answers
**525** for the whole product. There is no way to make this one-repo without
running a second ingress, which would mean a second load balancer.

## Before the first deploy

- [ ] Rename the local branch: `git branch -m master main`. The federated
      credential trusts `refs/heads/main` **only**; a push to `master` fails the
      token exchange with "no matching federated identity credential", which says
      nothing about branches.
- [ ] Apply the sparx-side Terraform so the database, vault, storage and CI
      identity exist.
- [ ] Set the four repository variables (step 1 above).
- [ ] Load the secrets into `kv-jotdojo-prod-cus`. Key Vault names allow only
      alphanumerics and hyphens, so the release step maps `DATABASE_URL` to a
      secret named `DATABASE-URL`; the authoritative list is the `required` and
      `optional` arrays in `.github/workflows/release.yml`.
- [ ] `JOTDOJO-APP-PASSWORD` must be the SAME password that appears inside
      `DATABASE-URL`. A release job runs `ALTER ROLE jotacular_app LOGIN PASSWORD`
      with it, so a mismatch resets the role out from under the connection
      string every service is using, and they all crashloop together.
- [ ] Adding a secret to the vault is not enough on its own. If its name is not
      in one of those two arrays the release never reads it, and the feature is
      off in production while the vault looks correctly configured.
- [ ] Point `jotacular.com`, `www`, `app`, `api` and `mcp` DNS at the cluster's ingress IP.
- [ ] Confirm the Caddyfile has an `app.jotacular.com` block proxying to
      `web.jotacular.svc.cluster.local:80` — the NAMESPACE is the half that moves,
      and that `app.` is in the `domain-check.ts` allow-list. Without it the app
      is unreachable while the marketing site loads perfectly, which reads as a
      DNS problem and is not one.
- [ ] Confirm `MCP_RESOURCE` is exactly `https://mcp.jotacular.com/mcp` — RFC 8707
      binds every access token to that literal string.
- [ ] If the deployment takes money: register the Stripe webhook at
      `https://app.jotacular.com/api/billing/webhook`, subscribed to
      `customer.subscription.created`, `.updated` and `.deleted` — those three
      and not `checkout.session.completed`, which this integration ignores. A
      key without a registered webhook charges cards and grants nothing, and it
      is silent on both sides (ADR-049).
- [ ] Load `STRIPE_WEBHOOK_SECRET` from that endpoint, plus the three
      `STRIPE_PRICE_*` ids for THIS environment. Test-mode price ids in a live
      deployment fail at checkout, not at boot.
- [ ] Leave `BILLING_PROVIDER` unset until all of the above is true. Unset means
      everyone is on the free plan and nothing pretends otherwise.
