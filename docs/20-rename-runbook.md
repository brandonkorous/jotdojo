# Moving jotdojo → jotacular

The code, the config and the docs are done (ADR-086). What is left is state that
lives outside this repository: DNS, a Caddy site block, a Key Vault secret, and
two Postgres names. Each step below says what breaks if it is skipped.

Do this while **nobody has the PWA installed and no agent is connected**. That
window is the entire reason the move is cheap; after it, `app.` is baked into
home-screen icons and `mcp.` is the audience on every live access token
(ADR-074).

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

The overlap is handled at the **edge**, not in application code: jotdojo.com
301s to jotacular.com at Cloudflare and never reaches the cluster, so
`isMarketingHost` only knows one apex. That is the better place for it — a
redirect passes link equity, and a branch in `hosts.ts` would only have served
the old name forever.

**The redirect must preserve the path.** A root-only rule leaves every indexed
`/blog/...` URL returning 404 rather than pointing at its new home, and the blog
is the distribution (`16-web-presence.md`). In Cloudflare that is a wildcard
Redirect Rule — `jotdojo.com/*` to `https://jotacular.com/${1}`, 301 — not a
single-URL redirect.

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

### The three vault keys, by name

`release.yml` reads Key Vault by key name and turns underscores into hyphens,
and its **required** list names `JOTACULAR_APP_PASSWORD`. That is a key which
has to be *created*: the vault holds `JOTDOJO-APP-PASSWORD`, so the deploy asks
for a name nothing answers to and stops.

    ##[error]Missing required secrets in kv-jotdojo-prod-cus: JOTACULAR-APP-PASSWORD

The gate sits in front of the migration, so a deploy attempted before this
window fails harmlessly — the images build, the namespace and ConfigMap apply,
and nothing rolls. That is also why creating this one key *alone* makes the next
run worse rather than better: it opens the gate, `0034` renames the role, and
the pods then start against a `DATABASE-URL` that still says `jotdojo_app`.

The three move together or not at all:

| Key | Change |
| --- | --- |
| `JOTACULAR-APP-PASSWORD` | new — copy the value of `JOTDOJO-APP-PASSWORD` |
| `DATABASE-URL` | `jotdojo_app` → `jotacular_app` |
| `DATABASE-ADMIN-URL` | `jotdojo_owner` → `jotacular_owner`, after the superuser rename above |

**Copy the password across, never retype it.** Reading one secret straight into
the other keeps the value out of a terminal and out of a shell history:

    az keyvault secret set --vault-name kv-jotdojo-prod-cus \
      --name JOTACULAR-APP-PASSWORD \
      --value "$(az keyvault secret show --vault-name kv-jotdojo-prod-cus \
                   --name JOTDOJO-APP-PASSWORD --query value -o tsv)"

A copy is also what disarms the trap above. The value crosses unchanged, so it
cannot be caught by a sweep rewriting the product name — the danger is only ever
in a human retyping it.

The *database* name inside both URLs changes in §5, not here.
`JOTDOJO-OWNER-PASSWORD` is read by no workflow, so nothing automated breaks if
its name stays stale.

## 5. Postgres — the database

    ALTER DATABASE jotdojo RENAME TO jotacular;

Cannot run inside a transaction and needs **no connections to that database** —
so it is not a migration. Stop the pods (or `pnpm dev`) first.

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
