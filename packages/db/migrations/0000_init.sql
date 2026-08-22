-- jotdojo initial schema. See docs/04-data-model.md.
--
-- Tenancy is enforced by row-level security keyed to space membership, so an
-- application-layer bug produces an error instead of a data leak. Every policy
-- reads current_setting('app.actor_id'), which the domain layer sets per
-- transaction via withActor(). FORCE ROW LEVEL SECURITY is used so the table
-- owner is subject to the policies too -- without it, local development (where
-- the app connects as the owner) would silently bypass every policy and we
-- would never notice a missing one until production.

-- Extensions, guarded by a CATALOG LOOKUP rather than by `IF NOT EXISTS`.
--
-- Those two are not equivalent on Azure Database for PostgreSQL, and that
-- difference is the whole reason this block looks like it does.
--
-- `vector` is not a trusted extension, so Azure permits CREATE EXTENSION only to
-- members of `azure_pg_admin`. That check lives in a ProcessUtility hook
-- (`check_extension_permissions`, azure_utils.c) which runs BEFORE PostgreSQL
-- evaluates `IF NOT EXISTS` — so on a managed server the statement is refused
-- even when the extension is already installed and would have done nothing:
--
--     ERROR:  Because vector isn't a trusted extension, only members of
--             "azure_pg_admin" are allowed to use CREATE EXTENSION vector
--
-- Stock PostgreSQL checks existence first and never reaches a permission check,
-- which is why this passes on a laptop and on any self-hosted server, and fails
-- only where it matters.
--
-- In production the extensions are installed ahead of this migration by the
-- platform that owns the SERVER, using the admin login this database's owner
-- deliberately is not. The alternative — making `jotdojo_owner` a member of
-- `azure_pg_admin` — would hand this database's role administrative rights over
-- every other database on the instance, which is a steep price for three lines
-- of DDL.
--
-- So: look in the catalog, and issue CREATE EXTENSION only when it is genuinely
-- absent. Present, the statement never executes and the hook never fires;
-- absent, it runs exactly as before — which is what happens on a developer's
-- machine, where nothing has installed them for us.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    CREATE EXTENSION vector;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    CREATE EXTENSION pg_trgm;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'citext') THEN
    CREATE EXTENSION citext;
  END IF;
END
$$;

-- Returns the acting user, or NULL when unset. NULL denies everything, which
-- is the correct default for a connection that forgot to identify itself.
CREATE OR REPLACE FUNCTION app_actor_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.actor_id', true), '')::uuid
$$;

-- ---------------------------------------------------------------- identity --

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub    text UNIQUE NOT NULL,
  email         citext UNIQUE NOT NULL,
  display_name  text,
  avatar_url    text,
  -- UI preference: which side the tool rail sits on. See ADR-012.
  toolbar_side  text NOT NULL DEFAULT 'auto' CHECK (toolbar_side IN ('auto','left','right')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE spaces (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  kind        text NOT NULL DEFAULT 'personal' CHECK (kind IN ('personal','family','team')),
  plan        text NOT NULL DEFAULT 'free',
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE space_members (
  space_id  uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, user_id)
);

CREATE INDEX space_members_user_idx ON space_members (user_id);

-- ------------------------------------------------------------------ notes --

CREATE TABLE notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id     uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  title        text,
  title_source text NOT NULL DEFAULT 'inferred' CHECK (title_source IN ('user','inferred')),
  revision     integer NOT NULL DEFAULT 1,
  pinned       boolean NOT NULL DEFAULT false,
  archived_at  timestamptz,
  deleted_at   timestamptz,
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notes_space_updated_idx ON notes (space_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE media_assets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id    uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('ink','audio','image')),
  blob_url    text,
  strokes     jsonb,
  mime_type   text,
  byte_size   bigint,
  duration_ms integer,
  width       integer,
  height      integer,
  preview_url text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE blocks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id          uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  space_id         uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  position         integer NOT NULL,
  kind             text NOT NULL CHECK (kind IN ('text','ink','audio','image')),
  -- The universal four fields. Every modality collapses to these, which is why
  -- adding one later is a new recognizer and not a schema change.
  body             text,
  artifact_id      uuid REFERENCES media_assets(id) ON DELETE SET NULL,
  transcript       text,
  transcript_source text,
  confidence       real,
  transcript_state text NOT NULL DEFAULT 'ready'
    CHECK (transcript_state IN ('pending','ready','failed','deferred')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  searchable       tsvector GENERATED ALWAYS AS (
                     to_tsvector('english', coalesce(body, transcript, ''))
                   ) STORED
);

CREATE INDEX blocks_note_position_idx ON blocks (note_id, position);
CREATE INDEX blocks_search_idx ON blocks USING GIN (searchable);

-- ------------------------------------------------- attribution and history --

CREATE TABLE mcp_clients (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_name         text,
  client_id           text NOT NULL,
  registration_source text CHECK (registration_source IN ('dcr','cimd','preregistered')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  revoked_at          timestamptz
);

CREATE TABLE mcp_grants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mcp_client_id uuid NOT NULL REFERENCES mcp_clients(id) ON DELETE CASCADE,
  space_id      uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  scopes        text[] NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz,
  UNIQUE (mcp_client_id, space_id)
);

CREATE TABLE comments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id         uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  space_id        uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  body            text NOT NULL,
  author_type     text NOT NULL CHECK (author_type IN ('user','agent')),
  author_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  agent_client_id uuid REFERENCES mcp_clients(id) ON DELETE SET NULL,
  agent_model     text,
  in_reply_to     uuid REFERENCES comments(id) ON DELETE CASCADE,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- An agent comment must name its client; a human comment must name its user.
  CONSTRAINT comments_author_ck CHECK (
    (author_type = 'user'  AND author_user_id  IS NOT NULL) OR
    (author_type = 'agent' AND agent_client_id IS NOT NULL)
  )
);

