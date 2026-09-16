/**
 * Putting a second person in a space. Issue 001.
 *
 * Every function here already existed; what did not exist was any caller. This
 * walks the whole path an owner and a guest actually take.
 */
import {
  upsertUserFromGoogle, asUser, createSpace, inviteToSpace, acceptInvite,
  listMembers, listInvites, revokeInvite, removeMember, spaceSeats,
  listSpaces, createNote, listNotes, applyBillingEvent, DomainError,
} from "../src/index";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};
const why = async (fn: () => Promise<unknown>) => {
  try { await fn(); return null; } catch (err) {
    if (err instanceof DomainError) return err.code;
    throw err;
  }
};

const stamp = Date.now();
// upsertUserFromGoogle returns { id, isNew } and not the address, so the
// address is kept here -- an invite is sent TO one, so the test needs it.
const mk = async (who: string) => {
  const email = `inv-${who.toLowerCase()}-${stamp}@example.test`;
  const { id } = await upsertUserFromGoogle({
    googleSub: `inv-${who}-${stamp}`, email, displayName: who,
  });
  return { id, email };
};

const ownerUser = await mk("Marisol");
const O = asUser(ownerUser.id);
const guestUser = await mk("Tolu");
const G = asUser(guestUser.id);

const house = await createSpace(O, "The Okonkwo house", "family");
check("an owner can make a space to share", typeof house === "string" && house.length > 0);
check("...and is in it as its owner",
  (await listMembers(O, house)).some((m) => m.userId === ownerUser.id && m.role === "owner"));
// A NEW family space is on the free plan, which seats one. So "make a space to
// share" does not yet mean "share it" -- the plan is what buys the seats, and
// this is the shape issue 032 is about.
check("a new family space seats ONE until it is paid for",
  (await spaceSeats(O, house)).seats === 1);

await applyBillingEvent({
  kind: "subscription",
  spaceId: house,
  subscription: {
    customerId: `cus_inv_${stamp}`, subscriptionId: `sub_inv_${stamp}`,
    plan: "family", status: "active",
    currentPeriodEnd: new Date(Date.now() + 30 * 864e5),
  },
}, "smoke");
check("...and six once it is", (await spaceSeats(O, house)).seats === 6);

check("a guest cannot see it yet", !(await listSpaces(G)).some((s) => s.id === house));

const { token } = await inviteToSpace(O, house, guestUser.email);
check("the invite hands back a token, which IS the link",
  typeof token === "string" && token.length > 20);
check("...and shows up as pending, so it can be taken back",
  (await listInvites(O, house)).some((i) => i.email === guestUser.email && !i.acceptedAt));

check("a stranger's token is refused", await why(() => acceptInvite(G, "not-a-real-token")) === "invite_unknown");

await acceptInvite(G, token);
check("the guest is in the space", (await listSpaces(G)).some((s) => s.id === house));
check("...and the owner sees them", (await listMembers(O, house)).length === 2);
check("...and a seat is spent", (await spaceSeats(O, house)).taken === 2);
check("the same link cannot be used twice", await why(() => acceptInvite(G, token)) === "invite_used");

// Two spaces both called Personal render identically to a guest. Issue 052.
const guestSees = await listSpaces(G);
check("a space the guest was let into says whose it is",
  guestSees.find((s) => s.id === house)?.ownedBy === "Marisol");
check("...and their own says nothing, because there is nobody to name",
  guestSees.filter((s) => s.id !== house).every((s) => s.ownedBy === null));
check("the owner is told about none of their own",
  (await listSpaces(O)).every((s) => s.ownedBy === null));

// The point of a shared space: both people see the same notes.
const note = await createNote(O, house, "Pallet count is 40, not 38");
check("the guest can read what the owner wrote",
  (await listNotes(G, house)).some((n) => n.id === note.id));

const spareUser = await mk("Spare");
const S = asUser(spareUser.id);
const second = await inviteToSpace(O, house, spareUser.email);
await revokeInvite(O, second.inviteId);
check("a revoked invite cannot be used",
  (await why(() => acceptInvite(S, second.token))) === "invite_revoked");

await removeMember(O, house, guestUser.id);
check("taking somebody out removes their access",
  !(await listSpaces(G)).some((s) => s.id === house));
check("...and the note is still the owner's",
  (await listNotes(O, house)).some((n) => n.id === note.id));

console.log(failures === 0 ? "\ninvite: all good\n" : `\ninvite: ${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
