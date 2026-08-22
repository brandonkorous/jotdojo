-- Two different identifiers were being conflated.
--
--   oauth_clients.client_id   text, e.g. "jd_client_204af..." -- the APPLICATION
--   mcp_clients.id            uuid                            -- THIS USER'S connection to it
--
-- The agent actor carried the first and wrote it into comments.agent_client_id
-- and audit_log.mcp_client_id, which are uuid foreign keys to the second. Every
-- agent WRITE failed with "invalid input syntax for type uuid" while every
-- agent READ worked -- so the server looked healthy until a tool tried to
-- attribute something.
--
-- The distinction is worth keeping rather than collapsing: attribution should
-- name the connection a person granted, not just the software, so revoking one
-- person's Claude does not orphan another's comments.

CREATE UNIQUE INDEX IF NOT EXISTS mcp_clients_user_client_idx
  ON mcp_clients (user_id, client_id);

ALTER TABLE oauth_tokens
  ADD COLUMN IF NOT EXISTS mcp_client_id uuid REFERENCES mcp_clients(id) ON DELETE SET NULL;

-- CREATE OR REPLACE cannot change a function's return type ("Row type defined
-- by OUT parameters is different"), so the old signature is dropped first.
DROP FUNCTION IF EXISTS app_resolve_oauth_token(text, text);

CREATE FUNCTION app_resolve_oauth_token(p_token_hash text, p_kind text)
RETURNS TABLE (
  token_id uuid, client_id text, user_id uuid, scopes text[],
  space_ids uuid[], audience text, family_id uuid, mcp_client_id uuid, was_reused boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_rec record;
BEGIN
  SELECT t.* INTO v_rec FROM oauth_tokens t
   WHERE t.token_hash = p_token_hash AND t.kind = p_kind;

  IF NOT FOUND THEN RETURN; END IF;

  IF v_rec.revoked_at IS NOT NULL OR v_rec.expires_at <= now() THEN
    IF p_kind = 'refresh' AND v_rec.revoked_at IS NOT NULL THEN
      UPDATE oauth_tokens AS ot SET revoked_at = now()
       WHERE ot.family_id = v_rec.family_id AND ot.revoked_at IS NULL;
      RETURN QUERY SELECT v_rec.id, v_rec.client_id, v_rec.user_id, v_rec.scopes,
                          v_rec.space_ids, v_rec.audience, v_rec.family_id,
                          v_rec.mcp_client_id, true;
    END IF;
    RETURN;
  END IF;

  UPDATE oauth_tokens AS ot SET last_used_at = now() WHERE ot.id = v_rec.id;

  RETURN QUERY SELECT v_rec.id, v_rec.client_id, v_rec.user_id, v_rec.scopes,
                      v_rec.space_ids, v_rec.audience, v_rec.family_id,
                      v_rec.mcp_client_id, false;
END;
$$;

REVOKE ALL ON FUNCTION app_resolve_oauth_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_resolve_oauth_token(text, text) TO jotdojo_app;
