# 048 — The column grant that guards `plan` was never the only grant

**Status:** fixed
**Severity:** minor
**Found by:** implementing issue 003 · 2026-09-16
**Surface:** database › grants on `spaces`
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** the grant table, and 50 of 50 suites · 2026-09-16
**Blocked on:** —

## What happened

Issue 003 needs to write `spaces.name`, so the first question was whether the app
role is allowed to. Checking that turned up something else.

`packages/db/migrations/0024_triage.sql` adds an owner UPDATE policy and then says,
in its own comment, exactly what makes it safe:

```sql
-- Owners turn it on; members see the switch and cannot flip it. The column
-- grant is what keeps this policy from becoming a way to edit `plan` -- a row
-- policy cannot name columns, and a GRANT cannot name rows, so it takes both.
CREATE POLICY spaces_owner_settings ON spaces FOR UPDATE
  USING (app_is_space_owner(id)) WITH CHECK (app_is_space_owner(id));

GRANT UPDATE (triage_enabled) ON spaces TO jotdojo_app;
```

**The reasoning is right and the implementation is missing a line.** A column GRANT
*adds* a privilege; it does not remove a table-wide one. And
`0001_app_role.sql:25` had already given the app role the lot:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO jotdojo_app;
```

There is **no `REVOKE UPDATE ON spaces`** anywhere in the migrations, so the narrow
grant in 0024 added nothing it did not already have.

## Measured, not reasoned

On the live database, for the app role (renamed to `jotacular_app` by
`0034_rename_roles.sql`):

```
select privilege_type, column_name from information_schema.column_privileges
 where table_name='spaces' and grantee='jotacular_app' and privilege_type='UPDATE';

 UPDATE | created_at
 UPDATE | created_by
 UPDATE | id
 UPDATE | kind
 UPDATE | name
 UPDATE | plan              <- the column 0024 believed it had fenced off
 UPDATE | triage_enabled
 UPDATE | triage_last_run_at
```

And the row side is exactly as 0024 describes:

```
spaces            relrowsecurity = t
policies          spaces_member          r  (SELECT)
                  spaces_owner_settings  w  (UPDATE, owner only)
```

So the pair that 0024 says "takes both" is, in fact, one: **an owner may update any
column of their own space**, including `plan`.

## Why it is only `minor`

**It is not exploitable today, and that is a fact about the code rather than about
the database.** Nothing in the domain layer writes `spaces` with caller-supplied
columns:

- `setToolbarSide` writes `users`, not `spaces`.
- The triage switch writes `spaces.triage_enabled` and names that column.
- Plans are written by `app_apply_subscription`, a SECURITY DEFINER function behind
  Stripe's webhook.

So this is **defence-in-depth that is not there**, not a hole. It is filed because
the migration says in writing that the defence exists, and a comment that describes
a guard nobody has is worse than no comment: the next person to add an `UPDATE
spaces` will read it and believe they are covered.

## Why it surfaced now

Issue 003 adds the first code path that writes `spaces.name` on a person's say-so.
That path is safe — it names one column — but it is the first time anything has
leaned on this policy for something other than a boolean, which is why it was worth
looking at the grant behind it.

## The fix

`0039_the_column_grant_needs_a_revoke.sql`, run by Brandon's leave on 2026-09-16:

```sql
REVOKE UPDATE ON spaces FROM jotacular_app;
GRANT UPDATE (name, triage_enabled) ON spaces TO jotacular_app;
```

**Exactly the two columns app code writes by name**, established by looking rather
than guessing — `renameSpace` writes `name` (issue 003) and the triage switch writes
`triage_enabled` (ADR-024), and there is no third.

**Everything else that writes `spaces` is SECURITY DEFINER and owned by `postgres`**,
so it runs with the owner's rights and never needed this role's grant:

```
app_apply_subscription    owner=postgres     writes plan
app_cancel_subscription   owner=postgres     writes plan
app_enqueue_triage        owner=postgres     writes triage_last_run_at
app_claim_anon_space      owner=postgres     writes the claim columns
```

That was checked BEFORE the revoke, because revoking a grant something quietly
depends on is how this kind of fix breaks a product.

## Confirmed by

**2026-09-16.** The grant table, before and after:

```
before   created_at, created_by, id, kind, name, plan,
         triage_enabled, triage_last_run_at
after    name, triage_enabled
```

Table-level privileges for `jotacular_app` on `spaces` are now
**`INSERT, SELECT, DELETE`** — the blanket `UPDATE` from `0001_app_role.sql` is gone,
which is the line 0024 was missing. **`plan` is no longer writable by the app role at
all**, so the pair 0024 described — a row policy and a column grant — is finally the
pair it says it is.

The two policies are untouched, as intended:

```
spaces_member          r   (SELECT)
spaces_owner_settings  w   (UPDATE, owner only)
```

**Nothing depended on the grant that was removed.** Every suite that writes a space
was re-run first — `rename`, `invite`, `triage`, `seats`, `billing`, `members`,
`anon`, `metering`, all **PASS** — and then the whole set: **50 of 50**.
