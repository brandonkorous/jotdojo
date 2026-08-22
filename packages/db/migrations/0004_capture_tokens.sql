-- Capture tokens for iOS Shortcuts. See docs/09-shortcuts.md.
--
-- Shortcuts cannot run an OAuth flow, so they need a long-lived bearer token.
-- That is a real risk, constrained deliberately: the token can CREATE a note in
-- ONE space and do nothing else. It cannot read, list, search, or reach another
-- space. The blast radius of a leak is "a stranger can add notes to one of your
-- spaces" -- annoying, not catastrophic, and that asymmetry is the whole design.

CREATE TABLE capture_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  space_id     uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  name         text NOT NULL,
  -- SHA-256 of the token. The token itself is shown once at creation and never
  -- stored, so a database read cannot reconstruct a working credential.
  token_hash   text NOT NULL UNIQUE,
  last_used_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  revoked_at   timestamptz
);

CREATE INDEX capture_tokens_user_idx ON capture_tokens (user_id);

-- Idempotency. Shortcuts retry on flaky connections, and a retry must not
-- produce a second note -- a duplicated thought is a small betrayal of trust in
-- a capture app. Doubles as the rate-limit window.
CREATE TABLE capture_requests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id   uuid NOT NULL REFERENCES capture_tokens(id) ON DELETE CASCADE,
  request_id text NOT NULL,
  note_id    uuid REFERENCES notes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token_id, request_id)
);

CREATE INDEX capture_requests_rate_idx ON capture_requests (token_id, created_at DESC);

ALTER TABLE capture_tokens   ENABLE ROW LEVEL SECURITY;
ALTER TABLE capture_tokens   FORCE  ROW LEVEL SECURITY;
ALTER TABLE capture_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE capture_requests FORCE  ROW LEVEL SECURITY;

-- Your tokens are yours. Space peers never see them, the same as agent
-- credentials in 0002.
CREATE POLICY capture_tokens_own ON capture_tokens FOR ALL
  USING (user_id = app_actor_id()) WITH CHECK (user_id = app_actor_id());

CREATE POLICY capture_requests_own ON capture_requests FOR ALL
  USING (EXISTS (SELECT 1 FROM capture_tokens t
                 WHERE t.id = capture_requests.token_id AND t.user_id = app_actor_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM capture_tokens t
                      WHERE t.id = capture_requests.token_id AND t.user_id = app_actor_id()));

-- Resolving a presented token happens BEFORE there is an actor -- the token is
-- what establishes who the actor is. Same chicken-and-egg as sign-in, same
-- answer: one narrow SECURITY DEFINER door rather than a blanket grant.
--
-- Takes the HASH, never the token, so the plaintext never reaches the database
-- server or its logs.
CREATE OR REPLACE FUNCTION app_resolve_capture_token(p_token_hash text)
RETURNS TABLE (token_id uuid, user_id uuid, space_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE capture_tokens t
     SET last_used_at = now()
   WHERE t.token_hash = p_token_hash
     AND t.revoked_at IS NULL
  RETURNING t.id, t.user_id, t.space_id;
END;
$$;

REVOKE ALL ON FUNCTION app_resolve_capture_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_resolve_capture_token(text) TO jotdojo_app;
