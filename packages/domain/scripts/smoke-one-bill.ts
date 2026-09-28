/**
 * One bill, many spaces. Issue 051, ADR-119.
 *
 * Kwabena paid $9 for "up to 6 people", then made the space he actually wanted
 * to share and it arrived free, seating one, with a price list under it. Four
 * things have to be true at once for that not to happen again, and they pull
 * in opposite directions:
 *
 *   1. A NEW SPACE JOINS THE PLAN. Not free, not seating one.
 *   2. READINGS ARE POOLED. They are the cost of goods -- a fresh 2,000 per
 *      room would turn $9 into an unbounded vision bill.
 *   3. SEATS ARE NOT. Seats were never the fence (ADR-112), and a house of six
 *      is the same six people in every room.
 *   4. NOTHING IS ADOPTED BY SURPRISE. A space somebody else owns, or one made
 *      before the card, joins only when somebody says so.
 */
import { fakeBilling } from "@jotacular/billing";
import type { PaidPlan } from "@jotacular/billing";
import {
  upsertUserFromGoogle, asUser, createSpace, createNote, createInkBlock,
  recordRecognition, billingStatus, startCheckout, applyBillingEvent,
  joinBilling, leaveBilling, spaceUsage, spaceSeats,
} from "../src/index";

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

async function refused(label: string, fn: () => Promise<unknown>) {
  let threw = false;
  try { await fn(); } catch { threw = true; }
  check(label, threw, "nothing was thrown");
}

const SECRET = "one-bill-smoke-secret";
const provider = fakeBilling({ webhookSecret: SECRET });
const URLS = { successUrl: "https://app.jotacular.com/ok", cancelUrl: "https://app.jotacular.com/no" };

const stamp = Date.now();
let made = 0;
const mk = async (tag: string) => {
  const id = `bill-${tag}-${made++}-${stamp}`;
  const u = await upsertUserFromGoogle({
    googleSub: id, email: `${id}@example.test`, displayName: tag,
  });
  return asUser(u.id);
};

