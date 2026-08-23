import { and, eq, sql } from "drizzle-orm";
import { withActor, withoutActor, spaceBilling, spaceMembers, spaces } from "@jotacular/db";
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
    const space = (await tx.select({ plan: spaces.plan }).from(spaces)
      .where(eq(spaces.id, spaceId)).limit(1))[0];
    if (!space) throw new NotFound("No such space");

    const row = (await tx.select().from(spaceBilling)
      .where(eq(spaceBilling.spaceId, spaceId)).limit(1))[0];

    return {
      plan: space.plan,
      purchasedPlan: row?.plan ?? null,
      status: row?.status ?? null,
      currentPeriodEnd: row?.currentPeriodEnd ?? null,
      managedBy: row?.provider ?? null,
    };
  });
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
