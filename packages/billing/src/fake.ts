import { createHmac, timingSafeEqual } from "node:crypto";
import {
  BillingError, PAID_PLANS,
  type BillingEvent, type BillingProvider, type PaidPlan, type Subscription,
} from "./provider";

/**
 * A billing provider for development and the smoke suites. ADR-038.
 *
 * It takes no money and talks to nobody. What it does do is enforce the SAME
 * signature contract as the real one, because a fake that accepts unsigned
 * webhooks would let an unsigned-webhook bug ship: the suites would pass
 * against a driver that never checks the one thing worth checking.
 */

export type FakeConfig = { webhookSecret: string };

/** The same `t=<ts>,v1=<sig>` shape Stripe uses, so tests exercise the real
 *  parsing path rather than a friendlier one. */
export function signFake(secret: string, rawBody: string, at = new Date()): string {
  const t = Math.floor(at.getTime() / 1000);
  const v1 = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

export function fakeBilling(cfg: FakeConfig): BillingProvider {
  return {
    name: "fake",

    async checkout(input) {
      // A URL that goes somewhere obviously inert. A fake that returned a
      // plausible-looking stripe.com link would be a trap in a screenshot.
      const q = new URLSearchParams({ space: input.spaceId, plan: input.plan });
      return { url: `https://billing.invalid/checkout?${q}` };
    },

    async portal(input) {
      const q = new URLSearchParams({ customer: input.customerId });
      return { url: `https://billing.invalid/portal?${q}` };
    },

    verify(rawBody, signature): BillingEvent {
      if (!signature) throw new BillingError("no signature header");
      const parts = Object.fromEntries(
        signature.split(",").map((p) => p.split("=", 2) as [string, string]),
      );
      const timestamp = Number(parts.t);
      if (!Number.isFinite(timestamp)) throw new BillingError("malformed signature");
      if (Math.abs(Date.now() / 1000 - timestamp) > 300) {
        throw new BillingError("signature is too old");
      }
      const expected = createHmac("sha256", cfg.webhookSecret)
        .update(`${parts.t}.${rawBody}`).digest("hex");
      const got = Buffer.from(parts.v1 ?? "", "utf8");
      const want = Buffer.from(expected, "utf8");
      if (got.length !== want.length || !timingSafeEqual(got, want)) {
        throw new BillingError("signature does not match");
      }

      const body = JSON.parse(rawBody) as {
        type?: string; spaceId?: string; plan?: PaidPlan;
        status?: Subscription["status"]; customerId?: string;
        subscriptionId?: string; currentPeriodEnd?: string;
      };

      if (!body.spaceId) return { kind: "ignored", reason: "no spaceId" };
      if (body.type === "canceled") {
        return { kind: "canceled", spaceId: body.spaceId, customerId: body.customerId ?? "" };
      }
      if (body.type !== "subscription") {
        return { kind: "ignored", reason: body.type ?? "no type" };
      }
      if (!body.plan || !PAID_PLANS.includes(body.plan)) {
        return { kind: "ignored", reason: `unknown plan ${body.plan}` };
      }

      return {
        kind: "subscription",
        spaceId: body.spaceId,
        subscription: {
          customerId: body.customerId ?? "cus_fake",
          subscriptionId: body.subscriptionId ?? "sub_fake",
          plan: body.plan,
          status: body.status ?? "active",
          currentPeriodEnd: new Date(body.currentPeriodEnd ?? Date.now() + 30 * 864e5),
        },
      };
    },
  };
}
