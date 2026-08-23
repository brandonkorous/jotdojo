-- FORCE breaks a definer function that only READS. ADR-071.
--
-- 0027 found this on three tables. 0028 found it on twelve more and wrote the
-- general rule. Both were about WRITES, and both said so:
--
--   "Sixteen tables are written by definer functions. Twelve still had FORCE."
--
-- media_assets was left FORCE on the stated grounds that "no definer function
-- writes to them -- the application does, as jotdojo_app". That sentence is
-- true and it is not the whole rule. `app_claim_recognize_jobs` is SECURITY
-- DEFINER and does not write to media_assets: it JOINS it, twice, to answer
-- "does this block still have anything on it worth reading".
--
-- FORCE strips the owner's exemption for SELECT exactly as thoroughly as for
-- UPDATE. So the join matched nothing, and the function's own guard --
--
--   NOT EXISTS (SELECT 1 FROM blocks b JOIN media_assets a ON a.id = b.artifact_id
--                WHERE ... jsonb_array_length(a.strokes -> 'strokes') > 0)
--
-- -- was TRUE for every job. The comment above that clause says what it thought
-- it was doing: "Nothing to read. Per kind: an ink page erased back to empty."
-- Every page in the product looked erased.
--
-- WHAT THAT ACTUALLY DID, in production, for as long as recognition was
-- configured: each job was marked completed with NO ERROR, the claim returned
-- zero rows, the worker logged nothing because it logs only when it claims
-- something, and every block stayed at transcript_state 'pending' forever.
-- Not one line anywhere said a word. Handwriting was never read, and the only
-- visible symptom was a spinner that never resolved.
--
-- It could not be seen from a laptop, either: a developer's admin URL is
-- `postgres`, a superuser, and superusers bypass RLS unconditionally -- FORCE
-- included. Exactly as ADR-057 warned, in the same shape, one verb over.

ALTER TABLE media_assets NO FORCE ROW LEVEL SECURITY;

COMMENT ON TABLE media_assets IS
  'READ by app_claim_recognize_jobs, which is SECURITY DEFINER. Must never be '
  'set FORCE ROW LEVEL SECURITY -- a definer function cannot see a FORCE table '
  'at all, and the failure is silent. See 0033, ADR-071, ADR-057.';

-- WHAT DEFENDS THE BOUNDARY IS UNCHANGED, and it is not this flag.
-- `assertNotOwner()` refuses at startup if DATABASE_URL connects as a role that
-- owns these tables, and smoke-rls asserts the same. FORCE was never what stood
-- between a misconfigured URL and a tenancy failure; it was only ever a second
-- lock on a door that is already bolted, fitted to a frame the hinges pass
-- through. ADR-057, ADR-071.
--
-- smoke-rls's guard is widened in the same change: it derived offenders from
-- functions whose body matched `insert into|update|delete from <table>`, which
-- is why a definer function that merely SELECTs a FORCE table was invisible to
-- it for two migrations running. It now matches ANY reference.
