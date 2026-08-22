/**
 * Shared spaces: invites, roles, and the boundary they cross.
 *
 * The property that matters is that joining is the ONLY thing an outsider can
 * do, and only with a token that was sent to them. Everything else about a
 * space they are not in must be invisible or refused.
 *
 * Every refusal asserts a CODE, not merely that something threw. ADR-020.
 */
import {
  upsertUserFromGoogle, asUser, createNote, listNotes,
  createSpace, inviteToSpace, acceptInvite, listMembers, listInvites,
  revokeInvite, setMemberRole, removeMember, listSpaces,
} from "../src/index";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

async function refused(label: string, code: string, fn: () => Promise<unknown>) {
  let got = "nothing was thrown";
  try {
    await fn();
  } catch (err) {
    got = (err as { code?: string }).code ?? `an error with no code: ${(err as Error).message}`;
  }
  check(label, got === code, `expected code "${code}", got "${got}"`);
}

const stamp = Date.now();
const mk = async (tag: string, name: string) => {
  const u = await upsertUserFromGoogle({
    googleSub: `mem-${tag}-${stamp}`, email: `mem-${tag}-${stamp}@example.test`, displayName: name,
  });
  return { actor: asUser(u.id), email: `mem-${tag}-${stamp}@example.test`, id: u.id };
};

const owner = await mk("own", "Owner");
const invitee = await mk("inv", "Invitee");
const stranger = await mk("str", "Stranger");

console.log("\ncreating a shared space");
const spaceId = await createSpace(owner.actor, "The Family", "family");
check("a family space is created", typeof spaceId === "string" && spaceId.length > 0);
const ownerSpaces = await listSpaces(owner.actor);
check("the creator is in it", ownerSpaces.some((s) => s.id === spaceId));
check("...as owner", ownerSpaces.find((s) => s.id === spaceId)?.role === "owner");
check("a stranger cannot see it",
  !(await listSpaces(stranger.actor)).some((s) => s.id === spaceId));
await refused("a personal space cannot be created this way", "23514",
  () => createSpace(owner.actor, "Nope", "personal" as "family"));

console.log("\nwho may invite");
await refused("a stranger cannot invite into it", "forbidden",
  () => inviteToSpace(stranger.actor, spaceId, "someone@example.test"));
await refused("an invite needs an email address", "invalid_email",
  () => inviteToSpace(owner.actor, spaceId, "not-an-address"));

const invite = await inviteToSpace(owner.actor, spaceId, invitee.email);
check("the owner can invite", invite.token.startsWith("jd_inv_"));
check("the token is opaque", invite.token.length > 24);
check("it expires", invite.expiresAt.getTime() > Date.now());

console.log("\nwhat an outsider can see before accepting");
check("the invitee still cannot see the space",
  !(await listSpaces(invitee.actor)).some((s) => s.id === spaceId));
await refused("...and cannot list its members", "forbidden",
  () => listMembers(invitee.actor, spaceId));

console.log("\nthe invite is bound to the address it was sent to");
await refused("a wrong token is refused", "invite_unknown",
  () => acceptInvite(invitee.actor, "jd_inv_not-a-real-token"));
await refused("a forwarded link does not work for someone else", "invite_wrong_account",
  () => acceptInvite(stranger.actor, invite.token));

console.log("\naccepting");
const joined = await acceptInvite(invitee.actor, invite.token);
check("accepting returns the space", joined === spaceId);
check("the invitee is now in it",
  (await listSpaces(invitee.actor)).some((s) => s.id === spaceId));
check("...as a member, not an owner",
  (await listSpaces(invitee.actor)).find((s) => s.id === spaceId)?.role === "member");
await refused("the token cannot be used twice", "invite_used",
  () => acceptInvite(invitee.actor, invite.token));

console.log("\nwhat membership actually grants");
const note = await createNote(owner.actor, spaceId, "the shared grocery list");
const seen = await listNotes(invitee.actor, spaceId);
check("a member reads notes in the space", seen.some((n) => n.id === note.id));
check("a stranger still reads nothing",
  !(await listNotes(stranger.actor, spaceId).catch(() => [])).some((n) => n.id === note.id));

const members = await listMembers(owner.actor, spaceId);
check("both people are listed", members.length === 2);
check("the member can list members too",
  (await listMembers(invitee.actor, spaceId)).length === 2);

console.log("\nrevoking an invite");
const second = await inviteToSpace(owner.actor, spaceId, stranger.email);
await revokeInvite(owner.actor, second.inviteId);
await refused("a revoked invite is refused", "invite_revoked",
  () => acceptInvite(stranger.actor, second.token));
check("it is still listed, as revoked",
  (await listInvites(owner.actor, spaceId)).some((i) => i.id === second.inviteId && i.revokedAt));

console.log("\nroles");
await refused("a member cannot promote themselves", "forbidden",
  () => setMemberRole(invitee.actor, spaceId, invitee.id, "owner"));
await setMemberRole(owner.actor, spaceId, invitee.id, "owner");
check("an owner can promote",
  (await listSpaces(invitee.actor)).find((s) => s.id === spaceId)?.role === "owner");

console.log("\na space always keeps an owner");
await removeMember(owner.actor, spaceId, owner.id);
check("one owner may leave while another remains",
  !(await listSpaces(owner.actor)).some((s) => s.id === spaceId));
await refused("the LAST owner cannot leave", "23514",
  () => removeMember(invitee.actor, spaceId, invitee.id));
await refused("...nor demote themselves", "23514",
  () => setMemberRole(invitee.actor, spaceId, invitee.id, "member"));

console.log(failures === 0
  ? "\nmembers smoke: all checks passed"
  : `\nmembers smoke: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
