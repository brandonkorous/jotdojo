-- The one door into existence.
--
-- Sign-in happens before there is an actor, so it cannot satisfy any RLS
-- policy -- and the alternative (a blanket INSERT grant on users, spaces and
-- space_members) would hand the application exactly the privilege the policies
-- exist to withhold. A SECURITY DEFINER function is narrower: it can create an
-- account and nothing else, its body is reviewable in one place, and the app
-- role gets EXECUTE on it rather than write access to three tables.

CREATE OR REPLACE FUNCTION app_provision_user(
  p_google_sub text,
  p_email      text,
  p_name       text,
  p_avatar     text
)
RETURNS TABLE (user_id uuid, is_new boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_space_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM users WHERE google_sub = p_google_sub;

  IF v_user_id IS NOT NULL THEN
    -- Email and avatar change over time; google_sub does not.
    UPDATE users
       SET email        = p_email::citext,
           display_name = COALESCE(p_name, display_name),
           avatar_url   = COALESCE(p_avatar, avatar_url)
     WHERE id = v_user_id;

    RETURN QUERY SELECT v_user_id, false;
    RETURN;
  END IF;

  INSERT INTO users (google_sub, email, display_name, avatar_url)
  VALUES (p_google_sub, p_email::citext, p_name, p_avatar)
  RETURNING id INTO v_user_id;

  INSERT INTO spaces (name, kind, created_by)
  VALUES ('Personal', 'personal', v_user_id)
  RETURNING id INTO v_space_id;

  INSERT INTO space_members (space_id, user_id, role)
  VALUES (v_space_id, v_user_id, 'owner');

  RETURN QUERY SELECT v_user_id, true;
END;
$$;

REVOKE ALL ON FUNCTION app_provision_user(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_provision_user(text, text, text, text) TO jotdojo_app;
