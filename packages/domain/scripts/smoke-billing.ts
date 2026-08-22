/**
 * Billing, per space. ADR-038.
 *
 * Two things are actually under test. First the SIGNATURE CONTRACT, because a
 * webhook endpoint that accepts unsigned bodies is a public API for granting
 * yourself a paid plan. Second the ENTITLEMENT RULE: what a space is allowed
 * (`spaces.plan`, which metering reads) versus what was bought, and the cases
 * where those two must differ.
 *
 * Runs against BILLING_PROVIDER=fake, which takes no money -- but which
 * enforces the same signature contract as Stripe, deliberately, so the suite
 * cannot pass against a driver that skips the one check worth making.
 */
import { fakeBilling, signFake, BillingError } from "@jotdojo/billing";
import {
  upsertUserFromGoogle, asUser, createSpace, inviteToSpace, acceptInvite,
  billingStatus, startCheckout, billingPortal, applyBillingEvent, spaceUsage,
  defaultSpaceId,
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

const threw = (fn: () => unknown): string => {
  try { fn(); return "nothing was thrown"; } catch (e) { return (e as Error).message; }
};

const SECRET = "billing-smoke-secret";
const provider = fakeBilling({ webhookSecret: SECRET });
const URLS = { successUrl: "https://app.jotdojo.com/ok", cancelUrl: "https://app.jotdojo.com/no" };

const stamp = Date.now();
const mk = async (tag: string) => {
  const u = await upsertUserFromGoogle({
    googleSub: `bil-${tag}-${stamp}`, email: `bil-${tag}-${stamp}@example.test`, displayName: tag,
  });
  return { actor: asUser(u.id), email: `bil-${tag}-${stamp}@example.test`, id: u.id };
};

const owner = await mk("own");
const member = await mk("mem");
const space = await createSpace(owner.actor, "Paying Family", "family");
const invite = await inviteToSpace(owner.actor, space, member.email);
await acceptInvite(member.actor, invite.token);

console.log("\nbefore anyone pays");
const initial = await billingStatus(owner.actor, space);
check("the space is on free", initial.plan === "free");
check("nothing has been purchased", initial.purchasedPlan === null);
check("free is a real allowance, not zero", (await spaceUsage(owner.actor, space)).allowance >= 100);

console.log("\nwho may buy");
await refused("a member cannot start a checkout", "forbidden",
  () => startCheckout(provider, member.actor, space, "family", URLS));
await refused("a member cannot read the billing state", "forbidden",
  () => billingStatus(member.actor, space));
await refused("...nor open the portal", "forbidden",
  () => billingPortal(provider, member.actor, space, "https://app.jotdojo.com"));
await refused("with no provider configured, checkout is refused cleanly", "forbidden",
  () => startCheckout(null, owner.actor, space, "family", URLS));
await refused("a space that never paid has no portal", "not_found",
  () => billingPortal(provider, owner.actor, space, "https://app.jotdojo.com"));

const session = await startCheckout(provider, owner.actor, space, "family", URLS);
check("an owner gets a checkout url", session.url.includes("checkout"));
check("...carrying the space, so the webhook needs no browser to tell it",
  session.url.includes(space));

console.log("\nthe signature contract");
const body = JSON.stringify({
  type: "subscription", spaceId: space, plan: "family", status: "active",
  customerId: "cus_smoke", subscriptionId: "sub_smoke",
});
check("an unsigned webhook is refused",
  threw(() => provider.verify(body, null)).includes("no signature"));
check("a forged signature is refused",
  threw(() => provider.verify(body, "t=" + Math.floor(Date.now() / 1000) + ",v1=deadbeef"))
    .includes("does not match"));
check("a signature for DIFFERENT bytes is refused",
  threw(() => provider.verify(body, signFake(SECRET, JSON.stringify({ tampered: true }))))
    .includes("does not match"));
const old = new Date(Date.now() - 40 * 60 * 1000);
check("a replayed old webhook is refused",
  threw(() => provider.verify(body, signFake(SECRET, body, old))).includes("too old"));
check("the wrong secret is refused",
  threw(() => provider.verify(body, signFake("not-the-secret", body))).includes("does not match"));
check("a correctly signed webhook verifies",
  provider.verify(body, signFake(SECRET, body)).kind === "subscription");

console.log("\nwhat a payment grants");
await applyBillingEvent(provider.verify(body, signFake(SECRET, body)), provider.name);
const paid = await billingStatus(owner.actor, space);
check("the space is on family", paid.plan === "family");
check("...and it is recorded as bought", paid.purchasedPlan === "family");
check("...as active", paid.status === "active");
const allowance = await spaceUsage(owner.actor, space);
check("the allowance went up immediately", allowance.allowance > 100, String(allowance.allowance));
check("a member sees the new allowance too",
  (await spaceUsage(member.actor, space)).allowance === allowance.allowance);

console.log("\nan owner can now reach the portal");
const portal = await billingPortal(provider, owner.actor, space, "https://app.jotdojo.com");
check("the portal url carries the customer", portal.url.includes("cus_smoke"));

console.log("\na failing card does not take the plan away");
const late = JSON.stringify({
  type: "subscription", spaceId: space, plan: "family", status: "past_due",
  customerId: "cus_smoke", subscriptionId: "sub_smoke",
});
await applyBillingEvent(provider.verify(late, signFake(SECRET, late)), provider.name);
const duePast = await billingStatus(owner.actor, space);
check("past_due is recorded", duePast.status === "past_due");
check("...but the space KEEPS family", duePast.plan === "family",
  "a failed card is a conversation, not a mid-month downgrade");

console.log("\nevents we do not act on");
const junk = JSON.stringify({ type: "invoice.whatever", spaceId: space });
const ignored = await applyBillingEvent(provider.verify(junk, signFake(SECRET, junk)), provider.name);
check("an unrelated event is ignored, not applied", ignored.applied === false);
const unknownPlan = JSON.stringify({ type: "subscription", spaceId: space, plan: "enterprise" });
check("a plan we do not sell is ignored",
  provider.verify(unknownPlan, signFake(SECRET, unknownPlan)).kind === "ignored");
check("...and the space is untouched",
  (await billingStatus(owner.actor, space)).plan === "family");

console.log("\nsolo is a real plan");
// Bought on the person's own space, not on a family they had to invent. The
// pricing doc has listed Solo since M0; the schema only learned it in 0020.
const mine = await defaultSpaceId(owner.actor);
const soloBody = JSON.stringify({
  type: "subscription", spaceId: mine, plan: "solo", status: "active",
  customerId: "cus_solo", subscriptionId: "sub_solo",
});
await applyBillingEvent(provider.verify(soloBody, signFake(SECRET, soloBody)), provider.name);
const solo = await billingStatus(owner.actor, mine);
check("one person can buy Solo without buying Family", solo.plan === "solo", solo.plan);
const soloUse = await spaceUsage(owner.actor, mine);
check("...which allows more than free", soloUse.allowance > 100, String(soloUse.allowance));
check("...and less than family, which is Solo pooled",
  soloUse.allowance < 2000, String(soloUse.allowance));

console.log("\ncancelling");
const gone = JSON.stringify({ type: "canceled", spaceId: space, customerId: "cus_smoke" });
await applyBillingEvent(provider.verify(gone, signFake(SECRET, gone)), provider.name);
const ended = await billingStatus(owner.actor, space);
check("the space falls back to free", ended.plan === "free");
check("...and says so", ended.status === "canceled");
check("free is still a usable allowance -- notes are never taken away",
  (await spaceUsage(owner.actor, space)).allowance >= 100);

console.log("\nthe fake refuses production");
check("BILLING_PROVIDER=fake is refused when NODE_ENV=production", await (async () => {
  const { resolveBilling } = await import("@jotdojo/billing");
  try {
    resolveBilling({ BILLING_PROVIDER: "fake", NODE_ENV: "production", AUTH_SECRET: "x" } as NodeJS.ProcessEnv);
    return false;
  } catch (e) {
    return (e as Error).message.includes("must never run in production");
  }
})());
check("an unset provider simply means billing is off", await (async () => {
  const { resolveBilling } = await import("@jotdojo/billing");
  return resolveBilling({} as NodeJS.ProcessEnv) === null;
})());

void BillingError;

console.log(failures === 0
  ? "\nbilling smoke: all checks passed"
  : `\nbilling smoke: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
