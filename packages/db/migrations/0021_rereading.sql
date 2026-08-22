-- Re-reading old content with a newer model. M5, ADR-046.
--
-- This is the payoff for storing STROKES rather than a flattened raster
-- (docs/08). A page drawn last year can be read again by a better model, and
-- the person who drew it does nothing and loses nothing.
--
-- It is deliberately a REQUEST, never automatic. Re-reading a corpus costs real
-- money per page, and a worker that noticed a changed VISION_MODEL on boot and
-- re-read everything would be the most expensive surprise this product could
-- deliver. The worker ships a command, and the command dry-runs by default.

/**
 * What is stale: read by something OTHER than the model we would use now.
 *
 * One definition, used by both the count and the requeue, so a dry run can
 * never disagree with what the real pass would do.
 *
 * STABLE and read-only. It reports; it does not spend anything.
 */
CREATE OR REPLACE FUNCTION app_stale_transcripts(
  p_kind   text,
  p_source text,
  p_limit  integer DEFAULT 500
) RETURNS TABLE (block_id uuid)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT b.id
    FROM blocks b
   WHERE b.kind = p_kind
     AND b.transcript_source IS NOT NULL
     -- A CORRECTION IS GROUND TRUTH AND IS NEVER RE-READ.
     --
     -- packages/domain/src/ink.ts says overwriting a person's correction with a
     -- "better" model would be the single most infuriating thing this product
     -- could do. This clause is where that promise is actually kept.
     AND b.transcript_source <> 'user'
     AND b.transcript_source <> p_source
     -- Already waiting to be read. Queueing it twice would bill twice.
     AND NOT EXISTS (
       SELECT 1 FROM outbox o
        WHERE o.topic = 'block.recognize'
          AND o.completed_at IS NULL
          AND o.payload ->> 'blockId' = b.id::text
     )
   ORDER BY b.created_at
   LIMIT p_limit
$$;

/**
 * Queue the stale ones. Returns how many, so a caller can log something true.
 *
 * The jobs are ordinary `block.recognize` rows, which means everything already
 * decided applies without a second mechanism: app_claim_recognize_jobs still
 * defers a space that is over quota (ADR-036), the worker still meters each
 * reading, and an anon draft at zero allowance still reads nothing.
 */
CREATE OR REPLACE FUNCTION app_requeue_recognition(
  p_kind   text,
  p_source text,
  p_limit  integer DEFAULT 500
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_queued integer;
BEGIN
  WITH stale AS (
    SELECT block_id AS id FROM app_stale_transcripts(p_kind, p_source, p_limit)
  ), queued AS (
    INSERT INTO outbox (topic, payload)
    SELECT 'block.recognize', jsonb_build_object('blockId', s.id::text)
      FROM stale s
    RETURNING id
  ), marked AS (
    -- 'pending' the same way appending a stroke does. The OLD transcript stays
    -- in the column and stays readable -- nothing goes blank while it waits.
    UPDATE blocks b SET transcript_state = 'pending'
      FROM stale s
     WHERE b.id = s.id
    RETURNING b.id
  )
  SELECT count(*) INTO v_queued FROM queued;
  RETURN COALESCE(v_queued, 0);
END;
$$;

REVOKE ALL ON FUNCTION app_stale_transcripts(text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_requeue_recognition(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_stale_transcripts(text, text, integer)   TO jotdojo_app;
GRANT EXECUTE ON FUNCTION app_requeue_recognition(text, text, integer) TO jotdojo_app;
