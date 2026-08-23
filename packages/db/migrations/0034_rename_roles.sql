-- The product is Jotacular, so its roles are too. ADR-086.
--
-- ALTER ROLE keeps every GRANT and every POLICY. Postgres records both against
-- the role's OID rather than its name, so nothing in 0000-0033 changes -- and
-- those files stay the literal record of what ran (CLAUDE.md).
--
-- Guarded both ways so this is safe on a fresh database (where 0000 and 0001
-- have just created the old names) and on one somebody already renamed by hand.
--
-- The OWNER is deliberately absent. Migrations run AS the owner, and Postgres
-- refuses "session user cannot be renamed" -- so that one is a superuser step,
-- paired with the DATABASE_ADMIN_URL secret. See docs/20-rename-runbook.md.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jotdojo_app')
     AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jotacular_app')
  THEN
    ALTER ROLE jotdojo_app RENAME TO jotacular_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jotdojo_worker')
     AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jotacular_worker')
  THEN
    ALTER ROLE jotdojo_worker RENAME TO jotacular_worker;
  END IF;
END $$;
