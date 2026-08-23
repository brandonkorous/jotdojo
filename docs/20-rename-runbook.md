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

`isMarketingHost` accepts **both** apexes (`hosts.ts`), so the old domain keeps
serving the marketing site rather than the app tree, which ADR-010 forbids.
Remove `FORMER_SITE_HOST` when jotdojo.com stops resolving.

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
