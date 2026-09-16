-- A structure job whose page is gone must not hold up every job behind it.
--
-- app_claim_structure_jobs picked the oldest due jobs in a CTE and then JOINed
-- them to blocks and media_assets to fetch the strokes. A job whose block no
-- longer exists matched nothing, so the UPDATE touched no row: it was not
-- leased, `attempts` stayed 0, it was not completed, and the next call picked
-- exactly the same rows again.
--
-- With a batch of 8 and eight dead jobs at the head of the queue, every claim
-- returns zero rows. The worker reads that as "nothing to do" and stops, and
-- every healthy job behind them waits forever. Nothing reports it: no error is
-- recorded, no attempt is counted, and the queue length is not a metric.
-- Measured on 2026-09-16: 8 dead jobs in front, 19 healthy jobs behind, and
-- `SELECT count(*) FROM app_claim_structure_jobs(8)` returning 0.
--
-- app_claim_recognize_jobs has never had this problem, and its comment names
-- the very case this one forgot -- "a note that was deleted". It leases first
-- and then completes whatever turns out to have nothing to read. This makes
-- structure work the same way.
--
-- docs/personas/issues/023-eight-dead-jobs-stopped-every-drawing-being-read.md

CREATE OR REPLACE FUNCTION app_claim_structure_jobs(p_limit integer)
RETURNS TABLE(job_id bigint, block_id uuid, space_id uuid, strokes jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ids bigint[];
BEGIN
  -- Lease FIRST, unconditionally. Whether the page still exists is a question
  -- about the job, and a job has to be held before it can be asked anything.
  WITH claimed AS (
    SELECT o.id
      FROM outbox o
     WHERE o.topic = 'block.structure'
       AND o.completed_at IS NULL
       AND o.available_at <= now()
       AND (o.locked_until IS NULL OR o.locked_until < now())
     ORDER BY o.available_at
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  ),
  leased AS (
    UPDATE outbox o
       SET attempts = o.attempts + 1,
           locked_until = now() + make_interval(secs => 120)
      FROM claimed c
     WHERE o.id = c.id
    RETURNING o.id
  )
  SELECT array_agg(leased.id) INTO v_ids FROM leased;

  IF v_ids IS NULL THEN
    RETURN;
  END IF;

  -- Nothing to read, and nothing to apologise for: the note was deleted, or the
  -- block is not ink. Finished rather than left, because a job that cannot ever
  -- succeed is done, and leaving it is what stopped the queue.
  UPDATE outbox o
     SET completed_at = now(), locked_until = NULL,
         last_error = 'the page this job was for no longer exists'
   WHERE o.id = ANY(v_ids)
     AND NOT EXISTS (
       SELECT 1
         FROM blocks b
         JOIN media_assets a ON a.id = b.artifact_id
        WHERE b.id = (o.payload ->> 'blockId')::uuid
          AND b.kind = 'ink'
     );

  -- What is left is real work.
  RETURN QUERY
  SELECT o.id, b.id, b.space_id, a.strokes
    FROM outbox o
    JOIN blocks b ON b.id = (o.payload ->> 'blockId')::uuid
    JOIN media_assets a ON a.id = b.artifact_id
   WHERE o.id = ANY(v_ids)
     AND o.completed_at IS NULL
     AND b.kind = 'ink';
END;
$$;

-- The jobs already stuck. They are dead by the same definition the function now
-- uses, and until they are closed the first eight of them keep the head of the
-- queue whatever the code does.
UPDATE outbox o
   SET completed_at = now(), locked_until = NULL,
       last_error = 'the page this job was for no longer exists'
 WHERE o.topic = 'block.structure'
   AND o.completed_at IS NULL
   AND NOT EXISTS (
     SELECT 1
       FROM blocks b
       JOIN media_assets a ON a.id = b.artifact_id
      WHERE b.id = (o.payload ->> 'blockId')::uuid
        AND b.kind = 'ink'
   );
