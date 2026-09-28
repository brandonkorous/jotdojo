import { and, eq, sql } from "drizzle-orm";
import {
  withActor, withoutActor, spaceBilling, spaceMembers, spaces, type Tx,
} from "@jotacular/db";
import type { BillingEvent, BillingProvider, PaidPlan } from "@jotacular/billing";
import type { Actor } from "./actor";
import { Forbidden, NotFound } from "./errors";

/**
 * Billing, per space. ADR-038.
 *
 * `spaces.plan` is what a space is ALLOWED and `space_billing` is why. They are
 * deliberately separate: a provider outage or a failing card must not silently
 * take a family's recognition away mid-month.
 */

export type BillingStatus = {
  plan: string;
  purchasedPlan: string | null;
  status: string | null;
  currentPeriodEnd: Date | null;
  managedBy: string | null;
  /** The space whose subscription covers this one, when it is not its own.
   *  Null is the ordinary case. ADR-119. */
  includedIn: { spaceId: string; name: string } | null;
};

async function assertOwner(actor: Actor, spaceId: string): Promise<void> {
  if (actor.type !== "user") throw new Forbidden("Only a person manages billing");
  const rows = await withActor(actor.userId, (tx) =>
    tx.select({ role: spaceMembers.role }).from(spaceMembers)
      .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, actor.userId)))
      .limit(1));
  if (rows[0]?.role !== "owner") throw new Forbidden("Only an owner can manage billing");
}

/** What an owner sees. Members see usage (ADR-036) but not the paperwork. */
export async function billingStatus(actor: Actor, spaceId: string): Promise<BillingStatus> {
  await assertOwner(actor, spaceId);
  return withActor(actor.userId, async (tx) => {
    const space = (await tx.select({ plan: spaces.plan, billedWith: spaces.billedWith })
      .from(spaces).where(eq(spaces.id, spaceId)).limit(1))[0];
    if (!space) throw new NotFound("No such space");

    const row = (await tx.select().from(spaceBilling)
      .where(eq(spaceBilling.spaceId, spaceId)).limit(1))[0];

    return {
      plan: space.plan,
      purchasedPlan: row?.plan ?? null,
      status: row?.status ?? null,
      currentPeriodEnd: row?.currentPeriodEnd ?? null,
      managedBy: row?.provider ?? null,
      includedIn: await payerOf(tx, space.billedWith),
    };
  });
}

/**
 * The space paying for this one, named. ADR-119.
 *
 * Named rather than identified, because the sentence on the account page is
 * "included in The Okonkwo house" and an id is not a place anybody recognises.
 */
async function payerOf(
  tx: Tx, billedWith: string | null,
): Promise<{ spaceId: string; name: string } | null> {
  if (!billedWith) return null;
  const rows = await tx.select({ name: spaces.name }).from(spaces)
    .where(eq(spaces.id, billedWith)).limit(1);
  // RLS hides a payer this person cannot reach, and the fact that somebody
  // else covers it is still true and still worth saying.
  return { spaceId: billedWith, name: rows[0]?.name ?? "another space" };
}

/**
 * Begin a purchase. Returns the URL to send the browser to.
 *
 * The space id is handed to the provider as metadata and comes back on the
 * webhook, so the subscription attaches to a space WE named rather than to
 * whatever the returning browser claims.
 */
export async function startCheckout(
  provider: BillingProvider | null, actor: Actor, spaceId: string,
  plan: PaidPlan, urls: { successUrl: string; cancelUrl: string },
): Promise<{ url: string }> {
  if (!provider) throw new Forbidden("Billing is not configured");
  await assertOwner(actor, spaceId);

  // A covered space must never grow a bill of its own -- that second charge is
  // exactly what issue 051 was. `app_apply_subscription` refuses it too; this
  // is the half that refuses it before a card is ever asked for. ADR-119.
  const covered = await withActor(actor.userId, (tx) =>
    tx.select({ billedWith: spaces.billedWith }).from(spaces)
      .where(eq(spaces.id, spaceId)).limit(1));
  if (covered[0]?.billedWith) {
    throw new Forbidden("This space is already covered by another space's plan");
  }

  const existing = await withActor(actor.userId, (tx) =>
    tx.select({ customerId: spaceBilling.customerId }).from(spaceBilling)
      .where(eq(spaceBilling.spaceId, spaceId)).limit(1));

  return provider.checkout({
    spaceId, plan, customerId: existing[0]?.customerId ?? null, ...urls,
  });
}

/** Where an owner changes or cancels what they already bought. */
export async function billingPortal(
  provider: BillingProvider | null, actor: Actor, spaceId: string, returnUrl: string,
): Promise<{ url: string }> {
  if (!provider) throw new Forbidden("Billing is not configured");
  await assertOwner(actor, spaceId);

  const row = await withActor(actor.userId, (tx) =>
    tx.select({ customerId: spaceBilling.customerId }).from(spaceBilling)
      .where(eq(spaceBilling.spaceId, spaceId)).limit(1));
  const customerId = row[0]?.customerId;
  if (!customerId) throw new NotFound("This space has never been billed");

  return provider.portal({ customerId, returnUrl });
}

/**
 * Apply a webhook that has ALREADY been verified.
 *
 * Runs without an actor, because a payment provider is not a signed-in person
 * -- one of the sanctioned uses of withoutActor, through a narrow SECURITY
 * DEFINER door rather than a write grant on `spaces`.
 *
 * The caller must have called `provider.verify` first. Taking the normalised
 * event rather than the raw body is what makes that impossible to forget: there
 * is no way to reach this function holding only unverified bytes.
 */
export async function applyBillingEvent(
  event: BillingEvent, providerName: string,
): Promise<{ applied: boolean; reason?: string }> {
  if (event.kind === "ignored") return { applied: false, reason: event.reason };

  if (event.kind === "canceled") {
    await withoutActor(async (tx) => {
      await tx.execute(sql`SELECT app_cancel_subscription(${event.spaceId}::uuid)`);
    });
    return { applied: true };
  }

  const s = event.subscription;
  await withoutActor(async (tx) => {
    await tx.execute(sql`
      SELECT app_apply_subscription(
        ${event.spaceId}::uuid, ${providerName}::text, ${s.customerId}::text,
        ${s.subscriptionId}::text, ${s.status}::text, ${s.plan}::text,
        ${s.currentPeriodEnd.toISOString()}::timestamptz)
    `);
  });
  return { applied: true };
}

/**
 * Put a space you already made onto the plan you already pay for. ADR-119.
 *
 * The other order of Kwabena's story: the room exists before the card does.
 * Nothing adopts it on its own, because guessing which of somebody's spaces a
 * payment meant is how a bill surprises people.
 */
export async function joinBilling(
  actor: Actor, spaceId: string, payerSpaceId: string,
): Promise<void> {
  if (actor.type !== "user") throw new Forbidden("Only a person manages billing");
  await withActor(actor.userId, async (tx) => {
    await tx.execute(
      sql`SELECT app_join_billing(${spaceId}::uuid, ${payerSpaceId}::uuid)`,
    );
  });
}

/** The undo, and the only way back to buying a plan for this space alone --
 *  `startCheckout` refuses a space somebody else is already paying for. */
export async function leaveBilling(actor: Actor, spaceId: string): Promise<void> {
  if (actor.type !== "user") throw new Forbidden("Only a person manages billing");
  await withActor(actor.userId, async (tx) => {
    await tx.execute(sql`SELECT app_leave_billing(${spaceId}::uuid)`);
  });
}
