import { createHmac, timingSafeEqual } from "node:crypto";
import {
  BillingError, type BillingEvent, type BillingProvider, type Checkout,
  type PaidPlan, type Subscription,
} from "./provider";

/**
 * Stripe over its REST API, no SDK.
 *
 * Same reasoning as the Azure blob driver (ADR-028): the SDK is a large
 * dependency for three endpoints and a signature check, and the signature check
 * is the only part with any substance.
 */

const API = "https://api.stripe.com/v1";

export type StripeConfig = {
  secretKey: string;
  webhookSecret: string;
  /** Price ids per plan. They differ per environment, so they are configuration
   *  rather than constants. */
  prices: Record<PaidPlan, string>;
};

/** Stripe takes form encoding, not JSON, including for nested fields. */
function form(fields: Record<string, string | undefined>): string {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) body.set(k, v);
  return body.toString();
}

/**
 * The API version this driver was written against.
 *
 * Pinned, because an account's default version can be changed in a dashboard
 * by somebody who is not thinking about this code, and Stripe moves fields
 * between objects across versions. An integration that reads whatever today's
 * default happens to be is one that breaks on a day nobody deployed anything.
 *
 * THE WEBHOOK ENDPOINT HAS ITS OWN VERSION, set in the Dashboard, and it is
 * what decides the shape of the payloads this file parses. Changing this
 * constant without changing that one moves only half the integration.
 */
const API_VERSION = "2026-07-29.dahlia";

async function call(
  cfg: StripeConfig, path: string, body: string, idempotencyKey?: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${cfg.secretKey}`,
      "content-type": "application/x-www-form-urlencoded",
      "stripe-version": API_VERSION,
      // A retried POST after a network blip must not open a second checkout
      // session or a second subscription.
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    },
    body,
  });
  const json = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    const detail = (json.error as { message?: string } | undefined)?.message ?? res.statusText;
    // 429 and 5xx are worth another attempt; a 400 means we sent nonsense and
    // will send the same nonsense again.
    throw new BillingError(`stripe ${path}: ${detail}`, res.status === 429 || res.status >= 500);
  }
  return json;
}

/**
 * Stripe's `t=<ts>,v1=<sig>` header, checked properly.
 *
 * The timestamp is part of the signed payload AND is checked for age: without
 * the age check a captured webhook stays replayable forever, which is the
 * common way this is got wrong.
 */
function verifySignature(cfg: StripeConfig, raw: string, header: string | null, toleranceSeconds = 300) {
  if (!header) throw new BillingError("no stripe-signature header");

  const pairs = header.split(",").map((p) => p.split("=", 2) as [string, string]);
  const timestamp = Number(pairs.find(([k]) => k === "t")?.[1]);
  if (!Number.isFinite(timestamp)) throw new BillingError("malformed stripe-signature");
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) {
    throw new BillingError("stripe-signature is too old");
  }

  // EVERY v1, not the last one. While a webhook secret is being rotated Stripe
  // signs with both the old and the new one and sends several v1 values in the
  // same header. Keeping only one is a rotation that silently starts refusing
  // live webhooks -- and a refused webhook means a paid customer stays free.
  const offered = pairs.filter(([k]) => k === "v1").map(([, v]) => v ?? "");
  const want = Buffer.from(
    createHmac("sha256", cfg.webhookSecret).update(`${timestamp}.${raw}`).digest("hex"),
    "utf8",
  );
  const matched = offered.some((candidate) => {
    const got = Buffer.from(candidate, "utf8");
    return got.length === want.length && timingSafeEqual(got, want);
  });
  if (!matched) throw new BillingError("stripe-signature does not match");
}

const planOf = (cfg: StripeConfig, priceId: string): PaidPlan | null => {
  for (const [plan, id] of Object.entries(cfg.prices)) {
    if (id === priceId) return plan as PaidPlan;
  }
  return null;
};

export function stripeBilling(cfg: StripeConfig): BillingProvider {
  return {
    name: "stripe",

    async checkout(input): Promise<Checkout> {
      const json = await call(cfg, "/checkout/sessions", form({
        mode: "subscription",
        "line_items[0][price]": cfg.prices[input.plan],
        "line_items[0][quantity]": "1",
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        customer: input.customerId ?? undefined,
        // The space travels with the session and comes back on the webhook, so
        // the subscription is attached to a space WE chose rather than to
        // whatever the returning browser claims.
        "metadata[space_id]": input.spaceId,
        "subscription_data[metadata][space_id]": input.spaceId,
      }));
      const url = json.url;
      if (typeof url !== "string") throw new BillingError("stripe returned no checkout url");
      return { url };
    },

    async portal(input): Promise<Checkout> {
      const json = await call(cfg, "/billing_portal/sessions", form({
        customer: input.customerId,
        return_url: input.returnUrl,
      }));
      const url = json.url;
      if (typeof url !== "string") throw new BillingError("stripe returned no portal url");
      return { url };
    },

    verify(rawBody, signature): BillingEvent {
      verifySignature(cfg, rawBody, signature);

      const event = JSON.parse(rawBody) as {
        type?: string;
        data?: { object?: Record<string, unknown> };
      };
      const object = event.data?.object ?? {};
      const type = event.type ?? "";

      if (type === "customer.subscription.deleted") {
        const spaceId = (object.metadata as { space_id?: string } | undefined)?.space_id;
        if (!spaceId) return { kind: "ignored", reason: "no space_id on subscription" };
        return { kind: "canceled", spaceId, customerId: String(object.customer ?? "") };
      }

      if (type !== "customer.subscription.created" && type !== "customer.subscription.updated") {
        return { kind: "ignored", reason: type || "no event type" };
      }

      const spaceId = (object.metadata as { space_id?: string } | undefined)?.space_id;
      if (!spaceId) return { kind: "ignored", reason: "no space_id on subscription" };

      const item = (object.items as {
        data?: Array<{ price?: { id?: string }; current_period_end?: number }>;
      } | undefined)?.data?.[0];
      const plan = planOf(cfg, item?.price?.id ?? "");
      // A price we do not sell is not an error to retry -- it is somebody
      // else's product on the same account, and it must not change a plan here.
      if (!plan) return { kind: "ignored", reason: `unknown price ${item?.price?.id}` };

      const subscription: Subscription = {
        customerId: String(object.customer ?? ""),
        subscriptionId: String(object.id ?? ""),
        plan,
        status: normaliseStatus(String(object.status ?? "")),
        currentPeriodEnd: periodEnd(object, item),
      };
      return { kind: "subscription", spaceId, subscription };
    },
  };
}

/**
 * When this subscription next renews.
 *
 * Read from the subscription ITEM first, then the subscription. Stripe moved
 * `current_period_end` off the subscription and onto its items in the 2025
 * versions, so reading only the old place yields undefined -- and
 * `Number(undefined) * 1000` is a renewal date of January 1970, stored and
 * shown to the customer as fact.
 */
function periodEnd(
  object: Record<string, unknown>,
  item: { current_period_end?: number } | undefined,
): Date {
  const seconds = Number(item?.current_period_end ?? object.current_period_end ?? 0);
  return new Date((Number.isFinite(seconds) ? seconds : 0) * 1000);
}

/** Stripe has more statuses than we act on. Anything not clearly good is not
 *  treated as good -- `incomplete` must not hand out a paid plan. */
function normaliseStatus(status: string): Subscription["status"] {
  if (status === "active" || status === "trialing") return status;
  if (status === "past_due" || status === "unpaid") return "past_due";
  return "canceled";
}
