-- The last-owner guard must not block a space being deleted.
--
-- 0014 added a trigger refusing to remove the final owner of a space, which is
-- right: three different actions can strand a space and only one of them looks
-- dangerous. But it also fires on the CASCADE from `DELETE FROM spaces`, and
-- then refuses it -- so deleting a space failed with "a space must keep at
-- least one owner", which is true and completely beside the point.
--
-- Nothing had ever deleted a space until the anonymous-draft sweep (0017), so
-- the bug had no way to show up. `anon:smoke` found it on the first run.
--
-- The fix is to ask whether the space still exists. During a cascade the parent
-- row is already gone, so "keep an owner" has nothing left to protect.

CREATE OR REPLACE FUNCTION app_guard_last_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_space uuid := COALESCE(OLD.space_id, NEW.space_id);
  v_owners int;
BEGIN
  -- The space is on its way out; there is no one left to strand.
  IF NOT EXISTS (SELECT 1 FROM spaces WHERE id = v_space) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

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
