"use server";

/**
 * What a space costs, and which bill it is on. ADR-038, ADR-119.
 *
 * Split from actions.ts when issue 051 added the two below and that file was
 * three lines under its limit. The seam is a fair one and the file had already
 * drawn it with a comment: everything left in actions.ts is what the CANVAS
 * and the account do, and this is the four things that move money.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { billing, type PaidPlan } from "@jotacular/billing";
import { startCheckout, billingPortal, joinBilling, leaveBilling } from "@jotacular/domain";
import { requireActor } from "@/lib/session";
import { appOrigin } from "@/lib/hosts";

export async function startCheckoutAction(spaceId: string, plan: PaidPlan): Promise<never> {
  const { url } = await startCheckout(billing(), await requireActor(), spaceId, plan, {
    // Back to the same page either way. The plan does not change on return --
    // it changes when the WEBHOOK lands, which may be a second later.
    successUrl: `${appOrigin()}/account?bought=${plan}`,
    cancelUrl: `${appOrigin()}/account`,
  });
  redirect(url);
}

export async function billingPortalAction(spaceId: string): Promise<never> {
  const { url } = await billingPortal(
    billing(), await requireActor(), spaceId, `${appOrigin()}/account`,
  );
  redirect(url);
}

/** Put a space made before the card onto the plan bought after it. ADR-119. */
export async function joinBillingAction(spaceId: string, payerSpaceId: string): Promise<void> {
  await joinBilling(await requireActor(), spaceId, payerSpaceId);
  revalidatePath("/account");
}

/** Its undo. Checkout refuses a space somebody else pays for, so without this
 *  joining would be a door that locks behind you. */
export async function leaveBillingAction(spaceId: string): Promise<void> {
  await leaveBilling(await requireActor(), spaceId);
  revalidatePath("/account");
}
