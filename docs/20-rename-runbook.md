# Moving jotdojo → jotacular

**Done, 2026-08-24.** jotacular.com serves the site, `app.` the app, `mcp.` the
agent endpoint, and production runs as `jotacular_app`. This is the record of
what it took and what deliberately did not move — keep it, because two of the
steps below are the kind that only bite once and the bite is invisible.

It was done while **nobody had the PWA installed and no agent was connected**.
That window was the entire reason the move was cheap: after it, `app.` is baked
into home-screen icons and `mcp.` is the audience on every live access token
(ADR-074, ADR-086).

---

## 1. sparx — DNS and Caddy

In the sparx repo, `terraform/envs/azure/jotacular.tf` and the Caddy config:

- point `jotacular.com`, `app.`, `api.` and `mcp.` at the same cluster ingress
- add all four to the domain-check allow-list
- **leave the jotdojo.com site block in place** for the overlap

Until this lands, `SITE_URL` must keep its old value — see step 2.

## 2. This repo — flip the environment

`infra/k8s/01-config.yaml` already carries the new hostnames. Deploying it
before step 1 points the app at a domain that does not resolve.

jotdojo.com 301s to jotacular.com at Cloudflare and never reaches the cluster,
so `isMarketingHost` only knows one apex.

**Nothing was tied to the old domain, so nothing needed preserving.** The site
was a day old: no inbound links, no index, no bookmarks. The root-only redirect
that exists is a courtesy, not a requirement, and the in-app redirect for a
moved blog slug was deleted for the same reason (ADR-095). A compatibility shim
is a debt against real users and is only worth taking on when there are some.

## 3. Email

`legal@` and `hello@` in `content/legal/privacy.md` and `terms.md` now read
`@jotacular.com`. Those addresses have to receive mail before the policy is
published, or the policy names a mailbox that bounces.

## 4. Postgres — roles

Migration `0034_rename_roles.sql` renames `jotdojo_app` and `jotdojo_worker`.
`ALTER ROLE` keeps every grant and policy: Postgres records them against the
role's OID, not its name.

The **owner** is not in that migration. Migrations run *as* the owner and
Postgres refuses `session user cannot be renamed`. Do it as a superuser:

    ALTER ROLE jotdojo_owner RENAME TO jotacular_owner;

Passwords survive the rename itself because the server is `scram-sha-256`. On an
`md5` server they do not: the hash is salted with the role name, so a rename
silently clears it. Check `SHOW password_encryption` first.

They can still break for a different reason. **Our dev password was the word
`jotdojo`**, so the sweep that rewrote `.env` rewrote the secret too, and the
role kept the old one — `password authentication failed for user
"jotacular_app"`. Locally that is `pnpm db:dev-role`. In production it means the
Key Vault secret and `ALTER ROLE ... PASSWORD` have to agree, so check whether
the product name appears in the password before assuming a rename is safe.

**In the same window**, update `DATABASE_URL` and `DATABASE_ADMIN_URL` in Key
Vault. A renamed role with an old connection string is an app that cannot log
in, and the failure is immediate.

### The vault keys, by name

The vault is `kv-jotdojo-prod-cus` and keeps that name (§7). So does the app
password: `release.yml` reads `JOTDOJO_APP_PASSWORD` and the vault key is not
renamed. ADR-090 — renaming it means destroying and recreating the only copy of
a live credential to change a string nothing but that list reads.

The first attempt got this wrong. The sweep renamed the key in the required
list, the vault had no such key, and the deploy stopped:

    ##[error]Missing required secrets in kv-jotdojo-prod-cus: JOTACULAR-APP-PASSWORD

That gate sits in front of the migration, so a deploy attempted before this
window fails harmlessly — images build, the namespace and ConfigMap apply, and
nothing rolls.

**One value still has to change, and the key rename does not save you from it.**

| Key | Change |
| --- | --- |
| `JOTDOJO-APP-PASSWORD` | none — the workflow reads this name now |
| `DATABASE-URL` | `jotdojo_app` → `jotacular_app` |
| `DATABASE-ADMIN-URL` | `jotdojo_owner` → `jotacular_owner`, after the superuser rename above |

