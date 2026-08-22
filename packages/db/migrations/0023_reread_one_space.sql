-- Re-reading can be scoped to one space. ADR-046.
--
-- 0021 could only ever re-read EVERYTHING, oldest first, which is the wrong
-- shape for the way this actually gets used: somebody writes in to say their old
-- handwriting reads badly, and the answer should be "we re-ran your space",
-- not "we re-ran the corpus and yours is somewhere in it".
--
-- It also bounds the blast radius of a support action. A scoped pass costs one
-- customer's pages; an unscoped one costs every customer's, and the person
-- running it at 11pm cannot tell the difference from the command line.
--
-- NULL means every space, so the existing callers keep their meaning.

CREATE OR REPLACE FUNCTION app_stale_transcripts(
  p_kind     text,
  p_source   text,
  p_limit    integer DEFAULT 500,
  p_space_id uuid DEFAULT NULL
) RETURNS TABLE (block_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id
    FROM blocks b
   WHERE b.kind = p_kind
     AND (p_space_id IS NULL OR b.space_id = p_space_id)
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

CREATE OR REPLACE FUNCTION app_requeue_recognition(
  p_kind     text,
  p_source   text,
  p_limit    integer DEFAULT 500,
  p_space_id uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_queued integer;
BEGIN
  WITH stale AS (
    SELECT block_id AS id
      FROM app_stale_transcripts(p_kind, p_source, p_limit, p_space_id)
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

-- The three-argument forms are gone: a default parameter added to an existing
-- signature creates an OVERLOAD, and two functions differing only by a default
-- make every call ambiguous.
DROP FUNCTION IF EXISTS app_stale_transcripts(text, text, integer);
DROP FUNCTION IF EXISTS app_requeue_recognition(text, text, integer);

REVOKE ALL ON FUNCTION app_stale_transcripts(text, text, integer, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_requeue_recognition(text, text, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_stale_transcripts(text, text, integer, uuid)   TO jotdojo_app;
GRANT EXECUTE ON FUNCTION app_requeue_recognition(text, text, integer, uuid) TO jotdojo_app;
