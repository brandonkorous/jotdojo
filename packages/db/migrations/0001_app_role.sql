-- The application must NOT connect as a superuser or as the table owner.
--
-- This is not a hardening nicety, it is the difference between having RLS and
-- only appearing to. PostgreSQL exempts superusers and BYPASSRLS roles from
-- every policy, and exempts the table owner unless FORCE ROW LEVEL SECURITY is
-- set. Connecting as `postgres` therefore makes the entire tenancy boundary
-- inert while every policy still reads as though it were enforced -- which is
-- exactly what packages/db/scripts/smoke-rls.ts caught on first run.
--
-- So: migrations run as the owner, the application runs as jotdojo_app, and
-- scripts/smoke-rls.ts proves the difference on every check.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jotdojo_app') THEN
    -- No password here on purpose. Local development sets one via
    -- `pnpm db:dev-role`; production sets it out of band from Key Vault.
    CREATE ROLE jotdojo_app LOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO jotdojo_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO jotdojo_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO jotdojo_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO jotdojo_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO jotdojo_app;

-- No DDL, and explicitly no BYPASSRLS. The only role that may cross spaces is
-- jotdojo_worker (created in 0000), and nothing but the worker uses it.
REVOKE CREATE ON SCHEMA public FROM jotdojo_app;
