-- Handwriting recognition: the worker's second door, same shape as the first.
--
-- Three narrow SECURITY DEFINER functions rather than a role that can read
-- every block in every space. ADR-024 explains why at length; the short version
-- is that a BYPASSRLS role turns tenancy off everywhere the moment its
-- connection string is pasted in the wrong place, and nothing fails to say so.
--
-- Recognition needs one thing embedding did not: the strokes themselves, which
-- live in media_assets. That is a wider read, so it is a separate function
-- rather than a parameter on the existing one -- a door that opens onto one
-- more room should be a door someone had to add on purpose.

CREATE INDEX IF NOT EXISTS outbox_pending_recognize_idx
  ON outbox ((payload ->> 'blockId'))
  WHERE topic = 'block.recognize' AND completed_at IS NULL;

DROP FUNCTION IF EXISTS app_claim_recognize_jobs(integer, integer);

CREATE FUNCTION app_claim_recognize_jobs(
  batch integer DEFAULT 4,
  lease_seconds integer DEFAULT 600
)
RETURNS TABLE (job_id bigint, block_id uuid, space_id uuid, strokes jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ids bigint[];
BEGIN
  -- A longer default lease than embedding: a vision call over a full page can
  -- take a minute, and a lease that expires mid-call means a second worker
  -- starts the same page and we pay twice for one answer.
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

  -- Nothing to read: the note was deleted, the page was erased back to empty,
  -- or a person has already corrected the transcript by hand. That last case
  -- matters most -- a correction is ground truth and must never be overwritten
  -- by a later model (docs/08). Closed here so it cannot strand the queue.
  UPDATE outbox o
     SET completed_at = now(), locked_until = NULL
   WHERE o.id = ANY(v_ids)
     AND NOT EXISTS (
       SELECT 1
         FROM blocks b
         JOIN notes n ON n.id = b.note_id
         JOIN media_assets a ON a.id = b.artifact_id
        WHERE b.id = (o.payload ->> 'blockId')::uuid
          AND b.kind = 'ink'
          AND n.deleted_at IS NULL
          AND b.transcript_source IS DISTINCT FROM 'user'
          AND jsonb_array_length(a.strokes -> 'strokes') > 0
     );

  RETURN QUERY
  SELECT o.id, b.id, b.space_id, a.strokes
    FROM outbox o
    JOIN blocks b ON b.id = (o.payload ->> 'blockId')::uuid
    JOIN notes  n ON n.id = b.note_id AND n.deleted_at IS NULL
    JOIN media_assets a ON a.id = b.artifact_id
   WHERE o.id = ANY(v_ids)
     AND o.completed_at IS NULL
     AND b.transcript_source IS DISTINCT FROM 'user';
END
$$;

-- ---------------------------------------------------------------- store ----

DROP FUNCTION IF EXISTS app_store_transcript(uuid, text, text, real);

CREATE FUNCTION app_store_transcript(
  p_block_id uuid,
  p_transcript text,
  p_source text,
  p_confidence real
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- The `transcript_source IS DISTINCT FROM 'user'` guard is the load-bearing
  -- clause in this file, and it is here as well as in the claim function on
  -- purpose. A person can correct a transcript at any moment, including while
  -- a recognition job for that block is already in flight -- so checking only
  -- at claim time leaves a window where a model quietly overwrites what
  -- somebody typed to fix it. Doing that would be the single most infuriating
  -- thing this product could do. docs/08.
  UPDATE blocks b
     SET transcript        = p_transcript,
         transcript_source = p_source,
         confidence        = p_confidence,
         transcript_state  = 'ready'
   WHERE b.id = p_block_id
     AND b.transcript_source IS DISTINCT FROM 'user';
END
$$;

DROP FUNCTION IF EXISTS app_fail_transcript(uuid);

CREATE FUNCTION app_fail_transcript(p_block_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- 'failed', not 'ready'. The strokes are intact and the page is fine; what
  -- is missing is the reading of it. The UI has to be able to tell the
  -- difference between "this page says nothing" and "we could not read it",
  -- and so does an agent asking over MCP.
  UPDATE blocks b
     SET transcript_state = 'failed'
   WHERE b.id = p_block_id
     AND b.transcript_source IS DISTINCT FROM 'user';
END
$$;

REVOKE ALL ON FUNCTION app_claim_recognize_jobs(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_store_transcript(uuid, text, text, real) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_fail_transcript(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app_claim_recognize_jobs(integer, integer) TO jotdojo_app;
GRANT EXECUTE ON FUNCTION app_store_transcript(uuid, text, text, real) TO jotdojo_app;
GRANT EXECUTE ON FUNCTION app_fail_transcript(uuid) TO jotdojo_app;
