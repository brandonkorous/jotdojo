-- The triage agent: a scheduled pass that reads new notes and leaves a comment.
-- docs/07-capture-pipeline.md, M5, ADR-048.
--
-- Three properties this file exists to guarantee, in the order they matter:
--
-- 1. OFF MEANS OFF. Opt-in per space, checked when work is queued AND again
--    when it is claimed, so a job queued last night does not speak this morning
--    to somebody who turned it off in between.
-- 2. It never edits. Its only output is a comment, which is reviewable and
--    reversible -- the whole mitigation for prompt injection through note
--    content (ADR-004).
-- 3. No note is silently skipped. The watermark advances only past notes that
--    were actually considered, so a busy space catches up instead of losing a
--    day.

ALTER TABLE spaces
  ADD COLUMN triage_enabled     boolean NOT NULL DEFAULT false,
  ADD COLUMN triage_last_run_at timestamptz;

-- Owners turn it on; members see the switch and cannot flip it. The column
-- grant is what keeps this policy from becoming a way to edit `plan` -- a row
-- policy cannot name columns, and a GRANT cannot name rows, so it takes both.
CREATE POLICY spaces_owner_settings ON spaces FOR UPDATE
  USING (app_is_space_owner(id)) WITH CHECK (app_is_space_owner(id));

GRANT UPDATE (triage_enabled) ON spaces TO jotdojo_app;

