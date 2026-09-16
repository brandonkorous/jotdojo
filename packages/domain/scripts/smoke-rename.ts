/**
 * Renaming a space. Issue 003.
 *
 * The interesting checks are the refusals: a member who is not the owner, a
 * blank name, and a space somebody is not in at all.
 */
import {
  upsertUserFromGoogle, asUser, defaultSpaceId, listSpaces, renameSpace,
  DomainError, MAX_SPACE_NAME,
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
const owner = await upsertUserFromGoogle({
  googleSub: `rename-${stamp}`, email: `rename-${stamp}@example.test`, displayName: "O",
});
const A = asUser(owner.id);
const space = await defaultSpaceId(A);

const named = await listSpaces(A);
check("a new space starts as Personal", named[0]?.name === "Personal", `got ${named[0]?.name}`);

check("the owner can rename it", (await renameSpace(A, space, "The Okonkwo house")) === "The Okonkwo house");
check("...and the dashboard sees the new name",
  (await listSpaces(A))[0]?.name === "The Okonkwo house");

check("whitespace is tidied, not stored",
  (await renameSpace(A, space, "  Ilé  Ifẹ̀   notes ")) === "Ilé Ifẹ̀ notes");
check("an accent survives the round trip",
  (await listSpaces(A))[0]?.name === "Ilé Ifẹ̀ notes");

const long = "x".repeat(MAX_SPACE_NAME + 40);
check("a very long name is cut to the limit rather than refused",
  (await renameSpace(A, space, long)).length === MAX_SPACE_NAME);

check("a blank name is refused", await refused(() => renameSpace(A, space, "   ")));
check("...and the old name survives the refusal",
  (await listSpaces(A))[0]?.name.length === MAX_SPACE_NAME);

// Somebody else's space. RLS scopes the row and assertOwner scopes the role;
// this proves a stranger gets nothing either way.
const stranger = await upsertUserFromGoogle({
  googleSub: `rename-s-${stamp}`, email: `rename-s-${stamp}@example.test`, displayName: "S",
});
const B = asUser(stranger.id);
check("a stranger cannot rename a space they are not in",
  await refused(() => renameSpace(B, space, "mine now")));
check("...and it is untouched", (await listSpaces(A))[0]?.name.length === MAX_SPACE_NAME);

console.log(failures === 0 ? "\nrename: all good\n" : `\nrename: ${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
