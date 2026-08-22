-- Typo tolerance, which is the one thing a dedicated search engine would have
-- bought us that Postgres does not give away for free.
--
-- `websearch_to_tsquery` is exact after stemming: search "kubernets" and you
-- get nothing, because the lexeme does not match. Trigram similarity does not
-- care about spelling, so it catches the misspelling, the half-remembered
-- name, and the thing you typed one-handed on a phone.
--
-- This is the third leg of retrieval. Lexical finds the words you used,
-- semantic finds the meaning you meant, trigram finds the word you meant to
-- type. All three are fused with reciprocal rank fusion in the domain layer --
-- see packages/domain/src/search.ts. ADR-023.

-- pg_trgm is already installed in 0000. GIN over the same coalesce() the
-- tsvector column uses, so lexical and fuzzy see identical text.
CREATE INDEX IF NOT EXISTS blocks_trgm_idx
  ON blocks USING GIN ((coalesce(body, transcript, '')) gin_trgm_ops);

-- Titles are short and get typed at from the command palette constantly.
CREATE INDEX IF NOT EXISTS notes_title_trgm_idx
  ON notes USING GIN (coalesce(title, '') gin_trgm_ops);

-- word_similarity() compares the query against the closest *word* in the
-- document rather than the whole document, which is what we want: a 4000
-- character note should not score badly against a two word query just because
-- it is long. The default threshold of 0.6 is too eager for note-taking --
-- it matches on shared prefixes that mean nothing -- so callers pass an
-- explicit threshold rather than relying on the session default.
