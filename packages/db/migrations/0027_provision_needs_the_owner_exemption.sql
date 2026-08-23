-- Account creation was impossible in production. ADR-057.
--
-- 0002 says it plainly: "There is deliberately NO insert policy on users,
-- spaces or space_members. Account creation goes through app_provision_user()
-- below, so there is exactly one auditable door into existence."
--
-- That door only opens if the SECURITY DEFINER function's owner is exempt from
-- RLS. 0000 then set FORCE ROW LEVEL SECURITY on all three tables, and FORCE
-- is precisely the flag that REMOVES the table owner's exemption. The two
-- decisions cannot both hold: with FORCE on and no INSERT policy anywhere,
-- `app_provision_user` is a door welded shut.
--
-- It passed every suite because a developer's DATABASE_ADMIN_URL is `postgres`,
-- a superuser, and superusers bypass RLS unconditionally -- FORCE included.
-- Production's owner is `jotdojo_owner`, which is neither superuser nor
-- BYPASSRLS, so there the INSERT raised
-- "new row violates row-level security policy for table users" and every
-- Google sign-in died as an opaque Auth.js configuration error. The users
-- table had zero rows.

ALTER TABLE users         NO FORCE ROW LEVEL SECURITY;
ALTER TABLE spaces        NO FORCE ROW LEVEL SECURITY;
ALTER TABLE space_members NO FORCE ROW LEVEL SECURITY;

-- WHAT THIS DOES NOT WEAKEN.
--
-- FORCE only ever applied to the table OWNER. The application connects as
-- `jotdojo_app`, which does not own these tables, so every policy on them
-- still applies to it exactly as before -- including the fact that it has
-- table-level INSERT and is stopped by RLS alone. The tenancy boundary is
-- untouched; what changes is that the owner, and therefore the definer
-- functions that exist to do this one job, can do it again.
--
-- notes, blocks, media_assets and the rest KEEP FORCE. Those hold tenant
-- content, nothing writes to them through a definer function, and the owner
-- has no business reading across spaces there.

COMMENT ON FUNCTION app_provision_user(text, text, text, text) IS
  'The one door into existence. Requires the owner exemption from RLS, so '
  'users/spaces/space_members must never be set FORCE ROW LEVEL SECURITY '
  'again -- see 0027 and ADR-057.';
