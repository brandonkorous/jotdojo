-- Metering, on recognition and nothing else. ADR-007, ADR-036.
--
-- Recognition is the actual cost of goods: a vision call over a page, a
-- transcription of a recording. Storing text is not, so notes are never
-- counted and never capped.
--
-- CAPTURE IS NEVER REFUSED FOR BILLING REASONS. Over-quota work is DEFERRED --
-- the artifact is stored, the strokes are kept, and the block says `deferred`
-- rather than `failed`. When the period rolls over it is read, because the
-- strokes were never thrown away. `blocks.transcript_state` has allowed
-- 'deferred' since 0000; this is the migration that finally sets it.

CREATE TABLE recognition_usage (
  id         bigserial PRIMARY KEY,
  space_id   uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  block_id   uuid REFERENCES blocks(id) ON DELETE SET NULL,
  kind       text NOT NULL CHECK (kind IN ('ink','image','audio')),
  -- One unit is one page, one photo, or one started minute of audio. Written
  -- down here because a number nobody can explain is a number nobody trusts.
  units      integer NOT NULL CHECK (units > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The lookup the claim function does on every batch: one space, this period.
CREATE INDEX recognition_usage_period_idx
  ON recognition_usage (space_id, created_at DESC);

ALTER TABLE recognition_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE recognition_usage FORCE  ROW LEVEL SECURITY;

-- Readable by members, written only by the worker's door below. Someone should
-- be able to see what they have used without being able to edit the meter.
CREATE POLICY recognition_usage_read ON recognition_usage FOR SELECT
  USING (app_can_reach_space(space_id));

GRANT SELECT ON recognition_usage TO jotdojo_app;

-- ---------------------------------------------------------------- plans ----
--
-- Allowances live in SQL, not in application code, because the claim function
-- is the thing that enforces them and it runs in the database. A limit defined
-- somewhere the enforcer cannot see it is a limit that drifts.

CREATE OR REPLACE FUNCTION app_plan_allowance(p_plan text) RETURNS integer
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_plan
    WHEN 'family' THEN 2000
    WHEN 'team'   THEN 10000
    -- Free is deliberately usable rather than a demo: enough to find out
    -- whether the loop is worth paying for. docs/01-audience-and-pricing.md.
    ELSE 100
  END
$$;

/** The current billing period, monthly, aligned to the calendar in UTC. */
CREATE OR REPLACE FUNCTION app_period_start() RETURNS timestamptz
LANGUAGE sql STABLE AS $$
  SELECT date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
$$;

CREATE OR REPLACE FUNCTION app_space_usage(p_space uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(sum(units), 0)::integer
    FROM recognition_usage
   WHERE space_id = p_space AND created_at >= app_period_start()
$$;

CREATE OR REPLACE FUNCTION app_space_over_quota(p_space uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app_space_usage(p_space)
       >= app_plan_allowance((SELECT plan FROM spaces WHERE id = p_space))
$$;

GRANT EXECUTE ON FUNCTION app_plan_allowance(text)   TO jotdojo_app;
GRANT EXECUTE ON FUNCTION app_period_start()         TO jotdojo_app;
GRANT EXECUTE ON FUNCTION app_space_usage(uuid)      TO jotdojo_app;
GRANT EXECUTE ON FUNCTION app_space_over_quota(uuid) TO jotdojo_app;

-- ------------------------------------------------------------ the meter ----

CREATE OR REPLACE FUNCTION app_record_recognition(
  p_block_id uuid,
  p_units    integer
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO recognition_usage (space_id, block_id, kind, units)
  SELECT b.space_id, b.id, b.kind, GREATEST(p_units, 1)
    FROM blocks b WHERE b.id = p_block_id;
END;
$$;

REVOKE ALL ON FUNCTION app_record_recognition(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_record_recognition(uuid, integer) TO jotdojo_app;

-- ------------------------------------------------------------- deferral ----
--
-- Enforced at CLAIM time, in the same function that decides what work exists.
-- Putting the check in the worker instead would mean a job is claimed, leased,
-- and then put back -- which spins the queue and burns attempts on work that
-- was never going to run.
--
-- A deferred job is not failed and not lost. Its outbox row is pushed to the
-- start of the next period, so it becomes claimable again on its own, with no
-- backfill to remember to run.

DROP FUNCTION IF EXISTS app_claim_recognize_jobs(integer, integer);

CREATE FUNCTION app_claim_recognize_jobs(
  batch integer DEFAULT 4,
  lease_seconds integer DEFAULT 600
)
RETURNS TABLE (
  job_id    bigint,
  block_id  uuid,
  space_id  uuid,
  kind      text,
  strokes   jsonb,
  blob_url  text,
  mime_type text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ids bigint[];
BEGIN
  WITH claimed AS (
    SELECT o.id
      FROM outbox o
     WHERE o.topic = 'block.recognize'
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

  -- Nothing to read. Per kind: an ink page erased back to empty, or an image
  -- or audio block whose bytes never arrived. Plus, for every kind, a note that
  -- was deleted and -- the one that matters -- a transcript a PERSON has
  -- corrected, which is ground truth and must never be overwritten (ADR-027).
  UPDATE outbox o
     SET completed_at = now(), locked_until = NULL
   WHERE o.id = ANY(v_ids)
     AND NOT EXISTS (
       SELECT 1
         FROM blocks b
         JOIN notes n ON n.id = b.note_id
         JOIN media_assets a ON a.id = b.artifact_id
        WHERE b.id = (o.payload ->> 'blockId')::uuid
          AND n.deleted_at IS NULL
          AND b.transcript_source IS DISTINCT FROM 'user'
          AND CASE b.kind
                WHEN 'ink'   THEN jsonb_array_length(a.strokes -> 'strokes') > 0
                WHEN 'image' THEN a.blob_url IS NOT NULL AND a.byte_size > 0
                WHEN 'audio' THEN a.blob_url IS NOT NULL AND a.byte_size > 0
                ELSE false
              END
     );

  -- Over quota: say so on the block, and hand the job back to the next period
  -- rather than to this worker. The artifact is untouched.
  UPDATE blocks b
     SET transcript_state = 'deferred'
    FROM outbox o
   WHERE o.id = ANY(v_ids)
     AND o.completed_at IS NULL
     AND b.id = (o.payload ->> 'blockId')::uuid
     AND app_space_over_quota(b.space_id);

  UPDATE outbox o
     SET locked_until = NULL,
         available_at = app_period_start() + interval '1 month',
         attempts     = GREATEST(o.attempts - 1, 0)
   WHERE o.id = ANY(v_ids)
     AND o.completed_at IS NULL
     AND EXISTS (
       SELECT 1 FROM blocks b
        WHERE b.id = (o.payload ->> 'blockId')::uuid
          AND app_space_over_quota(b.space_id)
     );

  RETURN QUERY
  SELECT o.id, b.id, b.space_id, b.kind, a.strokes, a.blob_url, a.mime_type
    FROM outbox o
    JOIN blocks b ON b.id = (o.payload ->> 'blockId')::uuid
    JOIN notes  n ON n.id = b.note_id AND n.deleted_at IS NULL
    JOIN media_assets a ON a.id = b.artifact_id
   WHERE o.id = ANY(v_ids)
     AND o.completed_at IS NULL
     AND o.locked_until IS NOT NULL
     AND b.transcript_source IS DISTINCT FROM 'user';
END
$$;

REVOKE ALL ON FUNCTION app_claim_recognize_jobs(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_claim_recognize_jobs(integer, integer) TO jotdojo_app;
