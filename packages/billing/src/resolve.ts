import { fakeBilling } from "./fake";
import { stripeBilling } from "./stripe";
import type { BillingProvider } from "./provider";

/**
 * Pick a billing provider from the environment. ADR-038, ADR-114.
 *
 * STRIPE IS DERIVED FROM ITS KEYS, not declared. This product takes money
 * through Stripe; there is no second processor and no decision to record. A
 * `BILLING_PROVIDER=stripe` that had to be set BESIDE the five secrets was a
 * fact the environment already knew, stated twice -- and the two could
 * disagree, which is precisely what ADR-113 found: five live Stripe secrets
 * sitting inert in a vault because the sixth entry was missing.
 *
 * So there are three states and they are the only three:
 *
 *   no Stripe secrets at all   billing is OFF, honestly and deliberately
 *   all five                   billing is ON
 *   some of them               a CONFIGURATION ERROR, thrown, never "off"
 *
 * The middle state is what the old shape could not express. A half-configured
 * deployment used to look exactly like an unconfigured one.
 */

/** The five, named once. `resolveBilling` and the release preflight both read
 *  this list, so they cannot drift apart. */
export const STRIPE_KEYS = [
  "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_SOLO", "STRIPE_PRICE_FAMILY", "STRIPE_PRICE_TEAM",
] as const;

export function resolveBilling(env = process.env): BillingProvider | null {
  const named = env.BILLING_PROVIDER?.trim().toLowerCase();

  if (named === "fake") {
    // Same refusal as the local storage driver (ADR-028). A fake that takes no
    // money would, in production, hand out paid plans for free and record that
    // someone paid. ADR-052: the CI flag is the ONLY exemption, and release.yml
    // cannot forward it -- the container env is built solely from vault entries
    // on its allow-lists, and this name is deliberately absent from both.
    if (env.NODE_ENV === "production" && env.JOTACULAR_FAKE_PROVIDERS_OK !== "1") {
      throw new Error("BILLING_PROVIDER=fake must never run in production");
    }
    const secret = env.BILLING_WEBHOOK_SECRET ?? env.AUTH_SECRET;
    if (!secret) throw new Error("BILLING_PROVIDER=fake needs BILLING_WEBHOOK_SECRET or AUTH_SECRET");
    return fakeBilling({ webhookSecret: secret });
  }

  // `stripe` is still accepted and is now a no-op: the keys decide. Anything
  // else is a typo, and a typo that quietly meant "off" is how somebody ships
  // a deployment that cannot take money and does not say so.
  if (named && named !== "stripe") {
    throw new Error(`Unknown BILLING_PROVIDER: ${named}. Stripe needs no switch; its keys are enough`);
  }

  const missing = STRIPE_KEYS.filter((name) => !env[name]?.trim());
  if (missing.length === STRIPE_KEYS.length) return null;
  if (missing.length > 0) {
    throw new Error(
      `Stripe is half-configured, which is not the same as off. Missing: ${missing.join(", ")}`,
    );
  }

  return stripeBilling({
    secretKey: env.STRIPE_SECRET_KEY!,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET!,
    prices: {
      solo: env.STRIPE_PRICE_SOLO!,
      family: env.STRIPE_PRICE_FAMILY!,
      team: env.STRIPE_PRICE_TEAM!,
    },
  });
}

let cached: BillingProvider | null | undefined;

export function billing(): BillingProvider | null {
  if (cached === undefined) cached = resolveBilling();
  return cached;
}
