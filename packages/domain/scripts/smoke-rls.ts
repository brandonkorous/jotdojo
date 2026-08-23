/**
 * Proves the tenancy boundary rather than assuming it.
 *
 * RLS is the control that turns an application-layer bug into an error instead
 * of a data leak (docs/13-security-and-privacy.md). A policy that is enabled
 * but wrong looks exactly like one that is right until someone checks, so this
 * checks: two users, two spaces, and every cross-space read must come back
 * empty or refused.
 */
import { sql } from "drizzle-orm";
import { withoutActor, checkNotOwner } from "@jotacular/db";
import {
  upsertUserFromGoogle, asUser, createNote, getNote, listNotes, searchNotes,
  defaultSpaceId, listSpaces,
} from "../src/index";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const stamp = Date.now();
const alice = await upsertUserFromGoogle({
  googleSub: `smoke-alice-${stamp}`, email: `alice-${stamp}@example.test`, displayName: "Alice",
});
const bob = await upsertUserFromGoogle({
  googleSub: `smoke-bob-${stamp}`, email: `bob-${stamp}@example.test`, displayName: "Bob",
});

const A = asUser(alice.id);
const B = asUser(bob.id);

const aSpace = await defaultSpaceId(A);
const bSpace = await defaultSpaceId(B);

check("each user gets their own personal space", aSpace !== bSpace);

const aNote = await createNote(A, aSpace, "alice private: the vet is on Tuesday");

check("alice reads her own note", (await getNote(A, aNote.id)).body.includes("vet"));

let bobBlocked = false;
try {
  await getNote(B, aNote.id);
} catch {
  bobBlocked = true;
}
check("bob CANNOT read alice's note by id", bobBlocked);

check("bob's note list is empty", (await listNotes(B, bSpace)).length === 0);

let crossSpaceBlocked = false;
try {
  await listNotes(B, aSpace);
  crossSpaceBlocked = (await listNotes(B, aSpace)).length === 0;
} catch {
  crossSpaceBlocked = true;
}
check("bob CANNOT list alice's space", crossSpaceBlocked);

let writeBlocked = false;
try {
  await createNote(B, aSpace, "bob should not be able to write here");
} catch {
  writeBlocked = true;
}
check("bob CANNOT write into alice's space", writeBlocked);

check("alice sees exactly one space", (await listSpaces(A)).length === 1);
check("search finds alice's own note",
  (await searchNotes(A, aSpace, "vet")).length === 1);
// Refused rather than empty, since M1. RLS would return nothing either way;
// the refusal is what makes "not a member" distinguishable from "no results"
// in a log. Asserting on the error type, not just that something threw --
// otherwise a SQL crash would pass this check (ADR-020).
let searchRefused = false;
try {
  await searchNotes(B, aSpace, "vet");
} catch (err) {
  searchRefused = (err as { code?: string }).code === "forbidden";
}
check("search does NOT reach across spaces", searchRefused);

/**
 * The account tables must NOT be FORCE, and the content tables must be.
 *
 * A schema assertion rather than a behavioural one, because the behaviour
 * cannot be reproduced here: a developer's admin URL is `postgres`, a
 * superuser, and superusers bypass RLS unconditionally -- FORCE included. That
 * is exactly how account creation shipped broken. Production's owner is an
 * ordinary role, so FORCE stopped the one SECURITY DEFINER function that is
 * allowed to create accounts, every sign-in died as an opaque Auth.js
 * configuration error, and the users table sat at zero rows while every suite
 * here was green. ADR-057.
 */
console.log("\nthe owner exemption the one door depends on");

const forced = await withoutActor(async (tx) => tx.execute(sql`
  SELECT relname, relrowsecurity, relforcerowsecurity
    FROM pg_class
   WHERE relname IN ('users', 'spaces', 'space_members', 'notes', 'blocks')
`)) as unknown as Array<{
  relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean;
}>;

const flag = (name: string) => forced.find((r) => r.relname === name);

for (const name of ["users", "spaces", "space_members", "notes", "blocks"]) {
  check(`${name} has RLS enabled`, flag(name)?.relrowsecurity === true);
}

/**
 * NO table a SECURITY DEFINER function TOUCHES may be FORCE.
 *
 * Derived from the catalogue rather than a hand-kept list, because the first
 * version of this fix WAS a hand-kept list of three tables and there were
 * sixteen. A definer function runs as the table owner and FORCE is precisely
 * the flag that strips the owner's exemption, so the two are simply
 * incompatible -- and the failure is silent wherever the table's policy is
 * keyed on app_actor_id(): no actor, no matching rows, zero rows affected,
 * no error. ADR-057.
 *
 * TOUCHES, NOT WRITES, and the widening cost months of production recognition.
 * This matched `insert into|update|delete from <table>` for two migrations,
 * which meant a definer function that merely SELECTS a FORCE table was
 * invisible to it. `app_claim_recognize_jobs` JOINS media_assets to ask whether
 * a block still has anything on it; the join matched nothing, so every page
 * looked erased, every job was completed as "nothing to read", and not one line
 * anywhere said so. ADR-071.
 *
 * A read is not the lesser case. It is the one that fails quietly.
 */
const offenders = await withoutActor(async (tx) => tx.execute(sql`
  SELECT DISTINCT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.prosecdef
                  AND p.pronamespace = n.oid
                  -- ANY reference: the bare table name anywhere in the body.
                  -- Deliberately broad. A false positive costs a comment saying
                  -- why a table is exempt; a false negative costs a feature that
                  -- reports success while doing nothing at all.
                  AND p.prosrc ~* ('\\m' || c.relname || '\\M')
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'
     AND c.relforcerowsecurity
   ORDER BY c.relname
`)) as unknown as Array<{ relname: string }>;

check("no table a SECURITY DEFINER function TOUCHES is FORCE",
  offenders.length === 0,
  offenders.map((r) => r.relname).join(", "));

// The protection FORCE was reaching for, done directly. A table owner is
// exempt from RLS, so the application must never be one.
const ownership = await checkNotOwner();
check(`the app connects as a non-owner (${ownership.role})`,
  ownership.ok, `owns ${ownership.owns.join(", ")}`);

console.log(failures === 0 ? "\nRLS smoke: all checks passed" : `\nRLS smoke: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
