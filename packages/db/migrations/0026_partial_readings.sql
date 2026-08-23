-- A transcript that covers part of a surface must say so. M5, ADR-053, ADR-056.
--
-- MAX_TILES caps one surface at 32 images, and a whiteboard photographed at
-- arm's length can exceed that. Today the worker logs a warning and stores the
-- partial reading as an ordinary transcript, so an agent reading it over MCP
-- confidently reports a third of a board as the whole thing. There is no way
-- for it to know otherwise, and nothing in the row is false -- it is simply
-- incomplete, which is worse, because incompleteness is invisible.
--
-- WHY A COLUMN AND NOT THE TWO OBVIOUS ALTERNATIVES.
--
-- Not a fifth `transcript_state`: 0000_init.sql constrains that CHECK to four
-- values, and a partial read genuinely IS ready. Nothing should retry it, the
-- UI should show it, and search should index it. Only its completeness differs.
--
-- Not a suffix on `transcript_source`: docs/04 and sources.ts both say that
-- string is the staleness key, and app_stale_transcripts compares it for
-- equality. A partial suffix would make every partial block permanently stale
-- against the source we would write now -- so every re-read pass would queue
-- them all, bill for them all, and store the same suffix again. A loop that
-- costs money per lap.

ALTER TABLE blocks ADD COLUMN IF NOT EXISTS transcript_coverage real;

COMMENT ON COLUMN blocks.transcript_coverage IS
  'Fraction of the surface actually read. NULL = whole (or not applicable); '
  '< 1 = partial, and callers must say so rather than presenting it as complete.';

-- NULL rather than 1 for the existing corpus, and the distinction is real:
-- NULL means "nobody measured", 1 means "measured, and it was whole". Every
-- row written before this migration is the former, and backfilling 1 would be
-- asserting something no code ever checked.

/**
 * Store a reading, now with how much of the surface it covered.
 *
 * Dropped and recreated rather than given a DEFAULT, as 0013 and 0015 already
 * do here: an overload would let a caller that has not been updated keep
 * writing NULL coverage silently, which is precisely the invisible
 * incompleteness this migration exists to end.
 */
DROP FUNCTION IF EXISTS app_store_transcript(uuid, text, text, real);

CREATE FUNCTION app_store_transcript(
  p_block_id uuid,
  p_transcript text,
  p_source text,
  p_confidence real,
  p_coverage real
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_note_id uuid;
  v_line    text;
BEGIN
  -- The `IS DISTINCT FROM 'user'` guard is load-bearing and is deliberately
  -- here as well as in app_claim_recognize_jobs. A person can correct a
  -- transcript while a recognition job for that block is already in flight;
  -- checking only at claim time leaves a window where a model silently
  -- overwrites what somebody typed to fix it. ADR-027.
  UPDATE blocks b
     SET transcript          = p_transcript,
         transcript_source   = p_source,
         confidence          = p_confidence,
         transcript_coverage = p_coverage,
         transcript_state    = 'ready'
   WHERE b.id = p_block_id
     AND b.transcript_source IS DISTINCT FROM 'user'
  RETURNING b.note_id INTO v_note_id;

  IF v_note_id IS NULL THEN
    RETURN;  -- refused above, or no such block
  END IF;

  -- First non-empty line, stripped of markdown heading marks. Same shape as
  -- inferTitle() in packages/domain/src/notes.ts.
  SELECT trim(regexp_replace(line, '^#+\s*', ''))
    INTO v_line
    FROM regexp_split_to_table(p_transcript, E'\n') AS line
   WHERE trim(regexp_replace(line, '^#+\s*', '')) <> ''
   LIMIT 1;

  -- Only when nothing has named it. A title the person typed, or one already
  -- inferred from text they typed, outranks anything read off a page.
  --
  -- A PARTIAL READING NEVER NAMES A NOTE. The first line of the first tile of
  -- a board we only partly read is a guess at what the board is about, and a
  -- wrong title is far stickier than a wrong transcript: it is what the note
  -- is called in every list, every search result and every agent's reply.
  UPDATE notes n
     SET title = CASE WHEN length(v_line) > 72 THEN left(v_line, 71) || U&'\2026'
                      ELSE v_line END,
         title_source = 'inferred'
   WHERE n.id = v_note_id
     AND v_line IS NOT NULL
     AND coalesce(p_coverage, 1) >= 1
     AND coalesce(n.title, '') = ''
     AND n.title_source IS DISTINCT FROM 'user';
END
$$;

REVOKE ALL ON FUNCTION app_store_transcript(uuid, text, text, real, real) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_store_transcript(uuid, text, text, real, real) TO jotdojo_app;
