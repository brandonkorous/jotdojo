-- The column grant that guards `plan` was never the only grant. Issue 048.
--
-- 0024_triage.sql added an owner UPDATE policy on `spaces` and narrowed the
-- column grant to `triage_enabled`, and said in its own comment why that pair
-- is what makes it safe:
--
--   "a row policy cannot name columns, and a GRANT cannot name rows, so it
--    takes both"
--
-- The reasoning is right. The implementation was missing a line. A column GRANT
-- ADDS a privilege; it does not remove a table-wide one, and 0001_app_role.sql
-- had already issued
--
--   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
--
-- so the narrow grant in 0024 added nothing the app role did not already have.
-- Measured before writing this: the role held UPDATE on every column of
-- `spaces`, including `plan`, and the owner policy let it reach its own row.
--
-- Not exploitable as it stood -- nothing writes `spaces` with caller-supplied
-- columns -- but the comment describes a fence that was not there, and the next
-- person to add an `UPDATE spaces` would have believed it.

REVOKE UPDATE ON spaces FROM jotacular_app;

-- Exactly the two columns app code writes by name, and no more:
--   `name`            renameSpace, issue 003
--   `triage_enabled`  the triage switch, ADR-024
--
-- `plan`, `triage_last_run_at` and the anonymous-claim columns are written by
-- app_apply_subscription, app_cancel_subscription, app_enqueue_triage and
-- app_claim_anon_space, which are SECURITY DEFINER and therefore run as the
-- owner. They do not need, and must not have, a grant on this role.
GRANT UPDATE (name, triage_enabled) ON spaces TO jotacular_app;
