-- Triage can be queued for one space. ADR-048, and the same lesson as ADR-046.
--
-- 0024 could only ever mean "every space that has it switched on", which is the
-- right default for the worker's clock and the wrong shape for the two times a
-- person is actually waiting on it:
--
--   * somebody has just turned it on and wants to see it do something, rather
--     than waiting up to five minutes for the next tick;
--   * a suite that shares a database with fifteen others and needs its own
--     numbers to mean something.
--
-- The second one is not a testing convenience. `triage:smoke` passed on its
-- first run and failed the moment another space in the same database had the
-- agent switched on -- so the suite had been proving "nothing else was going on"
-- alongside what it claimed to prove, and only said so by luck.
--
-- NULL means every space, so the worker's call keeps its meaning.

CREATE OR REPLACE FUNCTION app_enqueue_triage(
  p_quiet    interval DEFAULT '15 minutes',
  p_lookback interval DEFAULT '24 hours',
  p_limit    integer  DEFAULT 200,
  p_space_id uuid     DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_queued integer;
BEGIN
  WITH due AS (
    -- A space switched on today does not get its whole history read. The
    -- look-back is what somebody would expect "from now on" to mean, and
    -- reading three years of notes on a Tuesday is a bill, not a feature.
    SELECT s.id AS space_id,
           COALESCE(s.triage_last_run_at, now() - p_lookback) AS since
      FROM spaces s
     WHERE s.triage_enabled
       AND app_plan_allows_triage(s.plan)
       AND (p_space_id IS NULL OR s.id = p_space_id)
  ),
  fresh AS (
    -- `p_quiet` is the difference between an assistant and an interruption.
    -- A note still being typed is not finished, and remarking on half a
    -- sentence is how this feature earns its reputation.
    SELECT n.id AS note_id, n.space_id, n.updated_at
      FROM notes n
      JOIN due d ON d.space_id = n.space_id
     WHERE n.deleted_at IS NULL
       AND n.updated_at >  d.since
       AND n.updated_at <= now() - p_quiet
       AND NOT EXISTS (
         SELECT 1 FROM outbox o
          WHERE o.topic = 'note.triage'
            AND o.completed_at IS NULL
            AND o.payload ->> 'noteId' = n.id::text
       )
     ORDER BY n.updated_at
     LIMIT p_limit
  ),
  queued AS (
    INSERT INTO outbox (topic, payload)
    SELECT 'note.triage', jsonb_build_object('noteId', f.note_id::text) FROM fresh f
    RETURNING id
  ),
  -- The watermark moves to where we actually got to, not to now(). When the
  -- batch was truncated every note at or before the last one taken has been
  -- dealt with -- the ordering is global and oldest-first -- so that timestamp
  -- is exactly the safe place to resume, for every space in the batch.
  stamped AS (
    UPDATE spaces s
       SET triage_last_run_at = COALESCE(
             (SELECT CASE WHEN count(*) >= p_limit THEN max(f.updated_at) END FROM fresh f),
             now() - p_quiet)
     WHERE s.id IN (SELECT space_id FROM due)
    RETURNING s.id
  )
  SELECT count(*)::int INTO v_queued FROM queued;
  RETURN COALESCE(v_queued, 0);
END;
$$;

-- The three-argument form is gone: a default parameter added to an existing
-- signature creates an OVERLOAD, and two functions differing only by a default
-- make every call ambiguous. ADR-046 learned this the same way.
DROP FUNCTION IF EXISTS app_enqueue_triage(interval, interval, integer);

REVOKE ALL ON FUNCTION app_enqueue_triage(interval, interval, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_enqueue_triage(interval, interval, integer, uuid) TO jotdojo_app;