CREATE INDEX comments_note_idx ON comments (note_id, created_at);

CREATE TABLE note_revisions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id         uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  space_id        uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  revision        integer NOT NULL,
  snapshot        jsonb NOT NULL,
  author_type     text NOT NULL CHECK (author_type IN ('user','agent')),
  author_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  agent_client_id uuid REFERENCES mcp_clients(id) ON DELETE SET NULL,
  agent_model     text,
  summary         text,
  reverted_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (note_id, revision)
);

-- ----------------------------------------------------- search and pipeline --

CREATE TABLE block_embeddings (
  block_id   uuid PRIMARY KEY REFERENCES blocks(id) ON DELETE CASCADE,
  space_id   uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  embedding  vector(1536) NOT NULL,
  model      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX block_embeddings_hnsw_idx ON block_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- Written in the same transaction as the entity it describes, so a capture
-- that commits always has its follow-up work queued. See docs/07.
CREATE TABLE outbox (
  id           bigserial PRIMARY KEY,
  topic        text NOT NULL,
  payload      jsonb NOT NULL,
  available_at timestamptz NOT NULL DEFAULT now(),
  attempts     integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  completed_at timestamptz,
  last_error   text
);

CREATE INDEX outbox_claimable_idx ON outbox (available_at)
  WHERE completed_at IS NULL;

CREATE TABLE audit_log (
  id            bigserial PRIMARY KEY,
  space_id      uuid REFERENCES spaces(id) ON DELETE CASCADE,
  actor_type    text NOT NULL CHECK (actor_type IN ('user','agent','system')),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  mcp_client_id uuid REFERENCES mcp_clients(id) ON DELETE SET NULL,
  action        text NOT NULL,
  target_id     uuid,
  tool_name     text,
  metadata      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_space_idx ON audit_log (space_id, created_at DESC);

-- ----------------------------------------------------- row-level security --
--
-- One helper predicate, applied consistently: you reach a row if you are a
-- member of its space. There is no per-note permission -- if you are in the
-- space you see the space (docs/06-auth.md).

CREATE OR REPLACE FUNCTION app_can_reach_space(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM space_members m
    WHERE m.space_id = target AND m.user_id = app_actor_id()
  )
$$;

ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE users            FORCE  ROW LEVEL SECURITY;
ALTER TABLE spaces           ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaces           FORCE  ROW LEVEL SECURITY;
ALTER TABLE space_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_members    FORCE  ROW LEVEL SECURITY;
ALTER TABLE notes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes            FORCE  ROW LEVEL SECURITY;
ALTER TABLE blocks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks           FORCE  ROW LEVEL SECURITY;
ALTER TABLE media_assets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets     FORCE  ROW LEVEL SECURITY;
ALTER TABLE comments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments         FORCE  ROW LEVEL SECURITY;
ALTER TABLE note_revisions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_revisions   FORCE  ROW LEVEL SECURITY;
ALTER TABLE block_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_embeddings FORCE  ROW LEVEL SECURITY;
ALTER TABLE mcp_clients      ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_clients      FORCE  ROW LEVEL SECURITY;
ALTER TABLE mcp_grants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_grants       FORCE  ROW LEVEL SECURITY;
ALTER TABLE audit_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log        FORCE  ROW LEVEL SECURITY;

-- You are yourself. You can see other members of spaces you belong to.
CREATE POLICY users_self ON users USING (
  id = app_actor_id()
  OR EXISTS (
    SELECT 1 FROM space_members mine
    JOIN space_members theirs ON theirs.space_id = mine.space_id
    WHERE mine.user_id = app_actor_id() AND theirs.user_id = users.id
  )
);
CREATE POLICY users_update_self ON users FOR UPDATE USING (id = app_actor_id());

CREATE POLICY spaces_member ON spaces USING (app_can_reach_space(id));
CREATE POLICY space_members_visible ON space_members USING (app_can_reach_space(space_id));

CREATE POLICY notes_member       ON notes            USING (app_can_reach_space(space_id));
CREATE POLICY blocks_member      ON blocks           USING (app_can_reach_space(space_id));
CREATE POLICY media_member       ON media_assets     USING (app_can_reach_space(space_id));
CREATE POLICY comments_member    ON comments         USING (app_can_reach_space(space_id));
CREATE POLICY revisions_member   ON note_revisions   USING (app_can_reach_space(space_id));
CREATE POLICY embeddings_member  ON block_embeddings USING (app_can_reach_space(space_id));
CREATE POLICY audit_member       ON audit_log        USING (app_can_reach_space(space_id));

-- Agent credentials belong to one person and are never visible to space peers.
CREATE POLICY mcp_clients_own ON mcp_clients USING (user_id = app_actor_id());
CREATE POLICY mcp_grants_own  ON mcp_grants  USING (
  EXISTS (SELECT 1 FROM mcp_clients c
          WHERE c.id = mcp_grants.mcp_client_id AND c.user_id = app_actor_id())
);

-- The worker role legitimately crosses spaces (recognition, embeddings,
-- triage) and is therefore exempt. Nothing else uses it. Created here so the
-- exemption is reviewed alongside the policies it bypasses.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jotdojo_worker') THEN
    CREATE ROLE jotdojo_worker BYPASSRLS NOLOGIN;
  END IF;
END
$$;
