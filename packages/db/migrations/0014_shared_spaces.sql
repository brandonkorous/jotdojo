-- Shared spaces: invites, roles, and the doors that make them possible.
--
-- The awkward part is not the table. It is that AN INVITEE CANNOT SEE THE
-- INVITE. Every policy in this schema is `app_can_reach_space`, and someone who
-- has not joined yet reaches nothing -- so the row that would let them join is
-- invisible to them by exactly the rule that makes the product safe.
--
-- That is solved the same way sign-in was (0003): one narrow SECURITY DEFINER
-- door, keyed by a secret the caller must already hold, rather than by widening
-- a policy. ADR-024, ADR-035.

CREATE TABLE space_invites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id     uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  -- Who it was sent to. citext because nobody types their own address the same
  -- way twice, and an invite that misses on capitalisation is a support ticket.
  email        citext NOT NULL,
  role         text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  -- SHA-256 of the token, never the token. A leaked backup should not be a
  -- pile of working invitations. Same reasoning as capture tokens (0004).
  token_hash   text NOT NULL UNIQUE,
  invited_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  accepted_at  timestamptz,
  accepted_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  revoked_at   timestamptz
);

CREATE INDEX space_invites_space_idx ON space_invites (space_id, created_at DESC);
-- One live invite per address per space. Partial, so a revoked or accepted
-- invite does not block sending another one later.
CREATE UNIQUE INDEX space_invites_pending_idx ON space_invites (space_id, email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

ALTER TABLE space_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_invites FORCE  ROW LEVEL SECURITY;

-- ----------------------------------------------------------------- roles ----

CREATE OR REPLACE FUNCTION app_is_space_owner(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM space_members m
    WHERE m.space_id = target AND m.user_id = app_actor_id() AND m.role = 'owner'
  )
$$;

-- Members see who else was invited; only owners send and revoke. Seeing the
-- pending list is not a privilege worth withholding from a family member, and
-- hiding it makes "why did nothing happen" impossible to answer.
CREATE POLICY invites_read ON space_invites FOR SELECT
  USING (app_can_reach_space(space_id));

CREATE POLICY invites_write ON space_invites FOR INSERT
  WITH CHECK (app_is_space_owner(space_id));

CREATE POLICY invites_revoke ON space_invites FOR UPDATE
  USING (app_is_space_owner(space_id))
  WITH CHECK (app_is_space_owner(space_id));

-- Owners manage membership; anyone may remove THEMSELVES. Leaving a space you
-- were added to should never require asking the person who added you.
CREATE POLICY space_members_manage ON space_members FOR UPDATE
  USING (app_is_space_owner(space_id))
  WITH CHECK (app_is_space_owner(space_id));

CREATE POLICY space_members_remove ON space_members FOR DELETE
  USING (app_is_space_owner(space_id) OR user_id = app_actor_id());

-- ------------------------------------------------------- the last owner ----
--
-- A space with no owner cannot be administered by anyone, and nothing else in
-- the schema would notice. Enforced as a trigger rather than in application
-- code because there are three ways to reach it -- delete, demote, and leave --
-- and only one of them is obvious.

CREATE OR REPLACE FUNCTION app_guard_last_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_space uuid := COALESCE(OLD.space_id, NEW.space_id);
  v_owners int;
BEGIN
  -- Only a change that removes an owner can strand a space.
  IF TG_OP = 'UPDATE' AND NEW.role = 'owner' THEN RETURN NEW; END IF;
  IF OLD.role <> 'owner' THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT count(*) INTO v_owners
    FROM space_members WHERE space_id = v_space AND role = 'owner';

  IF v_owners <= 1 THEN
    RAISE EXCEPTION 'a space must keep at least one owner'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER space_members_last_owner
  BEFORE UPDATE OR DELETE ON space_members
  FOR EACH ROW EXECUTE FUNCTION app_guard_last_owner();

-- ------------------------------------------------------------- the door ----

-- Creating a space needs the same door as creating an account: there is no
-- INSERT policy on `spaces` or `space_members`, deliberately (0002).
CREATE OR REPLACE FUNCTION app_create_space(
  p_name  text,
  p_kind  text,
  p_owner uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_space uuid;
BEGIN
  IF p_kind NOT IN ('family','team') THEN
    RAISE EXCEPTION 'a shared space is family or team' USING ERRCODE = 'check_violation';
  END IF;
  -- The caller is the acting user or nothing. Passing someone else's id would
  -- let the app create a space owned by a person who never asked for one.
  IF p_owner IS DISTINCT FROM app_actor_id() THEN
    RAISE EXCEPTION 'a space is created by its owner' USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO spaces (name, kind, created_by) VALUES (p_name, p_kind, p_owner)
    RETURNING id INTO v_space;
  INSERT INTO space_members (space_id, user_id, role) VALUES (v_space, p_owner, 'owner');
  RETURN v_space;
END;
$$;

-- Accepting is the door that exists because the invitee can see nothing.
--
-- The token is the credential, but it is NOT the only check: the invite is
-- bound to the address it was sent to. A forwarded link should not hand a
-- family's notes to whoever opened the mail.
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

  INSERT INTO space_members (space_id, user_id, role)
  VALUES (v_invite.space_id, p_user_id, v_invite.role)
  ON CONFLICT (space_id, user_id) DO NOTHING;

  UPDATE space_invites
     SET accepted_at = now(), accepted_by = p_user_id
   WHERE id = v_invite.id;

  RETURN v_invite.space_id;
END;
$$;

REVOKE ALL ON FUNCTION app_create_space(text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_accept_invite(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_create_space(text, text, uuid) TO jotdojo_app;
GRANT EXECUTE ON FUNCTION app_accept_invite(text, uuid) TO jotdojo_app;
GRANT SELECT, INSERT, UPDATE ON space_invites TO jotdojo_app;
GRANT UPDATE, DELETE ON space_members TO jotdojo_app;
