-- 0000 wrote every policy with USING only, which is a read predicate.
-- PostgreSQL applies USING to SELECT/UPDATE/DELETE and requires WITH CHECK for
-- rows being written; a policy with neither denies INSERT outright. So with the
-- app finally running as a non-superuser (0001), every write failed with 42501.
--
-- Both bugs were invisible while the app connected as postgres. This is the
-- second one that smoke-rls.ts caught, and the reason it runs in CI.

DROP POLICY IF EXISTS users_self          ON users;
DROP POLICY IF EXISTS users_update_self   ON users;
DROP POLICY IF EXISTS spaces_member       ON spaces;
DROP POLICY IF EXISTS space_members_visible ON space_members;
DROP POLICY IF EXISTS notes_member        ON notes;
DROP POLICY IF EXISTS blocks_member       ON blocks;
DROP POLICY IF EXISTS media_member        ON media_assets;
DROP POLICY IF EXISTS comments_member     ON comments;
DROP POLICY IF EXISTS revisions_member    ON note_revisions;
DROP POLICY IF EXISTS embeddings_member   ON block_embeddings;
DROP POLICY IF EXISTS audit_member        ON audit_log;

-- Read yourself, and anyone who shares a space with you.
CREATE POLICY users_read ON users FOR SELECT USING (
  id = app_actor_id()
  OR EXISTS (
    SELECT 1 FROM space_members mine
    JOIN space_members theirs ON theirs.space_id = mine.space_id
    WHERE mine.user_id = app_actor_id() AND theirs.user_id = users.id
  )
);

-- Edit only yourself, and you cannot edit yourself into someone else.
CREATE POLICY users_update ON users FOR UPDATE
  USING (id = app_actor_id())
  WITH CHECK (id = app_actor_id());

-- There is deliberately NO insert policy on users, spaces or space_members.
-- Account creation goes through app_provision_user() below, so there is exactly
-- one auditable door into existence rather than a blanket INSERT grant.

CREATE POLICY spaces_member ON spaces FOR SELECT USING (app_can_reach_space(id));
CREATE POLICY space_members_visible ON space_members FOR SELECT
  USING (app_can_reach_space(space_id));

-- Members may read and write everything in a space they belong to, and may not
-- write a row INTO a space they do not belong to.
CREATE POLICY notes_member ON notes FOR ALL
  USING (app_can_reach_space(space_id)) WITH CHECK (app_can_reach_space(space_id));
CREATE POLICY blocks_member ON blocks FOR ALL
  USING (app_can_reach_space(space_id)) WITH CHECK (app_can_reach_space(space_id));
CREATE POLICY media_member ON media_assets FOR ALL
  USING (app_can_reach_space(space_id)) WITH CHECK (app_can_reach_space(space_id));
CREATE POLICY comments_member ON comments FOR ALL
  USING (app_can_reach_space(space_id)) WITH CHECK (app_can_reach_space(space_id));
CREATE POLICY revisions_member ON note_revisions FOR ALL
  USING (app_can_reach_space(space_id)) WITH CHECK (app_can_reach_space(space_id));
CREATE POLICY embeddings_member ON block_embeddings FOR ALL
  USING (app_can_reach_space(space_id)) WITH CHECK (app_can_reach_space(space_id));

-- The audit log is append-only from the application's point of view: a member
-- may read their spaces' entries and add to them, and may never alter one.
CREATE POLICY audit_read ON audit_log FOR SELECT USING (app_can_reach_space(space_id));
CREATE POLICY audit_append ON audit_log FOR INSERT WITH CHECK (app_can_reach_space(space_id));

-- Agent credentials belong to one person and are never visible to space peers.
DROP POLICY IF EXISTS mcp_clients_own ON mcp_clients;
DROP POLICY IF EXISTS mcp_grants_own  ON mcp_grants;

CREATE POLICY mcp_clients_own ON mcp_clients FOR ALL
  USING (user_id = app_actor_id()) WITH CHECK (user_id = app_actor_id());

CREATE POLICY mcp_grants_own ON mcp_grants FOR ALL
  USING (EXISTS (SELECT 1 FROM mcp_clients c
                 WHERE c.id = mcp_grants.mcp_client_id AND c.user_id = app_actor_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM mcp_clients c
                      WHERE c.id = mcp_grants.mcp_client_id AND c.user_id = app_actor_id()));
