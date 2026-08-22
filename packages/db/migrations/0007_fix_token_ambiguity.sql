-- app_resolve_oauth_token's RETURNS TABLE output names (client_id, user_id,
-- family_id, ...) are plpgsql variables inside the function body, so an
-- unqualified `WHERE family_id = ...` was ambiguous and raised at runtime.
--
-- The effect was worse than a broken query: the refresh-token-reuse defence
-- never ran. A replayed refresh token still produced an error, so from the
-- outside it looked like the check was working -- and the smoke test agreed,
-- because it only asserted that SOMETHING was thrown. The family was never
-- revoked, which is the entire point of rotation detection.
--
-- Two fixes: every column reference here is qualified, and the smoke test now
-- asserts the error TYPE rather than merely that one occurred.

CREATE OR REPLACE FUNCTION app_resolve_oauth_token(p_token_hash text, p_kind text)
RETURNS TABLE (
  token_id uuid, client_id text, user_id uuid, scopes text[],
  space_ids uuid[], audience text, family_id uuid, was_reused boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_rec record;
BEGIN
  SELECT t.* INTO v_rec FROM oauth_tokens t
   WHERE t.token_hash = p_token_hash AND t.kind = p_kind;

  IF NOT FOUND THEN RETURN; END IF;

  IF v_rec.revoked_at IS NOT NULL OR v_rec.expires_at <= now() THEN
    -- A refresh token presented after it was rotated away means the chain
    -- leaked. Revoke the whole family, not just this token.
    IF p_kind = 'refresh' AND v_rec.revoked_at IS NOT NULL THEN
      UPDATE oauth_tokens AS ot
         SET revoked_at = now()
       WHERE ot.family_id = v_rec.family_id
         AND ot.revoked_at IS NULL;

      RETURN QUERY SELECT v_rec.id, v_rec.client_id, v_rec.user_id, v_rec.scopes,
                          v_rec.space_ids, v_rec.audience, v_rec.family_id, true;
    END IF;
    RETURN;
  END IF;

  UPDATE oauth_tokens AS ot SET last_used_at = now() WHERE ot.id = v_rec.id;

  RETURN QUERY SELECT v_rec.id, v_rec.client_id, v_rec.user_id, v_rec.scopes,
                      v_rec.space_ids, v_rec.audience, v_rec.family_id, false;
END;
$$;

REVOKE ALL ON FUNCTION app_resolve_oauth_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_resolve_oauth_token(text, text) TO jotdojo_app;
