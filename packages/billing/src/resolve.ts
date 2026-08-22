import { fakeBilling } from "./fake";
import { stripeBilling } from "./stripe";
import type { BillingProvider } from "./provider";

/**
 * Pick a billing provider from the environment.
 *
 * Absent means BILLING IS OFF, not broken: everyone is on the free plan, the
 * app works, and nothing pretends a payment happened. That is the honest state
 * for a deployment nobody has approved spend for.
 */
export function resolveBilling(env = process.env): BillingProvider | null {
  const provider = env.BILLING_PROVIDER?.trim().toLowerCase();

  if (provider === "fake") {
    // Same refusal as the local storage driver (ADR-028). A fake that takes no
    // money would, in production, hand out paid plans for free and record that
    // someone paid. A development convenience that silently becomes the
    // production path is how this kind of thing goes wrong.
    if (env.NODE_ENV === "production") {
      throw new Error("BILLING_PROVIDER=fake must never run in production");
    }
    const secret = env.BILLING_WEBHOOK_SECRET ?? env.AUTH_SECRET;
    if (!secret) throw new Error("BILLING_PROVIDER=fake needs BILLING_WEBHOOK_SECRET or AUTH_SECRET");
    return fakeBilling({ webhookSecret: secret });
  }

  if (provider === "stripe") {
    const secretKey = env.STRIPE_SECRET_KEY;
    const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
    const solo = env.STRIPE_PRICE_SOLO;
    const family = env.STRIPE_PRICE_FAMILY;
    const team = env.STRIPE_PRICE_TEAM;
    if (!secretKey || !webhookSecret || !solo || !family || !team) {
      throw new Error(
        "BILLING_PROVIDER=stripe needs STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, "
        + "STRIPE_PRICE_SOLO, STRIPE_PRICE_FAMILY and STRIPE_PRICE_TEAM",
      );
    }
    return stripeBilling({ secretKey, webhookSecret, prices: { solo, family, team } });
  }

  if (provider) throw new Error(`Unknown BILLING_PROVIDER: ${provider}`);
  return null;
}

let cached: BillingProvider | null | undefined;

export function billing(): BillingProvider | null {
  if (cached === undefined) cached = resolveBilling();
  return cached;
}
