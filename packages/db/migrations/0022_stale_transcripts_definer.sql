-- app_stale_transcripts has to be SECURITY DEFINER, like everything else that
-- walks the whole corpus. ADR-046.
--
-- 0021 declared it STABLE and left it running as the INVOKER, which meant it
-- ran as jotdojo_app under RLS with no actor set -- and RLS with no actor sees
-- no blocks at all. So it returned nothing, always.
--
-- The failure was quietly asymmetric, which is what makes it worth this note:
-- app_requeue_recognition IS a definer and calls this one INSIDE itself, where
-- it inherits the definer's privileges and works perfectly. Queueing therefore
-- found pages to queue while the dry run that is supposed to predict it
-- reported zero. Found by `reread:smoke` on the first run.
--
-- Re-reading is the system acting on its own corpus, the same as the outbox
-- drain and the anonymous sweep. It cannot be scoped to an actor, because there
-- is no actor who can reach every space. It returns block IDs and nothing else
-- -- no note bodies, no transcripts -- and is granted only to jotdojo_app.

CREATE OR REPLACE FUNCTION app_stale_transcripts(
  p_kind   text,
  p_source text,
  p_limit  integer DEFAULT 500
) RETURNS TABLE (block_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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

REVOKE ALL ON FUNCTION app_stale_transcripts(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_stale_transcripts(text, text, integer) TO jotdojo_app;
