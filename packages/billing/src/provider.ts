/**
 * The billing seam. ADR-038.
 *
 * One interface, two drivers, and the same shape as storage and vision: the
 * application never names Stripe, so the day it is replaced is a day one file
 * changes rather than a migration.
 */

/** The plans that can be bought. `free` is not one of them -- it is the
 *  absence of a subscription, not a product. docs/01-audience-and-pricing.md. */
export type PaidPlan = "solo" | "family" | "team";

/** Every sellable plan, in one place, so a driver cannot quietly know a
 *  different list from the migration that grants it. */
export const PAID_PLANS: readonly PaidPlan[] = ["solo", "family", "team"];

export type Subscription = {
  /** The provider's customer handle, stored so a portal link can be made later. */
  customerId: string;
  subscriptionId: string;
  plan: PaidPlan;
  /** `active` and `trialing` grant the plan. Anything else falls back to free. */
  status: "active" | "trialing" | "past_due" | "canceled";
  currentPeriodEnd: Date;
};

/**
 * What a webhook told us, already verified and normalised.
 *
 * `spaceId` rather than a customer id, because the space is what we bill and
 * the provider's own identifiers must not leak into the domain layer.
 */
export type BillingEvent =
  | { kind: "subscription"; spaceId: string; subscription: Subscription }
  | { kind: "canceled"; spaceId: string; customerId: string }
  | { kind: "ignored"; reason: string };

export type Checkout = { url: string };

export type BillingProvider = {
  readonly name: string;
  /** Start a purchase. `spaceId` is round-tripped so the webhook can find it
   *  again without us trusting anything the browser sends back. */
  checkout(input: {
    spaceId: string; plan: PaidPlan; customerId?: string | null;
    successUrl: string; cancelUrl: string;
  }): Promise<Checkout>;
  /** Where someone manages or cancels what they already bought. */
  portal(input: { customerId: string; returnUrl: string }): Promise<Checkout>;
  /**
   * Verify a webhook and normalise it.
   *
   * Takes the RAW body, not a parsed object: a signature is over bytes, and
   * `JSON.parse` followed by `JSON.stringify` does not reliably reproduce them.
   */
  verify(rawBody: string, signature: string | null): BillingEvent;
};

export class BillingError extends Error {
  constructor(message: string, readonly retryable = false) {
    super(message);
    this.name = "BillingError";
  }
}
