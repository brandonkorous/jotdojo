-- An anonymous visitor is a USER who has not signed in yet. ADR-039.
--
-- 0017 created an anon space with no members, which cannot work: every policy
-- in this schema is `app_can_reach_space`, and a space with no members is
-- reachable by nobody -- including the person typing into it.
--
-- The alternatives were both worse. A fourth actor type would mean teaching
-- every policy about a second kind of principal, and routing anonymous writes
-- through SECURITY DEFINER functions would mean reimplementing notes, blocks
-- and ink behind doors that skip RLS -- which is exactly the privilege the
-- policies exist to withhold.
--
-- So an anon session gets a real `users` row it owns its space through. Nothing
-- else in the product needs to know: notes, ink, search, revisions and the
-- autosave path all work unchanged, because from their point of view this is an
-- ordinary person with one space. Claiming then swaps the owner and the shadow
-- goes away.

CREATE OR REPLACE FUNCTION app_create_anon_space(p_token_hash text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_space uuid;
  v_user  uuid;
BEGIN
  SELECT space_id INTO v_space FROM anon_sessions
   WHERE token_hash = p_token_hash AND claimed_at IS NULL;
  IF v_space IS NOT NULL THEN
    UPDATE anon_sessions SET last_seen_at = now() WHERE token_hash = p_token_hash;
    RETURN v_space;
  END IF;

  -- `google_sub` and `email` are NOT NULL UNIQUE, so the shadow gets synthetic
  -- ones. `.invalid` is reserved by RFC 2606 and can never be a real address,
  -- which matters because an invite is bound to an email (ADR-035) and a shadow
  -- must never be invitable.
  INSERT INTO users (google_sub, email, display_name)
  VALUES ('anon:' || p_token_hash, gen_random_uuid()::text || '@anon.invalid', NULL)
  RETURNING id INTO v_user;

  INSERT INTO spaces (name, kind, plan, created_by)
  VALUES ('Draft', 'anon', 'anon', v_user)
  RETURNING id INTO v_space;

  INSERT INTO space_members (space_id, user_id, role) VALUES (v_space, v_user, 'owner');
  INSERT INTO anon_sessions (token_hash, space_id) VALUES (p_token_hash, v_space);
  RETURN v_space;
END;
$$;

/** The shadow user behind a token, so the application can act as them. */
CREATE OR REPLACE FUNCTION app_anon_user(p_token_hash text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid;
BEGIN
  SELECT u.id INTO v_user
    FROM anon_sessions s
    JOIN space_members m ON m.space_id = s.space_id AND m.role = 'owner'
    JOIN users u ON u.id = m.user_id AND u.google_sub = 'anon:' || p_token_hash
   WHERE s.token_hash = p_token_hash AND s.claimed_at IS NULL;

  IF v_user IS NOT NULL THEN
    UPDATE anon_sessions SET last_seen_at = now() WHERE token_hash = p_token_hash;
  END IF;
  RETURN v_user;
END;
$$;

CREATE OR REPLACE FUNCTION app_claim_anon_space(
  p_token_hash text,
  p_user_id    uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_space  uuid;
  v_shadow uuid;
BEGIN
  IF p_user_id IS DISTINCT FROM app_actor_id() THEN
    RAISE EXCEPTION 'a draft is claimed by the person claiming it'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT space_id INTO v_space FROM anon_sessions
   WHERE token_hash = p_token_hash AND claimed_at IS NULL;
  IF v_space IS NULL THEN
    RAISE EXCEPTION 'no such draft' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT id INTO v_shadow FROM users WHERE google_sub = 'anon:' || p_token_hash;

  UPDATE spaces
     SET kind = 'personal', plan = 'free', name = 'From the web', created_by = p_user_id
   WHERE id = v_space;

  -- The real owner joins BEFORE the shadow leaves. The last-owner trigger
  -- (0014) would otherwise refuse the removal, and rightly so.
  INSERT INTO space_members (space_id, user_id, role)
  VALUES (v_space, p_user_id, 'owner')
  ON CONFLICT (space_id, user_id) DO UPDATE SET role = 'owner';

  IF v_shadow IS NOT NULL THEN
    DELETE FROM space_members WHERE space_id = v_space AND user_id = v_shadow;
    -- Authorship of anything the visitor wrote points at the shadow, and
    -- ON DELETE SET NULL turns that into "someone", which is true and is the
    -- honest thing for a note written before there was an account.
    DELETE FROM users WHERE id = v_shadow;
  END IF;

  UPDATE anon_sessions
     SET claimed_at = now(), claimed_by = p_user_id
   WHERE token_hash = p_token_hash;

  -- Ink drawn while anonymous was deferred at zero allowance. Now that the
  -- space has a real one, make those jobs claimable again instead of leaving
  -- them parked until next month.
  UPDATE outbox o
     SET available_at = now()
   WHERE o.topic = 'block.recognize'
     AND o.completed_at IS NULL
     AND EXISTS (
       SELECT 1 FROM blocks b
        WHERE b.id = (o.payload ->> 'blockId')::uuid AND b.space_id = v_space
     );

  RETURN v_space;
END;
$$;

-- The sweep now has a shadow user to take with it.
CREATE OR REPLACE FUNCTION app_sweep_anon_spaces(p_days integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_gone integer;
BEGIN
  WITH doomed AS (
    DELETE FROM anon_sessions
     WHERE claimed_at IS NULL
       AND last_seen_at < now() - make_interval(days => p_days)
    RETURNING space_id, token_hash
  ), dropped AS (
    DELETE FROM spaces s USING doomed d WHERE s.id = d.space_id AND s.kind = 'anon'
    RETURNING s.id
  ), shadows AS (
    DELETE FROM users u USING doomed d WHERE u.google_sub = 'anon:' || d.token_hash
    RETURNING u.id
  )
  SELECT count(*) INTO v_gone FROM dropped;
  RETURN v_gone;
END;
$$;

REVOKE ALL ON FUNCTION app_anon_user(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_anon_user(text) TO jotdojo_app;
