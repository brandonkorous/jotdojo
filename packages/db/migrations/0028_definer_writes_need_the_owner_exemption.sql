-- 0027 fixed three tables. The problem was never about three tables. ADR-057.
--
-- The hero canvas still could not create an anonymous draft after 0027:
--   new row violates row-level security policy for table "anon_sessions"
--
-- Because the rule is general. This schema's authority model (ADR-024) is that
-- background and pre-actor work goes through SECURITY DEFINER functions rather
-- than a BYPASSRLS role. A definer function runs as the table OWNER, and FORCE
-- ROW LEVEL SECURITY is exactly the flag that strips the owner's exemption. So
-- FORCE breaks every one of them, not just the three that create accounts.
--
-- Sixteen tables are written by definer functions. Twelve still had FORCE.
--
-- AND THE SECOND FAILURE MODE IS WORSE THAN THE FIRST. Where a table has no
-- INSERT policy (anon_sessions, oauth_clients, recognition_usage, space_billing)
-- the write RAISES. Where it has an ALL policy keyed on app_actor_id() -- blocks,
-- notes, comments, oauth_tokens -- there IS no actor inside `withoutActor`, so
-- the policy simply matches nothing and the UPDATE reports success having
-- changed zero rows. A transcript that was never stored, with no error anywhere.

ALTER TABLE anon_sessions     NO FORCE ROW LEVEL SECURITY;
ALTER TABLE block_embeddings  NO FORCE ROW LEVEL SECURITY;
ALTER TABLE blocks            NO FORCE ROW LEVEL SECURITY;
ALTER TABLE capture_tokens    NO FORCE ROW LEVEL SECURITY;
ALTER TABLE comments          NO FORCE ROW LEVEL SECURITY;
ALTER TABLE notes             NO FORCE ROW LEVEL SECURITY;
ALTER TABLE oauth_auth_codes  NO FORCE ROW LEVEL SECURITY;
ALTER TABLE oauth_clients     NO FORCE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens      NO FORCE ROW LEVEL SECURITY;
ALTER TABLE recognition_usage NO FORCE ROW LEVEL SECURITY;
ALTER TABLE space_billing     NO FORCE ROW LEVEL SECURITY;
ALTER TABLE space_invites     NO FORCE ROW LEVEL SECURITY;

-- audit_log, capture_requests, mcp_clients, mcp_grants, media_assets and
-- note_revisions KEEP FORCE. No definer function writes to them -- the
-- application does, as jotdojo_app, which never owned them and is therefore
-- bound by every policy either way.

-- WHAT ACTUALLY DEFENDS THE BOUNDARY NOW.
--
-- 0001 wanted FORCE so that pointing the application at the owner's connection
-- string could not make RLS inert. That was a real concern and it needs a real
-- answer, because FORCE was never able to be the answer here: the same
-- exemption it removes is the one every definer function depends on.
--
-- The answer is direct instead of incidental. `assertNotOwner()` in
-- packages/db refuses at startup if DATABASE_URL connects as a role that owns
-- these tables, and smoke-rls asserts the same thing. A misconfigured URL now
-- fails loudly on the first connection rather than quietly serving every
-- tenant's rows to every other tenant.

COMMENT ON TABLE anon_sessions IS
  'Written by app_create_anon_space and app_claim_anon_space, both SECURITY '
  'DEFINER. Must never be set FORCE ROW LEVEL SECURITY -- see 0028, ADR-057.';
