-- What changed, and when. docs/12-roadmap.md M8, ADR-063.
--
-- `audit_log` already has the right shape and the right index
-- (audit_log_space_idx on (space_id, created_at DESC)). What it did not have was
-- anything worth reading: five actions were ever written, all of them by a
-- signed-in person, and one of those five -- note.read -- outnumbers the rest
-- put together.
--
-- Everything that actually happens to a note happened silently. A comment left
-- by the triage agent, a transcript arriving twenty minutes after somebody wrote
-- a page, a photo finishing its upload: none of it was recorded, so "what has
-- been going on in this space" had no answer.

-- ---------------------------------------------------------------- the worker --
--
-- THE WORKER HAS NO ACTOR, BY CONSTRUCTION. It runs inside `withoutActor`, so
-- app_actor_id() is null and audit_log's policy -- app_can_reach_space(space_id)
-- -- matches nothing. A plain INSERT from there does not error; it inserts zero
-- rows and reports success, which is the exact silent-failure shape ADR-057 was
-- written about.
--
-- So the worker writes through a SECURITY DEFINER function, per ADR-024. Which
-- means the flag below has to go.

-- 0028 left FORCE on audit_log with a reason that was true at the time: "no
-- definer function writes to them". One does now. FORCE strips the owner's
-- exemption, and the owner's exemption is the whole mechanism a definer function
-- runs on -- so leaving this set would make app_record_change insert nothing,
-- silently, forever. smoke-rls derives this rule from the catalogue and will
-- fail the moment the two disagree again. ADR-057.
ALTER TABLE audit_log NO FORCE ROW LEVEL SECURITY;

COMMENT ON TABLE audit_log IS
  'Written by app_record_change, SECURITY DEFINER. Must never be set FORCE ROW '
  'LEVEL SECURITY -- see 0030, ADR-057.';

/**
 * Record something the SYSTEM did, in a space, with nobody signed in.
 *
 * actor_type 'system' is already in the CHECK constraint from 0000 and has
 * never been used. This is what it was for.
 */
CREATE OR REPLACE FUNCTION app_record_change(
  p_space_id  uuid,
  p_action    text,
  p_target_id uuid,
  p_metadata  jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Nothing to record against a space that no longer exists. A worker holding
  -- a job for a deleted space should not fail the job over its logging.
  IF NOT EXISTS (SELECT 1 FROM spaces WHERE id = p_space_id) THEN
    RETURN;
  END IF;

  INSERT INTO audit_log (space_id, actor_type, action, target_id, metadata)
  VALUES (p_space_id, 'system', p_action, p_target_id, p_metadata);
END;
$$;

REVOKE ALL ON FUNCTION app_record_change(uuid, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_record_change(uuid, text, uuid, jsonb) TO jotdojo_app;

-- ---------------------------------------------------------------- the feed --
--
-- comments_note_idx is keyed by NOTE, which is right for reading one note's
-- thread and useless for "what did anybody say in this space this week" -- that
-- scans. The feed reads comments alongside audit rows, so it needs the same
-- shape audit_log already has.
CREATE INDEX comments_space_recent_idx ON comments (space_id, created_at DESC);

-- The feed excludes note.read, and there are a lot of them. A partial index on
-- everything ELSE keeps the common query off the dominant rows entirely.
CREATE INDEX audit_log_changes_idx ON audit_log (space_id, created_at DESC)
  WHERE action <> 'note.read';
