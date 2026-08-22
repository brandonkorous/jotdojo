-- Images and audio join the recognition queue.
--
-- This is the ONLY migration adding photo and voice capture required, which is
-- the claim docs/07-capture-pipeline.md makes: every modality collapses to the
-- same four fields on `blocks`, so a new one is a new recognizer rather than a
-- schema change. `blocks.kind` already allowed 'image' and 'audio',
-- `media_assets` already had blob_url, mime_type, byte_size, duration_ms and
-- width/height, and nothing in 0000_init.sql moved.
--
-- What did have to change is this function, which was written for ink and
-- looked only at `a.strokes`. It now returns the artifact row and lets the
-- worker dispatch on kind.

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

  RETURN QUERY
  SELECT o.id, b.id, b.space_id, b.kind, a.strokes, a.blob_url, a.mime_type
    FROM outbox o
    JOIN blocks b ON b.id = (o.payload ->> 'blockId')::uuid
    JOIN notes  n ON n.id = b.note_id AND n.deleted_at IS NULL
    JOIN media_assets a ON a.id = b.artifact_id
   WHERE o.id = ANY(v_ids)
     AND o.completed_at IS NULL
     AND b.transcript_source IS DISTINCT FROM 'user';
END
$$;

REVOKE ALL ON FUNCTION app_claim_recognize_jobs(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_claim_recognize_jobs(integer, integer) TO jotdojo_app;
