-- A comment can be about one THING on the page, not only about the page. ADR-107.
--
-- A canvas holds five unrelated notes as often as it holds one thought, so
-- "there are three comments on this note" is an answer to a question nobody
-- asked. What people want to know is which of the five is the one being talked
-- about, and the only way to say that is to name it.

-- The id of an object inside the note's ink document: a text box, a
-- photograph, or a stroke. NULL means the comment is about the page as a whole,
-- which is every comment written before this migration ran.
ALTER TABLE comments ADD COLUMN anchor_id text;

-- text, not uuid, and deliberately. Stroke ids are minted by clients and
-- validateStrokes (packages/domain/src/ink-doc.ts) promises only a short
-- string -- a uuid column would refuse a page written by a client that chose
-- something else, and refuse it at the moment somebody tried to say something
-- about it.
ALTER TABLE comments ADD CONSTRAINT comments_anchor_ck
  CHECK (anchor_id IS NULL OR length(anchor_id) BETWEEN 1 AND 64);

-- The drawer reads every comment on a note and groups them in memory, so this
-- index is not for that. It is for "does this object have anything on it",
-- which the canvas asks once per page and would otherwise answer with a scan.
CREATE INDEX comments_anchor_idx ON comments (note_id, anchor_id)
  WHERE anchor_id IS NOT NULL;

COMMENT ON COLUMN comments.anchor_id IS
  'An object in the note''s ink document, or NULL for the page as a whole. '
  'Not a foreign key: the objects live inside a jsonb document, and one that '
  'is erased leaves its comments behind on purpose -- see ADR-107.';
