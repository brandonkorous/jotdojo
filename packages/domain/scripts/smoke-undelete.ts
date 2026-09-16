/**
 * Throwing a note away, and getting it back. Issue 013.
 *
 * The promise under test is docs/13's: a deleted note is kept 30 days. A delete
 * nobody can undo inside that window is a policy written down and not kept.
 */
import {
  upsertUserFromGoogle, asUser, defaultSpaceId, createNote, listNotes, getNote,
  deleteNote, restoreNote, listDeletedNotes, DELETED_DAYS, DomainError,
} from "../src/index";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};
const refused = async (fn: () => Promise<unknown>) => {
  try { await fn(); return false; } catch (err) {
    if (err instanceof DomainError) return true;
    console.log(`        (crashed rather than refused: ${(err as Error).message})`);
    return false;
  }
};

const stamp = Date.now();
const user = await upsertUserFromGoogle({
  googleSub: `undel-${stamp}`, email: `undel-${stamp}@example.test`, displayName: "U",
});
const A = asUser(user.id);
const space = await defaultSpaceId(A);

check("the window is the thirty days the policy promises", DELETED_DAYS === 30);

const keep = await createNote(A, space, "Ring the vet about Biscuit's booster");
const oops = await createNote(A, space, "asdf");
check("both notes are in the list", (await listNotes(A, space)).length === 2);
check("nothing is in the bin yet", (await listDeletedNotes(A, space)).length === 0);

await deleteNote(A, oops.id);
check("a deleted note leaves the list", (await listNotes(A, space)).length === 1);
check("...and the one she meant to keep is still there",
  (await listNotes(A, space))[0]?.id === keep.id);
check("...and it is in the bin, with its words so she can tell which it was",
  (await listDeletedNotes(A, space)).some((n) => n.id === oops.id && n.preview.includes("asdf")));

// Nothing in jotacular is destroyed -- the row is still there and still hers.
check("the note itself is not reachable while deleted", await refused(() => getNote(A, oops.id)));

await restoreNote(A, oops.id);
check("restoring puts it back in the list", (await listNotes(A, space)).length === 2);
check("...and takes it out of the bin", (await listDeletedNotes(A, space)).length === 0);
check("...and it opens again", (await getNote(A, oops.id)).id === oops.id);

check("restoring a note that was never deleted is refused",
  await refused(() => restoreNote(A, keep.id)));

// A stranger gets nothing, either way round.
const stranger = await upsertUserFromGoogle({
  googleSub: `undel-s-${stamp}`, email: `undel-s-${stamp}@example.test`, displayName: "S",
});
const B = asUser(stranger.id);
await deleteNote(A, oops.id);
// RLS answers this, not a thrown error, and empty is the better answer: it
// does not tell a stranger whether the space exists. Same shape as listNotes.
const strangersView = await listDeletedNotes(B, space);
check("a stranger's view of somebody else's bin is EMPTY, not an error",
  strangersView.length === 0, `saw ${strangersView.length}`);
check("...nor restore out of it", await refused(() => restoreNote(B, oops.id)));
check("...and it is still in the owner's bin", (await listDeletedNotes(A, space)).length === 1);

console.log(failures === 0 ? "\nundelete: all good\n" : `\nundelete: ${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
