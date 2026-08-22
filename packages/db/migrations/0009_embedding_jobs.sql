-- Semantic search, part one: how the worker reaches the database.
--
-- 0000 created a `jotdojo_worker` role with BYPASSRLS, on the reasoning that
-- embedding legitimately crosses spaces. This migration deletes that role and
-- replaces it with three narrow SECURITY DEFINER doors.
--
-- The reason is the bug we already had. Connecting as a role that bypasses RLS
-- makes the entire tenancy boundary inert while every policy still reads as
-- enforced. Keeping such a role in the cluster means one mis-pasted connection
-- string -- in a Helm value, a Key Vault secret, a .env -- silently disables
-- tenancy everywhere, and nothing fails in a way that makes it visible. A door
-- that can only claim an embedding job, store a vector, and close a job has no
-- such failure mode: point the application at it and it simply cannot do
-- anything else.
--
-- ADR-024.

DROP ROLE IF EXISTS jotdojo_worker;

-- Autosave queues a job every few seconds. Without this, a note edited for ten
-- minutes arrives at the worker as a hundred jobs that all embed the same
-- text. Used by queueEmbedding() in packages/domain/src/notes.ts to collapse
-- them into one pending job per note.
CREATE INDEX IF NOT EXISTS outbox_pending_embed_idx
  ON outbox ((payload ->> 'noteId'))
  WHERE topic = 'block.embed' AND completed_at IS NULL;

-- --------------------------------------------------------------- claim ----
--
-- One call claims outbox rows and returns the block text to embed. Claiming
-- and reading are a single door on purpose: a caller that could read without
-- claiming would be a broader capability than the worker needs.
--
-- FOR UPDATE SKIP LOCKED so N workers drain concurrently without blocking on
-- each other and without handing the same job out twice.
--
-- Written as three sequential statements rather than one statement with
-- data-modifying CTEs, because two CTEs updating the same outbox row in one
-- statement is documented as unpredictable -- the second update silently does
-- nothing. Sequential statements in plpgsql see each other's writes.
--
-- Every column below is table-qualified. RETURNS TABLE names are plpgsql
-- variables, and an unqualified `space_id` here would resolve to the output
-- variable rather than the column -- which is ADR-020, the bug where a
-- security check quietly stopped running and its test still passed.

DROP FUNCTION IF EXISTS app_claim_embed_jobs(integer, integer);

CREATE FUNCTION app_claim_embed_jobs(
  batch integer DEFAULT 16,
  lease_seconds integer DEFAULT 120
)
RETURNS TABLE (job_id bigint, block_id uuid, space_id uuid, content text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ids bigint[];
BEGIN
  WITH claimed AS (
    SELECT o.id
      FROM outbox o
     WHERE o.topic = 'block.embed'
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

  -- "milk" does not need a vector (docs/07-capture-pipeline.md), and neither
  -- does a note that has since been deleted. Such a job has no work in it, so
  -- it is closed here. Leaving it for the caller would strand it: the caller
  -- never receives a row for it, so it would sit leased, expire, retry, and
  -- eventually park itself as failed -- a queue slowly filling with jobs whose
  -- only fault is that the note was short.
  UPDATE outbox o
     SET completed_at = now(), locked_until = NULL
   WHERE o.id = ANY(v_ids)
     AND NOT EXISTS (
       SELECT 1
         FROM blocks b
         JOIN notes n ON n.id = b.note_id
        WHERE b.note_id = (o.payload ->> 'noteId')::uuid
          AND n.deleted_at IS NULL
          AND length(coalesce(b.body, b.transcript, '')) >= 15
     );

  RETURN QUERY
  SELECT o.id, b.id, b.space_id, coalesce(b.body, b.transcript, '')
    FROM outbox o
    JOIN blocks b ON b.note_id = (o.payload ->> 'noteId')::uuid
    JOIN notes  n ON n.id = b.note_id AND n.deleted_at IS NULL
   WHERE o.id = ANY(v_ids)
     AND o.completed_at IS NULL
     AND length(coalesce(b.body, b.transcript, '')) >= 15;
END
$$;

-- --------------------------------------------------------------- store ----
--
-- Upsert, because re-embedding after an edit or a model change is normal.

DROP FUNCTION IF EXISTS app_store_embedding(uuid, uuid, vector, text);

CREATE FUNCTION app_store_embedding(
  p_block_id uuid, p_space_id uuid, p_embedding vector, p_model text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- The space is read from the block rather than trusted from the caller, so a
  -- wrong space_id cannot file one tenant's vector under another tenant's
  -- space -- which would make it findable by the wrong people. p_space_id is
  -- accepted only so a mismatch can be refused rather than ignored.
  INSERT INTO block_embeddings (block_id, space_id, embedding, model)
  SELECT b.id, b.space_id, p_embedding, p_model
    FROM blocks b
   WHERE b.id = p_block_id
     AND b.space_id = p_space_id
  ON CONFLICT (block_id) DO UPDATE
    SET embedding  = EXCLUDED.embedding,
        model      = EXCLUDED.model,
        created_at = now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'block % is not in space %', p_block_id, p_space_id;
  END IF;
END
$$;

-- -------------------------------------------------------------- finish ----

DROP FUNCTION IF EXISTS app_finish_embed_job(bigint, text);

CREATE FUNCTION app_finish_embed_job(p_job_id bigint, p_error text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_error IS NULL THEN
    UPDATE outbox o
       SET completed_at = now(), locked_until = NULL, last_error = NULL
     WHERE o.id = p_job_id;
  ELSE
    -- Exponential backoff, capped at an hour, then parked. A job that has
    -- failed six times will not succeed on the seventh; it stays in the table
    -- with its error so it can be found, rather than retrying forever.
    UPDATE outbox o
       SET locked_until = NULL,
           last_error   = left(p_error, 2000),
           available_at = now() + make_interval(secs => least(3600, power(3, o.attempts)::int)),
           completed_at = CASE WHEN o.attempts >= 6 THEN now() ELSE NULL END
     WHERE o.id = p_job_id;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app_claim_embed_jobs(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_store_embedding(uuid, uuid, vector, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_finish_embed_job(bigint, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app_claim_embed_jobs(integer, integer) TO jotdojo_app;
GRANT EXECUTE ON FUNCTION app_store_embedding(uuid, uuid, vector, text) TO jotdojo_app;
GRANT EXECUTE ON FUNCTION app_finish_embed_job(bigint, text) TO jotdojo_app;