-- Team only, per docs/01-audience-and-pricing.md. Here rather than in TypeScript
-- for the same reason the allowances are: the function that enforces it runs in
-- the database, and a rule the enforcer cannot see is a rule that drifts.
CREATE OR REPLACE FUNCTION app_plan_allows_triage(p_plan text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT p_plan = 'team'
$$;

-- A triage run is metered like a page or a minute is: it is a model call, and
-- docs/01 lists it as cost of goods. One note read is one unit.
ALTER TABLE recognition_usage DROP CONSTRAINT recognition_usage_kind_check;
ALTER TABLE recognition_usage ADD CONSTRAINT recognition_usage_kind_check
  CHECK (kind IN ('ink','image','audio','triage'));

-- The triage agent has no MCP client, because nobody connected it -- it is
-- ours, running on its own schedule. The constraint's intent was that an agent
-- comment is never unattributed, and a model name attributes it.
ALTER TABLE comments DROP CONSTRAINT comments_author_ck;
ALTER TABLE comments ADD CONSTRAINT comments_author_ck CHECK (
  (author_type = 'user'  AND author_user_id IS NOT NULL) OR
  (author_type = 'agent' AND (agent_client_id IS NOT NULL OR agent_model IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS outbox_pending_triage_idx
  ON outbox ((payload ->> 'noteId'))
  WHERE topic = 'note.triage' AND completed_at IS NULL;

-- --------------------------------------------------------------- queueing ---

CREATE OR REPLACE FUNCTION app_enqueue_triage(
  p_quiet    interval DEFAULT '15 minutes',
  p_lookback interval DEFAULT '24 hours',
  p_limit    integer  DEFAULT 200
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

-- --------------------------------------------------------------- claiming ---

CREATE OR REPLACE FUNCTION app_claim_triage_jobs(
  batch integer DEFAULT 4,
  lease_seconds integer DEFAULT 300
)
RETURNS TABLE (job_id bigint, note_id uuid, space_id uuid, title text, content text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_ids bigint[];
BEGIN
  WITH claimed AS (
    SELECT o.id
      FROM outbox o
     WHERE o.topic = 'note.triage'
       AND o.completed_at IS NULL
       AND o.available_at <= now()
       AND (o.locked_until IS NULL OR o.locked_until < now())
     ORDER BY o.available_at
     LIMIT batch
     FOR UPDATE SKIP LOCKED
  ),
  leased AS (
    UPDATE outbox o
       SET locked_until = now() + make_interval(secs => lease_seconds),
           attempts     = o.attempts + 1
      FROM claimed c
     WHERE o.id = c.id
    RETURNING o.id
  )
  SELECT array_agg(leased.id) INTO v_ids FROM leased;

  IF v_ids IS NULL THEN
    RETURN;
  END IF;

  -- Switched off, downgraded, or deleted since this was queued. Closed here
  -- rather than at the worker so that OFF takes effect on work already in the
  -- queue, which is the only reading of "off" a person would accept.
  UPDATE outbox o
     SET completed_at = now(), locked_until = NULL
   WHERE o.id = ANY(v_ids)
     AND NOT EXISTS (
       SELECT 1
         FROM notes n
         JOIN spaces s ON s.id = n.space_id
        WHERE n.id = (o.payload ->> 'noteId')::uuid
          AND n.deleted_at IS NULL
          AND s.triage_enabled
          AND app_plan_allows_triage(s.plan)
     );

  -- Over the allowance. Closed, not deferred: recognition deferred to next
  -- month is still worth having, because the strokes wait. A remark about a
  -- note from five weeks ago is not, so it is dropped, and the outbox row says
  -- why rather than vanishing.
  UPDATE outbox o
     SET completed_at = now(), locked_until = NULL,
         last_error   = 'over the recognition allowance for this period'
   WHERE o.id = ANY(v_ids)
     AND o.completed_at IS NULL
     AND EXISTS (
       SELECT 1 FROM notes n
        WHERE n.id = (o.payload ->> 'noteId')::uuid
          AND app_space_over_quota(n.space_id)
     );

  RETURN QUERY
  SELECT o.id, n.id, n.space_id, n.title,
         -- What the note actually says, in reading order: typed text, or the
         -- transcript of whatever was drawn, photographed or spoken.
         (SELECT string_agg(COALESCE(NULLIF(b.body, ''), b.transcript), E'\n\n'
                            ORDER BY b.position)
            FROM blocks b
           WHERE b.note_id = n.id
             AND COALESCE(NULLIF(b.body, ''), b.transcript) IS NOT NULL)
    FROM outbox o
    JOIN notes n ON n.id = (o.payload ->> 'noteId')::uuid
   WHERE o.id = ANY(v_ids)
     AND o.completed_at IS NULL
     AND o.locked_until IS NOT NULL;
END
$$;

-- ---------------------------------------------------------------- writing ---

-- The one door that lets a machine speak without a person behind it. It can
-- write a comment and nothing else: no note body, no title, no block. That
-- narrowness IS the safety property (ADR-004), and it is enforced by there
-- being no other function.
CREATE OR REPLACE FUNCTION app_comment_as_agent(
  p_note_id uuid,
  p_body    text,
  p_model   text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF p_model IS NULL OR btrim(p_model) = '' THEN
    RAISE EXCEPTION 'an agent comment must name the model that wrote it';
  END IF;

  INSERT INTO comments (note_id, space_id, body, author_type, agent_model)
  SELECT n.id, n.space_id, btrim(p_body), 'agent', p_model
    FROM notes n
    JOIN spaces s ON s.id = n.space_id
   WHERE n.id = p_note_id
     AND n.deleted_at IS NULL
     AND s.triage_enabled
     AND app_plan_allows_triage(s.plan)
     AND btrim(p_body) <> ''
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION app_record_triage(p_note_id uuid, p_units integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- block_id is null: a triage run is about a whole note, not one block. The
  -- column has always been nullable and this is the first thing to use that.
  INSERT INTO recognition_usage (space_id, block_id, kind, units)
  SELECT n.space_id, NULL, 'triage', GREATEST(p_units, 1)
    FROM notes n WHERE n.id = p_note_id;
END;
$$;

REVOKE ALL ON FUNCTION app_enqueue_triage(interval, interval, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_claim_triage_jobs(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_comment_as_agent(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_record_triage(uuid, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app_plan_allows_triage(text)                     TO jotdojo_app;
GRANT EXECUTE ON FUNCTION app_enqueue_triage(interval, interval, integer)  TO jotdojo_app;
GRANT EXECUTE ON FUNCTION app_claim_triage_jobs(integer, integer)          TO jotdojo_app;
GRANT EXECUTE ON FUNCTION app_comment_as_agent(uuid, text, text)           TO jotdojo_app;
GRANT EXECUTE ON FUNCTION app_record_triage(uuid, integer)                 TO jotdojo_app;