/** Through the real webhook door, which is the only thing that moves a plan. */
const pay = (spaceId: string, plan: PaidPlan) => applyBillingEvent({
  kind: "subscription",
  spaceId,
  subscription: {
    customerId: `cus_${spaceId}`, subscriptionId: `sub_${spaceId}`,
    plan, status: "active",
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
}, "smoke");

/** Spend units against a space, the way the worker does. */
const spend = async (actor: Awaited<ReturnType<typeof mk>>, spaceId: string, units: number) => {
  const note = await createNote(actor, spaceId, "a page to read");
  const ink = await createInkBlock(actor, note.id, { w: 800, h: 600 });
  await recordRecognition(ink.blockId, units);
};

const kwabena = await mk("kwa");
const stranger = await mk("str");

// ------------------------------------------------------------ act six ------

console.log("\nthe space he made before the card");
const attic = await createSpace(kwabena, "The attic", "family");
check("a space made by somebody who pays nothing starts free",
  (await billingStatus(kwabena, attic)).plan === "free");

console.log("\nhe pays for Family");
const house = await createSpace(kwabena, "The Ballantyne-Osei house", "family");
await pay(house, "family");
check("the space he bought is on family",
  (await billingStatus(kwabena, house)).plan === "family");
check("...and is covered by nothing, because it is the payer",
  (await billingStatus(kwabena, house)).includedIn === null);

console.log("\nthen he makes the space he actually wanted -- act 6");
const boiler = await createSpace(kwabena, "The boiler cupboard", "family");
const cover = await billingStatus(kwabena, boiler);
check("it arrives on family, not free", cover.plan === "family", cover.plan);
check("...and says which space pays for it",
  cover.includedIn?.spaceId === house, JSON.stringify(cover.includedIn));
check("...by name, because an id is not a place anybody recognises",
  cover.includedIn?.name === "The Ballantyne-Osei house");

const boilerSeats = await spaceSeats(kwabena, boiler);
check("it seats six, which is the bug", boilerSeats.seats === 6, String(boilerSeats.seats));
check("...with five of them free", boilerSeats.left === 5, String(boilerSeats.left));

const boilerUse = await spaceUsage(kwabena, boiler);
check("its allowance is the family one", boilerUse.allowance === 2000, String(boilerUse.allowance));

// ------------------------------------------------------------- pooled ------

console.log("\nreadings are pooled and seats are not");
await spend(kwabena, boiler, 7);
check("a reading in the new space counts against the payer",
  (await spaceUsage(kwabena, house)).used === 7,
  String((await spaceUsage(kwabena, house)).used));
check("...and both rooms report the same total",
  (await spaceUsage(kwabena, boiler)).used === 7);

await spend(kwabena, house, 3);
check("a reading in the payer counts too",
  (await spaceUsage(kwabena, boiler)).used === 10,
  String((await spaceUsage(kwabena, boiler)).used));

const solo = await createSpace(stranger, "Not his", "family");
await spend(stranger, solo, 5);
check("somebody else's reading is not in the pool",
  (await spaceUsage(kwabena, house)).used === 10);
check("...and their own space keeps the free allowance",
  (await spaceUsage(stranger, solo)).allowance === 100);

console.log("\nover quota is a group, not a room");
await spend(kwabena, boiler, 2000);
check("spending the allowance in one room puts the payer over",
  (await spaceUsage(kwabena, house)).over === true);
check("...and the other room with it",
  (await spaceUsage(kwabena, boiler)).over === true);
check("somebody else is untouched by it",
  (await spaceUsage(stranger, solo)).over === false);

// -------------------------------------------------------- no second bill ---

console.log("\na covered space cannot grow a bill of its own");
await refused("checkout is refused on a covered space",
  () => startCheckout(provider, kwabena, boiler, "family", URLS));
// The webhook is the OTHER side of the card and must never refuse money that
// has already been taken (migration 0041). Paying for a room separately is
// what makes it pay for itself, so it detaches rather than raising -- on its
// own space, because this one does not go back.
const study = await createSpace(kwabena, "The study", "family");
check("the study starts out riding the house",
  (await billingStatus(kwabena, study)).includedIn?.spaceId === house);
await pay(study, "solo");
const bought = await billingStatus(kwabena, study);
check("...but a subscription that DID arrive detaches it rather than refusing",
  bought.includedIn === null && bought.plan === "solo", JSON.stringify(bought));
check("...and the pool it left no longer counts it",
  (await spaceUsage(kwabena, study)).allowance === 1000);

// ---------------------------------------------------------- joining later --

console.log("\nthe other order: the room came first");
check("the attic was NOT adopted by surprise",
  (await billingStatus(kwabena, attic)).plan === "free");
await joinBilling(kwabena, attic, house);
const joined = await billingStatus(kwabena, attic);
check("adding it on purpose puts it on the plan", joined.plan === "family", joined.plan);
check("...and names the payer", joined.includedIn?.spaceId === house);

await refused("a stranger cannot put their space on his bill",
  () => joinBilling(stranger, solo, house));
await refused("...and he cannot put theirs on it either",
  () => joinBilling(kwabena, solo, house));

console.log("\none hop, never a chain");
const shed = await createSpace(kwabena, "The shed", "family");
check("a later space rides the payer, not another rider",
  (await billingStatus(kwabena, shed)).includedIn?.spaceId === house);

console.log("\nleaving again, because checkout refuses a rider");
await leaveBilling(kwabena, attic);
const left = await billingStatus(kwabena, attic);
check("it is covered by nothing again", left.includedIn === null);
check("...and back on free, where it came from", left.plan === "free", left.plan);

// ------------------------------------------------------------ cancelling ---

console.log("\ncancelling takes the rooms with the house");
await applyBillingEvent(
  { kind: "canceled", spaceId: house, customerId: `cus_${house}` }, "smoke");
check("the space that was bought falls to free",
  (await billingStatus(kwabena, house)).plan === "free");
check("...and so does the room riding on it",
  (await billingStatus(kwabena, boiler)).plan === "free");
check("the grouping survives, so paying again covers it",
  (await billingStatus(kwabena, boiler)).includedIn?.spaceId === house);
await pay(house, "team");
check("paying again puts the room back on the plan",
  (await billingStatus(kwabena, boiler)).plan === "team");
check("...at the new plan's allowance",
  (await spaceUsage(kwabena, boiler)).allowance === 10000);

console.log(failures === 0 ? "\nall green\n" : `\n${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
