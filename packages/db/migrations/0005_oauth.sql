-- OAuth 2.1 authorization server. See docs/06-auth.md.
--
-- WHERE THIS LIVES: the authorize endpoint and its consent screen are hosted by
-- the WEB app, not by apps/mcp. The authorization endpoint needs a signed-in
-- human, and the session cookie belongs to app.jotdojo.com -- putting
-- /authorize on mcp.jotdojo.com would mean a cross-domain session, which is a
-- problem with no good answer. apps/mcp is purely a Protected Resource: it
-- advertises the AS via RFC 9728 metadata and validates the tokens the AS
-- issued. That split is exactly what RFC 9728 is for.
--
-- TOKEN FORMAT: opaque random strings, stored only as SHA-256. Not JWTs.
-- Revocation of a JWT means keeping a denylist anyway, and we already do a
-- database read per request for the grant -- so a JWT would buy nothing and
-- cost us a key rotation story. This is why the AS metadata advertises no
-- jwks_uri.

CREATE TABLE oauth_clients (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           text NOT NULL UNIQUE,
  client_name         text,
  redirect_uris       text[] NOT NULL DEFAULT '{}',
  registration_source text NOT NULL CHECK (registration_source IN ('dcr','cimd','preregistered')),
  -- For CIMD the client_id IS an https URL to a metadata document; we cache
  -- what we fetched so a later fetch failure does not break existing grants.
  metadata            jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE oauth_auth_codes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash      text NOT NULL UNIQUE,
  client_id      text NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redirect_uri   text NOT NULL,
  -- PKCE is mandatory, S256 only. No plain, no implicit grant.
  code_challenge text NOT NULL,
  scopes         text[] NOT NULL DEFAULT '{}',
  space_ids      uuid[] NOT NULL DEFAULT '{}',
  -- RFC 8707. Bound here and re-checked at the token endpoint, so a code minted
  -- for jotdojo can never be exchanged for a token aimed at kanninja.
  resource       text NOT NULL,
  expires_at     timestamptz NOT NULL,
  used_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX oauth_auth_codes_expiry_idx ON oauth_auth_codes (expires_at);

CREATE TABLE oauth_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash    text NOT NULL UNIQUE,
  kind          text NOT NULL CHECK (kind IN ('access','refresh')),
  client_id     text NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scopes        text[] NOT NULL DEFAULT '{}',
  space_ids     uuid[] NOT NULL DEFAULT '{}',
  audience      text NOT NULL,
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz,
  -- Refresh rotation: a reused refresh token means the chain is compromised,
  -- so presenting a rotated-away token revokes the whole family.
  rotated_from  uuid REFERENCES oauth_tokens(id) ON DELETE SET NULL,
  family_id     uuid NOT NULL,
  last_used_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX oauth_tokens_user_idx ON oauth_tokens (user_id, kind);
CREATE INDEX oauth_tokens_family_idx ON oauth_tokens (family_id);

ALTER TABLE oauth_clients    ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_clients    FORCE  ROW LEVEL SECURITY;
ALTER TABLE oauth_auth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_auth_codes FORCE  ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens     ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens     FORCE  ROW LEVEL SECURITY;

-- Registered clients are public knowledge (any client may discover them by id);
-- there is nothing user-scoped in the row.
CREATE POLICY oauth_clients_read ON oauth_clients FOR SELECT USING (true);

-- Codes and tokens are the user's own. A signed-in person can see and revoke
-- their grants; nobody can see anyone else's.
CREATE POLICY oauth_codes_own ON oauth_auth_codes FOR ALL
  USING (user_id = app_actor_id()) WITH CHECK (user_id = app_actor_id());

CREATE POLICY oauth_tokens_own ON oauth_tokens FOR ALL
  USING (user_id = app_actor_id()) WITH CHECK (user_id = app_actor_id());
