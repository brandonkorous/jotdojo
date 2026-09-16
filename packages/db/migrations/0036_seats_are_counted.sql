-- Seats, counted. ADR-112.
--
-- The pricing page has sold "up to 6 people" since it shipped and nothing
-- anywhere counted. A seventh person joined a Family space exactly as easily
-- as a second. docs/12 has listed this as open since 2026-08-21.
--
-- 6 IS THE MARKET'S NUMBER for a family: Apple One, Google One and iCloud+ all
-- land there, Craft and 1Password on five. 25 for Team replaces the 5 the page
-- used to claim, which was smaller than Family and made no sense -- and which
-- is what prompted this being looked at again.
--
-- SEATS ARE NOT THE FENCE, and that is why these numbers are generous. What is
-- sold is READINGS and the agent's permission to write (ADR-042); docs/01 is
-- explicit that this is priced per SPACE because "families will not do seat
-- math and small businesses resent it". A cap here exists so a number on a
-- page is true, not to make anybody upgrade. Milanote sells 50 seats flat for
-- $49; 25 at $19 is the same shape.
--
-- Beside app_plan_allowance (0015, 0017, 0020) on purpose. One plan, two
-- limits, two functions that read the same `spaces.plan` column, so a plan can
-- never mean one thing to metering and another to seats.

CREATE OR REPLACE FUNCTION app_plan_seats(p_plan text) RETURNS integer
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_plan
    WHEN 'solo'   THEN 1
    WHEN 'family' THEN 6
    WHEN 'team'   THEN 25
    WHEN 'anon'   THEN 1
    ELSE 1
  END
$$;

-- Members plus invites that could still turn into members.
--
-- PENDING INVITES COUNT. Otherwise an owner sends six invites to a Family
-- space of one, every one of them is valid at the time it is written, and the
-- cap is discovered by the sixth person to click a link -- which makes the
-- limit somebody else's problem rather than the person who set it.
CREATE OR REPLACE FUNCTION app_space_seats_taken(p_space uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT count(*) FROM space_members WHERE space_id = p_space)
       + (SELECT count(*) FROM space_invites
           WHERE space_id = p_space
             AND accepted_at IS NULL
             AND revoked_at IS NULL
             AND expires_at > now())
$$;

-- What is left, which may be NEGATIVE for a space that was already over when
-- this shipped. Nobody is ever removed for being over: the cap decides who may
-- JOIN, and a space that is already full simply cannot grow.
CREATE OR REPLACE FUNCTION app_space_seats_left(p_space uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app_plan_seats((SELECT plan FROM spaces WHERE id = p_space))
       - app_space_seats_taken(p_space)
$$;

REVOKE ALL ON FUNCTION app_space_seats_taken(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_space_seats_left(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_plan_seats(text)         TO jotacular_app;
GRANT EXECUTE ON FUNCTION app_space_seats_taken(uuid)  TO jotacular_app;
GRANT EXECUTE ON FUNCTION app_space_seats_left(uuid)   TO jotacular_app;

-- Accepting an invite is where the cap has to bite, because it is the only
-- moment a space actually grows -- and the only moment the invitee is present.
--
-- The check sits AFTER every other refusal, so "the space is full" is never
-- reported for an invite that was expired or revoked anyway: the first true
-- reason is the useful one.
--
-- `< 0`, NOT `< 1`, and the difference is the whole rule.
--
-- Accepting converts a pending invite into a member. Both are counted by
-- app_space_seats_taken, so accepting never CHANGES the total -- the seat was
-- reserved the moment the invite was written. Refusing at `left < 1` would
-- refuse the last invited person on a full space, which is precisely the
-- person the reservation was for.
--
-- What is left to catch is a space that is already OVER: invites written while
-- there was room, used after a downgrade. Those are refused, and nobody
-- already in the space is touched.
CREATE OR REPLACE FUNCTION app_accept_invite(
  p_token_hash text,
  p_user_id    uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invite space_invites%ROWTYPE;
  v_email  citext;
BEGIN
  IF p_user_id IS DISTINCT FROM app_actor_id() THEN
    RAISE EXCEPTION 'an invite is accepted by the invitee' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_invite FROM space_invites WHERE token_hash = p_token_hash;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such invite' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_invite.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'invite revoked' USING ERRCODE = 'check_violation';
  END IF;
  IF v_invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'invite already used' USING ERRCODE = 'check_violation';
  END IF;
  IF v_invite.expires_at <= now() THEN
    RAISE EXCEPTION 'invite expired' USING ERRCODE = 'check_violation';
  END IF;

  SELECT email INTO v_email FROM users WHERE id = p_user_id;
  IF v_email IS DISTINCT FROM v_invite.email THEN
    RAISE EXCEPTION 'invite was sent to a different address' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Already a member: accepting again is a no-op below, and must not be
  -- refused for a seat this person is already occupying.
  IF NOT EXISTS (
    SELECT 1 FROM space_members
     WHERE space_id = v_invite.space_id AND user_id = p_user_id
  ) AND app_space_seats_left(v_invite.space_id) < 0 THEN
    RAISE EXCEPTION 'the space is full' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO space_members (space_id, user_id, role)
  VALUES (v_invite.space_id, p_user_id, v_invite.role)
  ON CONFLICT (space_id, user_id) DO NOTHING;

  UPDATE space_invites
     SET accepted_at = now(), accepted_by = p_user_id
   WHERE id = v_invite.id;

  RETURN v_invite.space_id;
END;
$$;

REVOKE ALL ON FUNCTION app_accept_invite(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_accept_invite(text, uuid) TO jotacular_app;
