-- Live updates: a second device sees the page change as it changes. ADR-058.
--
-- Three things the schema was missing, and none of them are the stream itself
-- -- the stream carries ids and is built in the application. What the database
-- has to provide is the ability to say WHAT CHANGED without lying:
--
-- 1. A stroke has no identity, so "delete this one" can only be expressed as
--    "here is the whole page instead" -- which silently discards anything a
--    second device drew while the erase was in flight.
-- 2. A page has no version, so a whole-page write cannot be refused when it is
--    based on a page that has since moved on.
-- 3. Nothing records who is looking at a note, so nobody can be told that
--    somebody else is writing in it before they collide.

-- ------------------------------------------------------- stroke identity ---

-- Backfilled rather than defaulted, because a stroke without an id is exactly
-- the stroke a delta cannot name. Ordinality preserves stroke order, which is
-- paint order -- a highlighter that swaps places with the word under it is a
-- different drawing.
UPDATE media_assets
   SET strokes = jsonb_set(strokes, '{strokes}', (
         SELECT coalesce(jsonb_agg(
                  CASE WHEN s ? 'id' THEN s
                       ELSE s || jsonb_build_object('id', gen_random_uuid()::text) END
                  ORDER BY ord), '[]'::jsonb)
           FROM jsonb_array_elements(strokes -> 'strokes') WITH ORDINALITY AS t(s, ord)
       ))
 WHERE kind = 'ink'
   AND strokes ? 'strokes'
   AND jsonb_array_length(strokes -> 'strokes') > 0;

-- ---------------------------------------------------------- page version ---

-- Bumped by every write to the page, append included. A client sending a
-- whole-page replacement states the version it believed in; a mismatch means
-- somebody else moved the page underneath it and the write is refused rather
-- than applied over the top.
ALTER TABLE media_assets
  ADD COLUMN strokes_version integer NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------- presence --

-- Who has this note open, per device. Deliberately a table and not an
-- in-process map: the web deployment surges to two pods on every rolling
-- update, and presence that disagreed between pods would read as people
-- flickering in and out of a note.
CREATE TABLE note_presence (
  note_id       uuid NOT NULL REFERENCES notes(id)  ON DELETE CASCADE,
  space_id      uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  -- Per device, not per person: the same account on a tablet and a laptop is
  -- the commonest case this feature exists for, and collapsing them would hide
  -- the collision it is meant to warn about.
  device_id     text NOT NULL,
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  -- Set a few seconds ahead while somebody is actually typing or drawing, so
  -- "here" and "writing right now" stay different claims.
  writing_until timestamptz,
  PRIMARY KEY (note_id, user_id, device_id)
);

CREATE INDEX note_presence_seen_idx ON note_presence (last_seen_at);

ALTER TABLE note_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_presence FORCE  ROW LEVEL SECURITY;

-- Members of the space see everyone in the note; nobody writes a row but
-- themselves. Both halves matter: without the first there is no presence, and
-- without the second anybody could claim to be anybody.
CREATE POLICY note_presence_member ON note_presence FOR SELECT
  USING (app_can_reach_space(space_id));

CREATE POLICY note_presence_own_insert ON note_presence FOR INSERT
  WITH CHECK (user_id = app_actor_id() AND app_can_reach_space(space_id));

CREATE POLICY note_presence_own_update ON note_presence FOR UPDATE
  USING (user_id = app_actor_id()) WITH CHECK (user_id = app_actor_id());

CREATE POLICY note_presence_own_delete ON note_presence FOR DELETE
  USING (user_id = app_actor_id());

-- ------------------------------------------------------- the worker's door --

-- Which note a block belongs to, for a caller with no actor.
--
-- The worker stores a reading and then has to say WHICH note changed, and it
-- runs without an actor -- so every policy denies and a plain SELECT returns
-- nothing. Same shape as the other narrow doors in this schema (0003, 0014):
-- one function that answers one question, rather than a widened policy.
CREATE OR REPLACE FUNCTION app_block_note(p_block uuid)
RETURNS TABLE (note_id uuid, space_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT b.note_id, b.space_id FROM blocks b WHERE b.id = p_block
$$;

REVOKE ALL ON FUNCTION app_block_note(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_block_note(uuid) TO jotdojo_app;
