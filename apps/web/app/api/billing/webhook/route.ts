import { billing } from "@jotdojo/billing";
import { applyBillingEvent } from "@jotdojo/domain";

/**
 * Where a payment provider tells us something happened. ADR-038.
 *
 * The only way a space ever becomes paid. Without this route the checkout
 * button is decoration: somebody pays, Stripe has nowhere to say so, and they
 * stay on the free plan while their card is charged -- which is the worst
 * possible failure for a thing that takes money.
 *
 * Not an authenticated route and it must not be. The caller is Stripe, which
 * has no session; the signature IS the authentication, and it is checked over
 * the RAW body because that is what the signature covers.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  let provider;
  try {
    provider = billing();
  } catch (err) {
    // A MISCONFIGURED provider, not an absent one -- resolveBilling throws when
    // the driver is named and unusable. Unhandled it reaches the caller as an
    // opaque 500 with no body, which is how eighteen checks once failed without
    // naming a cause. The log is the signal; 503 asks the provider to retry.
    console.error("[billing] provider is configured but unusable:", err);
    return text(503, "billing is misconfigured here");
  }

  // 503 rather than 500: nothing is broken, we simply do not take money in
  // this deployment. A provider retrying against it will eventually stop.
  if (!provider) return text(503, "billing is not configured here");

  const raw = await req.text();
  const signature = req.headers.get("stripe-signature")
    ?? req.headers.get("x-billing-signature");

  let event;
  try {
    event = provider.verify(raw, signature);
  } catch (err) {
    // 400, so the provider does NOT retry. A bad signature will still be bad
    // in five minutes, and retrying an unverifiable body forever hides the
    // one case worth paging about: somebody is posting here who should not be.
    console.warn("[billing] refused a webhook:", (err as Error).message);
    return text(400, "signature did not verify");
  }

  try {
    await applyBillingEvent(event, provider.name);
  } catch (err) {
    // 500, so the provider DOES retry. A database blip must not cost somebody
    // the plan they just bought.
    console.error("[billing] could not apply a verified event:", err);
    return text(500, "could not record that");
  }

  return text(200, "ok");
}

const text = (status: number, body: string) =>
  new Response(body, { status, headers: { "content-type": "text/plain" } });
