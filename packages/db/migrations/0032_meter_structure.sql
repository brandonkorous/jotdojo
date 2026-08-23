-- Metering a structural pass as its own kind. ADR-066.
--
-- Split from 0031 rather than appended to it, because 0031 had already been
-- applied here: editing a migration that has run means the change never
-- executes on THIS database and does execute on every fresh one, which is a
-- divergence that shows up as "works in CI, broken locally" and takes an
-- afternoon to find. A migration is a record of what ran.
--
-- An ink block read for STRUCTURE is metered as 'structure', not as 'ink'.
-- Without the distinction one page read twice looks like two pages, and the
-- allowance in docs/01 is counted in pages.
--
-- OVERLOADED rather than replaced, so every existing caller keeps working and
-- goes on meaning exactly what it meant.
CREATE OR REPLACE FUNCTION app_record_recognition(
  p_block_id uuid,
  p_units    integer,
  p_kind     text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO recognition_usage (space_id, block_id, kind, units)
  SELECT b.space_id, b.id, coalesce(p_kind, b.kind), GREATEST(p_units, 1)
    FROM blocks b WHERE b.id = p_block_id;
END;
$$;

REVOKE ALL ON FUNCTION app_record_recognition(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_record_recognition(uuid, integer, text) TO jotdojo_app;
