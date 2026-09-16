-- One space, not two.
--
-- Somebody who jotted on the apex and then signed up ended up owning TWO
-- personal spaces: the one they started typing in, and the one provisioning
-- (0003) made a minute later. Nothing merged them, and no screen in the product
-- can switch between spaces, so half of what they owned was unreachable and
-- their first thought was the half that disappeared.
--
-- docs/personas/issues/007 has the run it was found on.

-- ----------------------------------------------- a space can be deleted ----
--
-- It could not be, until now. Every FK into spaces is ON DELETE CASCADE, so
-- dropping a space removes its space_members rows -- and the last-owner guard
-- (0014) fires on each one and refuses, because the space is indeed about to
-- lose its last owner.
--
-- The guard exists so a space that must keep working keeps an administrator. A
-- space that no longer exists does not need one. During a cascade the parent
-- row is already gone, which is exactly the condition to test.

CREATE OR REPLACE FUNCTION app_guard_last_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_space uuid := COALESCE(OLD.space_id, NEW.space_id);
  v_owners int;
BEGIN
  -- Only a change that removes an owner can strand a space.
  IF TG_OP = 'UPDATE' AND NEW.role = 'owner' THEN RETURN NEW; END IF;
  IF OLD.role <> 'owner' THEN RETURN COALESCE(NEW, OLD); END IF;

  -- The space itself is already gone: this is its cascade, not somebody
  -- leaving. Nothing is being stranded because there is nothing left to strand.
  IF NOT EXISTS (SELECT 1 FROM spaces WHERE id = v_space) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT count(*) INTO v_owners
    FROM space_members WHERE space_id = v_space AND role = 'owner';

  IF v_owners <= 1 THEN
    RAISE EXCEPTION 'a space must keep at least one owner'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- --------------------------------------------------- what "never used" is ----
--
-- Opening the canvas writes rows on its own: an empty note (ADR-008 -- the
-- cursor is live with zero clicks) and an ink layer holding no strokes. So
-- "this space has rows in it" is not the same as "somebody used this space",
-- and only the second one is a reason to keep it.

CREATE OR REPLACE FUNCTION app_space_is_untouched(p_space uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
           SELECT 1 FROM blocks b
            WHERE b.space_id = p_space AND COALESCE(b.body, '') <> '')
     AND NOT EXISTS (
           SELECT 1 FROM media_assets m
            WHERE m.space_id = p_space
              AND (m.kind <> 'ink'
                   OR COALESCE(jsonb_array_length(m.strokes -> 'strokes'), 0) > 0))
     AND NOT EXISTS (
           SELECT 1 FROM capture_tokens c WHERE c.space_id = p_space)
     AND NOT EXISTS (
           SELECT 1 FROM comments c WHERE c.space_id = p_space)
     AND (SELECT count(*) FROM space_members m WHERE m.space_id = p_space) = 1
$$;

REVOKE ALL ON FUNCTION app_space_is_untouched(uuid) FROM PUBLIC;

-- ------------------------------------------------------ claiming absorbs ----
--
-- Same function as 0018, with one step added at the end: if signing up handed
-- them a personal space they have never touched, it goes, and the space they
-- actually wrote in takes the name everybody else's has. They asked for one
-- place to put things.

CREATE OR REPLACE FUNCTION app_claim_anon_space(
  p_token_hash text,
  p_user_id    uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_space  uuid;
  v_shadow uuid;
  v_spare  uuid;
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

  -- The one they never touched goes, and this one takes its name. Issue 007.
  SELECT s.id INTO v_spare
    FROM spaces s
    JOIN space_members m ON m.space_id = s.id AND m.user_id = p_user_id
   WHERE s.id <> v_space
     AND s.kind = 'personal'
     AND app_space_is_untouched(s.id)
   ORDER BY s.created_at
   LIMIT 1;

  IF v_spare IS NOT NULL THEN
    DELETE FROM spaces WHERE id = v_spare;
    UPDATE spaces SET name = 'Personal' WHERE id = v_space;
  END IF;

  RETURN v_space;
END;
$$;

-- ------------------------------------------------- the ones already split ----
--
-- Everybody who claimed a jot before today is carrying the second space right
-- now, and the run that found this was one of them. Same rule, applied once.

DO $$
DECLARE
  r      record;
  v_gone uuid;
BEGIN
  FOR r IN
    SELECT a.claimed_by AS user_id, a.space_id AS kept
      FROM anon_sessions a
     WHERE a.claimed_at IS NOT NULL
       AND a.claimed_by IS NOT NULL
       AND EXISTS (SELECT 1 FROM spaces s WHERE s.id = a.space_id)
  LOOP
    SELECT s.id INTO v_gone
      FROM spaces s
      JOIN space_members m ON m.space_id = s.id AND m.user_id = r.user_id
     WHERE s.id <> r.kept
       AND s.kind = 'personal'
       AND app_space_is_untouched(s.id)
     ORDER BY s.created_at
     LIMIT 1;

    IF v_gone IS NOT NULL THEN
      DELETE FROM spaces WHERE id = v_gone;
      UPDATE spaces SET name = 'Personal' WHERE id = r.kept AND name = 'From the web';
    END IF;
    v_gone := NULL;
  END LOOP;
END $$;
