/**
 * The billing webhook, over real HTTP. ADR-038, ADR-049.
 *
 * This is the only unauthenticated write endpoint in the product, and it is
 * the one that decides who has paid us. The signature IS the authentication,
 * so most of what follows is about what the route REFUSES.
 *
 * The domain suite proves the entitlement logic; this proves the wiring, which
 * is the part that did not exist until ADR-049 -- the checkout button had no
 * webhook behind it, so a payment could be taken and never applied.
 *
 * Requires the web app running (pnpm dev) and BILLING_PROVIDER=fake.
 */
export {};

import { createHmac } from "node:crypto";
import {
  upsertUserFromGoogle, asUser, defaultSpaceId, spaceUsage,
} from "@jotdojo/domain";

const WEB = process.env.APP_URL ?? "http://localhost:3400";
const HOOK = `${WEB}/api/billing/webhook`;
const SECRET = process.env.BILLING_WEBHOOK_SECRET ?? "dev-billing-secret";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
};

/** The same `t=<ts>,v1=<sig>` header Stripe sends, so this exercises the real
 *  parsing path rather than a friendlier one. */
const sign = (body: string, at = Date.now()) => {
  const t = Math.floor(at / 1000);
  return `t=${t},v1=${createHmac("sha256", SECRET).update(`${t}.${body}`).digest("hex")}`;
};

async function post(body: string, signature: string | null) {
  const res = await fetch(HOOK, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(signature ? { "stripe-signature": signature } : {}),
    },
    body,
  });
  return { status: res.status, body: await res.text() };
}

const stamp = Date.now();
const user = await upsertUserFromGoogle({
  googleSub: `hook-${stamp}`, email: `hook-${stamp}@example.test`, displayName: "Hook",
});
const actor = asUser(user.id);
const space = await defaultSpaceId(actor);

const subscription = (plan: string, status = "active") => JSON.stringify({
  type: "subscription", spaceId: space, plan, status,
  customerId: `cus_${stamp}`, subscriptionId: `sub_${stamp}`,
});

console.log("\nwhat it refuses");
const body = subscription("team");

check("an unsigned webhook is refused", (await post(body, null)).status === 400);
check("a forged signature is refused", (await post(body, "t=1,v1=deadbeef")).status === 400);
check("a signature over a DIFFERENT body is refused",
  (await post(body, sign(subscription("solo")))).status === 400);

// Replay protection. A signature captured today must not still work next week,
// which is the whole reason the timestamp is inside the signed string.
const old = sign(body, Date.now() - 20 * 60_000);
check("a signature from twenty minutes ago is refused", (await post(body, old)).status === 400);

check("...and none of that granted anything",
  (await spaceUsage(actor, space)).plan === "free");

console.log("\nwhat it accepts");
const ok = await post(body, sign(body));
check("a properly signed webhook is accepted", ok.status === 200, `${ok.status} ${ok.body}`);
check("THE SPACE IS NOW ON THE PLAN THAT WAS BOUGHT",
  (await spaceUsage(actor, space)).plan === "team");
check("...and the allowance moved with it",
  (await spaceUsage(actor, space)).allowance === 10_000);

console.log("\na failing card is a conversation, not a cancellation");
const late = subscription("team", "past_due");
check("past_due is accepted", (await post(late, sign(late))).status === 200);
// Migration 0016 is explicit about this and it is the kinder reading: the
// provider retries for days before it gives up, and taking a family's
// recognition away on the first failed charge punishes them for an old card.
check("...and the space KEEPS the plan it paid for",
  (await spaceUsage(actor, space)).plan === "team");

console.log("\nevery plan the pricing page sells is actually sellable");
for (const plan of ["solo", "family", "team"] as const) {
  const sale = subscription(plan);
  const res = await post(sale, sign(sale));
  check(`${plan} is accepted`, res.status === 200, `${res.status} ${res.body}`);
  check(`...and grants ${plan}`, (await spaceUsage(actor, space)).plan === plan);
}

console.log("\ncancelling");
const gone = JSON.stringify({ type: "canceled", spaceId: space, customerId: `cus_${stamp}` });
check("a cancellation is accepted", (await post(gone, sign(gone))).status === 200);
check("...and the space is free", (await spaceUsage(actor, space)).plan === "free");

console.log("\nnoise");
const junk = JSON.stringify({ type: "invoice.whatever", spaceId: space });
check("an event we do not care about is accepted and ignored",
  (await post(junk, sign(junk))).status === 200);
const nospace = JSON.stringify({ type: "subscription", plan: "team" });
check("an event with no space is accepted and ignored",
  (await post(nospace, sign(nospace))).status === 200);

console.log(failures === 0 ? "\nall good\n" : `\n${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
