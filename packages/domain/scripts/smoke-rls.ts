/**
 * Proves the tenancy boundary rather than assuming it.
 *
 * RLS is the control that turns an application-layer bug into an error instead
 * of a data leak (docs/13-security-and-privacy.md). A policy that is enabled
 * but wrong looks exactly like one that is right until someone checks, so this
 * checks: two users, two spaces, and every cross-space read must come back
 * empty or refused.
 */
import {
  upsertUserFromGoogle, asUser, createNote, getNote, listNotes, searchNotes,
  defaultSpaceId, listSpaces,
} from "../src/index";

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}`);
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

console.log(failures === 0 ? "\nRLS smoke: all checks passed" : `\nRLS smoke: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
