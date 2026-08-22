-- The doors that run before an actor exists.
--
-- Same pattern as sign-in (0003) and capture tokens (0004): a credential is
-- what establishes who the actor is, so resolving one cannot satisfy a policy
-- that reads app_actor_id(). Each function is narrow and reviewable rather than
-- a blanket grant.
--
-- Note what is NOT here: issuing tokens at /token. By then the authorization
-- code has told us who the user is, so the app sets app.actor_id to them and
-- inserts under ordinary RLS. Only the lookups need elevation.

-- Dynamic Client Registration (RFC 7591) is unauthenticated by design.
CREATE OR REPLACE FUNCTION app_register_oauth_client(
  p_client_id text,
  p_client_name text,
  p_redirect_uris text[],
  p_source text,
  p_metadata jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO oauth_clients (client_id, client_name, redirect_uris, registration_source, metadata)
  VALUES (p_client_id, p_client_name, p_redirect_uris, p_source, p_metadata)
  ON CONFLICT (client_id) DO UPDATE
    SET client_name   = EXCLUDED.client_name,
        redirect_uris = EXCLUDED.redirect_uris,
        metadata      = EXCLUDED.metadata
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Single-use by construction: the UPDATE that marks it used is the same
-- statement that returns it, so two simultaneous exchanges cannot both win.
CREATE OR REPLACE FUNCTION app_consume_auth_code(p_code_hash text)
RETURNS TABLE (
  client_id text, user_id uuid, redirect_uri text, code_challenge text,
  scopes text[], space_ids uuid[], resource text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE oauth_auth_codes c
     SET used_at = now()
   WHERE c.code_hash = p_code_hash
     AND c.used_at IS NULL
     AND c.expires_at > now()
  RETURNING c.client_id, c.user_id, c.redirect_uri, c.code_challenge,
            c.scopes, c.space_ids, c.resource;
END;
$$;

CREATE OR REPLACE FUNCTION app_resolve_oauth_token(p_token_hash text, p_kind text)
RETURNS TABLE (
  token_id uuid, client_id text, user_id uuid, scopes text[],
  space_ids uuid[], audience text, family_id uuid, was_reused boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_rec record;
BEGIN
  SELECT * INTO v_rec FROM oauth_tokens t
   WHERE t.token_hash = p_token_hash AND t.kind = p_kind;

  IF NOT FOUND THEN RETURN; END IF;

  -- A refresh token presented after it was rotated away means the chain leaked.
  -- Revoke the whole family rather than the one token, and say so to the caller.
  IF v_rec.revoked_at IS NOT NULL OR v_rec.expires_at <= now() THEN
    IF p_kind = 'refresh' AND v_rec.revoked_at IS NOT NULL THEN
      UPDATE oauth_tokens SET revoked_at = now()
       WHERE family_id = v_rec.family_id AND revoked_at IS NULL;
      RETURN QUERY SELECT v_rec.id, v_rec.client_id, v_rec.user_id, v_rec.scopes,
                          v_rec.space_ids, v_rec.audience, v_rec.family_id, true;
    END IF;
    RETURN;
  END IF;

  UPDATE oauth_tokens SET last_used_at = now() WHERE id = v_rec.id;

  RETURN QUERY SELECT v_rec.id, v_rec.client_id, v_rec.user_id, v_rec.scopes,
                      v_rec.space_ids, v_rec.audience, v_rec.family_id, false;
END;
$$;

REVOKE ALL ON FUNCTION app_register_oauth_client(text, text, text[], text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_consume_auth_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_resolve_oauth_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_register_oauth_client(text, text, text[], text, jsonb) TO jotdojo_app;
GRANT EXECUTE ON FUNCTION app_consume_auth_code(text) TO jotdojo_app;
GRANT EXECUTE ON FUNCTION app_resolve_oauth_token(text, text) TO jotdojo_app;
