-- Anonymous capture, server-side from the first keystroke. ADR-009, ADR-039.
--
-- Local-only anonymous notes would be evicted by iOS Safari under storage
-- pressure and after disuse. That is documented platform behaviour, not an edge
-- case, and losing someone's first note is the worst possible first impression.
-- "Never lose a thought" cannot have an asterisk, so these live in Postgres
-- exactly like everyone else's.

ALTER TABLE spaces DROP CONSTRAINT IF EXISTS spaces_kind_check;
ALTER TABLE spaces ADD CONSTRAINT spaces_kind_check
  CHECK (kind IN ('personal','family','team','anon'));

CREATE TABLE anon_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SHA-256 of the token the browser holds. Same reasoning as capture tokens
  -- and invites: a leaked backup must not be a pile of working sessions.
  token_hash  text NOT NULL UNIQUE,
  space_id    uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  claimed_at  timestamptz,
  claimed_by  uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX anon_sessions_sweep_idx ON anon_sessions (last_seen_at)
  WHERE claimed_at IS NULL;

ALTER TABLE anon_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE anon_sessions FORCE  ROW LEVEL SECURITY;
-- No policy at all: nothing reaches this table except the SECURITY DEFINER
-- functions below. There is no signed-in actor for whom a row here is "theirs".

-- An anon space is metered at zero, which is how "no recognition until claimed"
-- is enforced without a second mechanism: app_space_over_quota already returns
-- true, so app_claim_recognize_jobs already defers the work and keeps the
-- strokes. Recognition costs money and abuse is free. ADR-036.
CREATE OR REPLACE FUNCTION app_plan_allowance(p_plan text) RETURNS integer
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_plan
    WHEN 'family' THEN 2000
    WHEN 'team'   THEN 10000
    WHEN 'anon'   THEN 0
    ELSE 100
  END
$$;

-- ------------------------------------------------------------- the doors ----

CREATE OR REPLACE FUNCTION app_create_anon_space(p_token_hash text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_space uuid;
BEGIN
  -- Already known: hand back the same space. The browser retrying must not mint
  -- a second one and strand the first.
  SELECT space_id INTO v_space FROM anon_sessions
   WHERE token_hash = p_token_hash AND claimed_at IS NULL;
  IF v_space IS NOT NULL THEN
    UPDATE anon_sessions SET last_seen_at = now() WHERE token_hash = p_token_hash;
    RETURN v_space;
  END IF;

  INSERT INTO spaces (name, kind, plan) VALUES ('Draft', 'anon', 'anon')
    RETURNING id INTO v_space;
  INSERT INTO anon_sessions (token_hash, space_id) VALUES (p_token_hash, v_space);
  RETURN v_space;
END;
$$;

/**
 * Resolve a token to its space. NULL when unknown, expired or already claimed,
 * so a stale token in someone's browser reads as "start again" rather than as
 * an error page.
 */
CREATE OR REPLACE FUNCTION app_anon_space(p_token_hash text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_space uuid;
BEGIN
  SELECT space_id INTO v_space FROM anon_sessions
   WHERE token_hash = p_token_hash AND claimed_at IS NULL;
  IF v_space IS NOT NULL THEN
    UPDATE anon_sessions SET last_seen_at = now() WHERE token_hash = p_token_hash;
  END IF;
  RETURN v_space;
END;
$$;

-- Claiming is a change of ownership, not a copy. Nothing moves between tables,
-- so nothing can be lost in the moving, and there is no merge to get wrong.
CREATE OR REPLACE FUNCTION app_claim_anon_space(
  p_token_hash text,
  p_user_id    uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_space uuid;
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

  -- It becomes an ordinary space on the free plan, owned by the claimer.
  UPDATE spaces
     SET kind = 'personal', plan = 'free', name = 'From the web', created_by = p_user_id
   WHERE id = v_space;

  INSERT INTO space_members (space_id, user_id, role)
  VALUES (v_space, p_user_id, 'owner')
  ON CONFLICT (space_id, user_id) DO NOTHING;

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

/**
 * Delete unclaimed drafts after 30 days.
 *
 * Storage hygiene and a clean data-retention story, and it is a function rather
 * than a comment in a runbook so that the retention promise is executable.
 * Returns how many went, so a caller can log something true.
 */
CREATE OR REPLACE FUNCTION app_sweep_anon_spaces(p_days integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_gone integer;
BEGIN
  WITH doomed AS (
    DELETE FROM anon_sessions
     WHERE claimed_at IS NULL
       AND last_seen_at < now() - make_interval(days => p_days)
    RETURNING space_id
  ), dropped AS (
    DELETE FROM spaces s USING doomed d WHERE s.id = d.space_id AND s.kind = 'anon'
    RETURNING s.id
  )
  SELECT count(*) INTO v_gone FROM dropped;
  RETURN v_gone;
END;
$$;

REVOKE ALL ON FUNCTION app_create_anon_space(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_anon_space(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_claim_anon_space(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_sweep_anon_spaces(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_create_anon_space(text)        TO jotdojo_app;
GRANT EXECUTE ON FUNCTION app_anon_space(text)               TO jotdojo_app;
GRANT EXECUTE ON FUNCTION app_claim_anon_space(text, uuid)   TO jotdojo_app;
GRANT EXECUTE ON FUNCTION app_sweep_anon_spaces(integer)     TO jotdojo_app;
