-- What is DRAWN on a page, as distinct from what is written on it. ADR-066.
--
-- A transcript carries words. A recognised box with bounds, and an arrow
-- connecting THIS box to THAT one, turn a hand-drawn diagram into a graph an
-- agent can reason about -- which is the thing `view_note` (ADR-068) hands over
-- as pixels and nothing can currently hand over as structure.
--
-- Follows 0024_triage.sql, which is the worked precedent for adding a pipeline:
-- an outbox topic, an enqueue function, a claim function, a narrow writer and a
-- metering function, all SECURITY DEFINER and granted to jotdojo_app alone.

-- ------------------------------------------------------------- the table --
--
-- A TABLE, not jsonb on `blocks`. `blocks` has ONE transcript slot and
-- app_store_transcript overwrites it wholesale, so structure living there would
-- be destroyed by the next re-read of the same page -- and re-reading is a
-- thing this product does deliberately (ADR-046).
--
-- Shaped after block_embeddings, which is the other "a model looked at this
-- block and produced something" table, and inherits its working RLS policy.
CREATE TABLE block_structures (
  block_id   uuid PRIMARY KEY REFERENCES blocks(id) ON DELETE CASCADE,
  space_id   uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  -- [{kind, bounds:{x,y,w,h}, label?, from?, to?}]. Deliberately loose: the
  -- shape vocabulary will grow, and a CHECK constraint on it would make every
  -- addition a migration.
  shapes     jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- WHAT read it and HOW, exactly like blocks.transcript_source -- and in its
  -- OWN column for the reason 0026 gives at length. Suffixing
  -- transcript_source instead would make every structured block permanently
  -- stale to `countStale` and re-bill the entire corpus.
  source     text NOT NULL,
  confidence real,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX block_structures_space_idx ON block_structures (space_id);

ALTER TABLE block_structures ENABLE ROW LEVEL SECURITY;
-- Not FORCE. app_store_structure below is SECURITY DEFINER and runs as the
-- table owner, and FORCE is precisely the flag that strips the owner's
-- exemption -- so the write would silently affect zero rows. smoke-rls derives
-- this rule from the catalogue and will fail if the two ever disagree.
-- ADR-057, and 0028 says it at length.
CREATE POLICY structures_member ON block_structures FOR ALL
  USING (app_can_reach_space(space_id)) WITH CHECK (app_can_reach_space(space_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON block_structures TO jotdojo_app;

COMMENT ON TABLE block_structures IS
  'Written by app_store_structure, SECURITY DEFINER. Must never be set FORCE '
  'ROW LEVEL SECURITY -- see 0031, ADR-057.';

-- A structural pass is a model call over a page, so it is metered like one.
-- docs/01 lists model calls as cost of goods; a pass nobody pays for is a pass
-- that scales with somebody else's whiteboard.
ALTER TABLE recognition_usage DROP CONSTRAINT recognition_usage_kind_check;
ALTER TABLE recognition_usage ADD CONSTRAINT recognition_usage_kind_check
  CHECK (kind IN ('ink','image','audio','triage','structure'));

-- ------------------------------------------------------------ the queue --

/**
 * Queue a structural read for an ink block.
 *
 * Coalesced onto any pending job for the same block, exactly like
 * queueRecognition -- a page somebody spends two minutes on must not produce
 * forty model calls, thirty-nine of them reading an unfinished drawing.
 */
CREATE OR REPLACE FUNCTION app_enqueue_structure(p_block_id uuid, p_delay_seconds integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE outbox
     SET available_at = now() + make_interval(secs => p_delay_seconds)
   WHERE topic = 'block.structure'
     AND completed_at IS NULL
     AND payload ->> 'blockId' = p_block_id::text;

  IF NOT FOUND THEN
    INSERT INTO outbox (topic, payload, available_at)
    VALUES ('block.structure', jsonb_build_object('blockId', p_block_id::text),
            now() + make_interval(secs => p_delay_seconds));
  END IF;
END;
$$;

/**
 * Claim structural jobs, skipping anything already being worked on.
 *
 * Only INK. A photograph of a whiteboard has structure too, and reading it is
 * a different problem -- we did not draw it, so we have no strokes and no way
 * to snap what comes back onto anything.
 */
CREATE OR REPLACE FUNCTION app_claim_structure_jobs(p_limit integer)
RETURNS TABLE (job_id bigint, block_id uuid, space_id uuid, strokes jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT o.id
      FROM outbox o
     WHERE o.topic = 'block.structure'
       AND o.completed_at IS NULL
       AND o.available_at <= now()
     ORDER BY o.available_at
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  )
  UPDATE outbox o
     SET attempts = o.attempts + 1
    FROM claimed c
    JOIN blocks b ON b.id = (
      SELECT (o2.payload ->> 'blockId')::uuid FROM outbox o2 WHERE o2.id = c.id
    )
    JOIN media_assets a ON a.id = b.artifact_id
   WHERE o.id = c.id AND b.kind = 'ink'
  RETURNING o.id, b.id, b.space_id, a.strokes;
END;
$$;

/** Store what a structural pass found. Overwrites: a later reading of the same
 *  page replaces the earlier one, the way a transcript does. */
CREATE OR REPLACE FUNCTION app_store_structure(
  p_block_id uuid, p_shapes jsonb, p_source text, p_confidence real
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_space uuid;
BEGIN
  SELECT space_id INTO v_space FROM blocks WHERE id = p_block_id;
  IF v_space IS NULL THEN RETURN; END IF;

  INSERT INTO block_structures (block_id, space_id, shapes, source, confidence)
  VALUES (p_block_id, v_space, p_shapes, p_source, p_confidence)
  ON CONFLICT (block_id) DO UPDATE
     SET shapes = excluded.shapes, source = excluded.source,
         confidence = excluded.confidence, created_at = now();
END;
$$;

REVOKE ALL ON FUNCTION app_enqueue_structure(uuid, integer)            FROM PUBLIC;
REVOKE ALL ON FUNCTION app_claim_structure_jobs(integer)               FROM PUBLIC;
REVOKE ALL ON FUNCTION app_store_structure(uuid, jsonb, text, real)    FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app_enqueue_structure(uuid, integer)         TO jotdojo_app;
GRANT EXECUTE ON FUNCTION app_claim_structure_jobs(integer)            TO jotdojo_app;
GRANT EXECUTE ON FUNCTION app_store_structure(uuid, jsonb, text, real) TO jotdojo_app;