`0034` renames the role. A connection string still naming `jotdojo_app` after
that points at a role which does not exist, and every service crashloops
together. Edit the value in place rather than retyping the string, so the
password inside it carries across untouched:

    az keyvault secret set --vault-name kv-jotdojo-prod-cus --name DATABASE-URL       --value "$(az keyvault secret show --vault-name kv-jotdojo-prod-cus                    --name DATABASE-URL --query value -o tsv                  | sed 's/jotdojo_app/jotacular_app/')"

That is also what disarms the trap above: the password crosses unchanged and
cannot be caught by a sweep rewriting the product name. The danger is only ever
in a human retyping it.

The *database* name inside both URLs changes in §5, not here.
`JOTDOJO-OWNER-PASSWORD` is read by no workflow, so nothing automated breaks if
its name stays stale.

### What actually went wrong, and why nothing looked wrong

The role rename and the secret have to move **together**, and they came apart.
Migration `0034` renamed `jotdojo_app` in production. The vault was then set
back to `jotdojo_app` about twenty minutes later, by a hand that reasonably
thought the rename was being skipped. From that point every service in the
cluster was holding a connection string for a role that did not exist.

**The site stayed up the whole time.** The marketing pages are static, so they
served perfectly while the database was unreachable behind them, and the pods
reported `1/1 Running` because a lazy pool does not connect until something
asks it to. Nothing was red. The failure surfaced only when the connection
string was tried directly:

    kubectl run pg -n jotacular --rm -i --restart=Never --image=postgres:18-alpine       --overrides='...secretKeyRef: jotacular-secrets/DATABASE_URL...'       -- sh -c 'psql "$DATABASE_URL" -tAc "select current_user"'

    FATAL:  password authentication failed for user "jotdojo_app"

Two things to take from it. **`200` on the apex proves nothing about the
database** on a site whose front page is static — check a role, not a page. And
a Key Vault secret has version history: `az keyvault secret list-versions`
showed the revert as a timestamp, which is how the twenty minutes was found.

The vault and the cluster agree again, and a redeploy is what carries a
corrected secret into the running pods — editing the vault alone changes
nothing, because the k8s Secret is built from it at deploy time.

## 5. Postgres — the database

**Not done in production, on purpose.** The database is still called `jotdojo`
there, inside both connection strings. Renaming it buys nothing a person can
see and costs a window with no connections to it:

    ALTER DATABASE jotdojo RENAME TO jotacular;

Cannot run inside a transaction and needs **no connections to that database** —
so it is not a migration. Both vault URLs change in the same window. Local
development did it, because there the window is `pnpm db:down`.

## 6. Local development

The dev volume holds real notes — 3,347 of them at the time of writing — so it
is copied rather than recreated. `docker-compose.yml` pins the project name to
`jotacular`, because the directory is still `jotDOJO` and would otherwise keep
prefixing volumes with the old name.

    pnpm db:down
    docker volume create jotacular_jotacular-pgdata
    docker run --rm \
      -v jotdojo_jotdojo-pgdata:/from \
      -v jotacular_jotacular-pgdata:/to \
      alpine sh -c "cd /from && cp -a . /to"
    pnpm db:up
    docker exec jotacular-postgres psql -U postgres -c \
      "ALTER DATABASE jotdojo RENAME TO jotacular"
    pnpm db:migrate

Then, once the app runs against it, delete the old volume:

    docker volume rm jotdojo_jotdojo-pgdata

## 7. What deliberately did not move

- **`packages/db/migrations/0000`–`0033`.** A literal record of what ran, never
  edited (CLAUDE.md). They still create `jotdojo_app`; `0034` renames it
  immediately after, so a database built from scratch lands on the new name.
- **The repo directory**, still `jotDOJO`. Renaming a checkout that other
  sessions and editors hold open buys nothing.
- **`kv-jotdojo-prod-cus`.** Renaming an Azure Key Vault is a destroy and
  recreate, and the name is not something a person reads.
