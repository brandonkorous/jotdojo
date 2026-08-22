-- A page of handwriting should name itself.
--
-- inferTitle() runs on the TYPED body, so a note that is nothing but ink never
-- got one: createNote sees an empty string, and recognition later fills in a
-- transcript that nothing looks at. The result was a notes list full of
-- untitled rows that each turned out to be a full page of writing.
--
-- The title is derived here rather than in the worker because this is already
-- the one place a transcript lands, and a title that depends on the transcript
-- should be written in the same statement -- otherwise there is a window where
-- the text exists and the name does not, which is exactly the state that was
-- broken before.

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
     SET transcript        = p_transcript,
         transcript_source = p_source,
         confidence        = p_confidence,
         transcript_state  = 'ready'
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
  UPDATE notes n
     SET title = CASE WHEN length(v_line) > 72 THEN left(v_line, 71) || U&'\2026'
                      ELSE v_line END,
         title_source = 'inferred'
   WHERE n.id = v_note_id
     AND v_line IS NOT NULL
     AND coalesce(n.title, '') = ''
     AND n.title_source IS DISTINCT FROM 'user';
END
$$;

REVOKE ALL ON FUNCTION app_store_transcript(uuid, text, text, real) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_store_transcript(uuid, text, text, real) TO jotdojo_app;
