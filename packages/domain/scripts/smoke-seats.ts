/**
 * Seats, counted. ADR-112.
 *
 * Four things would be silently wrong, in the order they cost money:
 *
 *   1. A SPACE THAT IGNORES ITS CAP. The pricing page has sold "up to 6
 *      people" since it shipped and nothing counted, which is the gap docs/12
 *      has listed as open since 2026-08-21.
 *   2. A CAP THAT IS SOMEBODY ELSE'S PROBLEM. If pending invites did not
 *      count, an owner could send six and the sixth person to click a link
 *      would be the one told the space was full.
 *   3. A CAP THAT EJECTS PEOPLE. A space that is already over its number --
 *      because it was downgraded, or because it predates this -- must keep
 *      everybody in it. The cap decides who may JOIN.
 *   4. A CAP THAT REFUSES A RESEND. Re-inviting somebody who is already in the
 *      space is not a new seat.
 */
import {
  upsertUserFromGoogle, asUser, createSpace, inviteToSpace, acceptInvite,
  listMembers, revokeInvite, removeMember, applyBillingEvent, spaceSeats,
} from "../src/index";
import type { PaidPlan } from "@jotacular/billing";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const codeOf = (err: unknown): string | undefined => {
  for (let e: unknown = err, depth = 0; e && depth < 8; depth++) {
    const c = (e as { code?: unknown }).code;
    if (typeof c === "string") return c;
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
};

async function refused(label: string, code: string, fn: () => Promise<unknown>) {
  let got = "nothing was thrown";
  try {
    await fn();
  } catch (err) {
    got = codeOf(err) ?? `an error with no code: ${(err as Error).message}`;
  }
  check(label, got === code, `expected code "${code}", got "${got}"`);
}

const stamp = Date.now();
let made = 0;
const mk = async (name: string) => {
  const tag = `seat-${made++}-${stamp}`;
  const u = await upsertUserFromGoogle({
    googleSub: tag, email: `${tag}@example.test`, displayName: name,
  });
  return { actor: asUser(u.id), email: `${tag}@example.test`, id: u.id };
};

/** Put a space on a plan through the real billing door -- the only thing that
 *  moves `spaces.plan` in production. */
const pay = (spaceId: string, plan: PaidPlan) => applyBillingEvent({
  kind: "subscription",
  spaceId,
  subscription: {
    customerId: `cus_${plan}`, subscriptionId: `sub_${spaceId}`,
    plan, status: "active",
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
}, "smoke");

/** Invite somebody and have them accept, in one step. */
async function join(owner: { actor: ReturnType<typeof asUser> }, spaceId: string) {
  const person = await mk("Joiner");
  const invite = await inviteToSpace(owner.actor, spaceId, person.email);
  await acceptInvite(person.actor, invite.token);
  return person;
}

const owner = await mk("Owner");

console.log("\nwhat each plan holds");
{
  const space = await createSpace(owner.actor, "Counting", "family");
  const free = await spaceSeats(owner.actor, space);
  check("a free space holds one person", free.seats === 1, JSON.stringify(free));
  check("...and that one is taken by its owner", free.taken === 1);
  check("...so there is no room", free.left === 0);

  await pay(space, "family");
  const family = await spaceSeats(owner.actor, space);
  check("family holds six", family.seats === 6, JSON.stringify(family));
  check("...with five to give away", family.left === 5);

  await pay(space, "team");
  const team = await spaceSeats(owner.actor, space);
  check("team holds twenty-five", team.seats === 25, JSON.stringify(team));

  await pay(space, "solo");
  check("solo holds one", (await spaceSeats(owner.actor, space)).seats === 1);
}

console.log("\n(1) the cap is real");
{
  const space = await createSpace(owner.actor, "Full house", "family");
  // A free space is one person, so the FIRST invite is already too many.
  await refused("a free space cannot invite anybody", "space_full",
    () => inviteToSpace(owner.actor, space, "nobody@example.test"));

  await pay(space, "family");
  for (let i = 0; i < 5; i++) await join(owner, space);
  const held = await spaceSeats(owner.actor, space);
  check("six people are in it", held.taken === 6, JSON.stringify(held));
  check("...and nothing is left", held.left === 0);

  await refused("a seventh cannot be invited", "space_full",
    () => inviteToSpace(owner.actor, space, "seventh@example.test"));
  check("...and nobody was added trying",
    (await listMembers(owner.actor, space)).length === 6);
}

console.log("\n(2) a pending invite holds a seat");
{
  const space = await createSpace(owner.actor, "Pending", "family");
  await pay(space, "family");
  // Five invites, none accepted. The sixth seat is the owner's.
  const tokens = [];
  for (let i = 0; i < 5; i++) {
    const person = await mk("Waiting");
    tokens.push({ person, invite: await inviteToSpace(owner.actor, space, person.email) });
  }
  const held = await spaceSeats(owner.actor, space);
  check("the space is full on invites alone", held.left === 0, JSON.stringify(held));
  check("...though only one person is actually in it",
    (await listMembers(owner.actor, space)).length === 1);

  // The limit belongs to the person who set it, not to the sixth person to
  // click a link.
  await refused("a sixth invite is refused", "space_full",
    () => inviteToSpace(owner.actor, space, "late@example.test"));

  // And a revoked one gives the seat back.
  await revokeInvite(owner.actor, tokens[0]!.invite.inviteId);
  check("revoking gives the seat back", (await spaceSeats(owner.actor, space)).left === 1);
  const extra = await inviteToSpace(owner.actor, space, "late@example.test");
  check("...so somebody else can have it", extra.token.startsWith("jd_inv_"));
}

console.log("\n...and the cap bites again at accept time");
{
  const space = await createSpace(owner.actor, "Race", "family");
  await pay(space, "family");
  // Two invites while there is room for two, then the room goes.
  const a = await mk("First");
  const b = await mk("Second");
  const inviteA = await inviteToSpace(owner.actor, space, a.email);
  const inviteB = await inviteToSpace(owner.actor, space, b.email);
  await pay(space, "solo");

  // Both invites were good when they were written. Neither may be used now,
  // and the reason names the SPACE rather than the link.
  await refused("an invite made before a downgrade cannot be used", "space_full",
    () => acceptInvite(a.actor, inviteA.token));
  await refused("...nor the second one", "space_full",
    () => acceptInvite(b.actor, inviteB.token));
  check("nobody joined", (await listMembers(owner.actor, space)).length === 1);
}

console.log("\n(3) a space over its cap keeps everybody");
{
  const space = await createSpace(owner.actor, "Downgraded", "family");
  await pay(space, "family");
  const people = [];
  for (let i = 0; i < 3; i++) people.push(await join(owner, space));
  check("four people are in it", (await listMembers(owner.actor, space)).length === 4);

  // Downgrading does not eject anyone. Nobody loses a space they are in
  // because somebody else's card changed.
  await pay(space, "solo");
  const over = await spaceSeats(owner.actor, space);
  check("the space is over its number", over.left < 0, JSON.stringify(over));
  check("...and everybody is still in it",
    (await listMembers(owner.actor, space)).length === 4);
  await refused("it simply cannot grow", "space_full",
    () => inviteToSpace(owner.actor, space, "more@example.test"));

  // And it recovers by shrinking, not by anybody being thrown out.
  await removeMember(owner.actor, space, people[0]!.id);
  await removeMember(owner.actor, space, people[1]!.id);
  await removeMember(owner.actor, space, people[2]!.id);
  check("once it fits again there is room", (await spaceSeats(owner.actor, space)).left === 0);
}

console.log("\n(4) re-inviting somebody is not a new seat");
{
  const space = await createSpace(owner.actor, "Resend", "family");
  await pay(space, "family");
  const five = [];
  for (let i = 0; i < 5; i++) five.push(await join(owner, space));
  check("the space is full", (await spaceSeats(owner.actor, space)).left === 0);

  // Resending to somebody already in it must work, or a lost invite to the
  // sixth member of a Family could never be sent again.
  const again = await inviteToSpace(owner.actor, space, five[0]!.email);
  check("a member can be invited again", again.token.startsWith("jd_inv_"));
  check("...and accepting is a no-op rather than a refusal",
    (await acceptInvite(five[0]!.actor, again.token)) === space);
  check("nobody was added", (await listMembers(owner.actor, space)).length === 6);
}

console.log(failures === 0 ? "\nseats: all good\n" : `\nseats: ${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
