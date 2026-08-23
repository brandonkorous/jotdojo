import { billing } from "@jotacular/billing";
import {
  billingStatus, listSpaces, spaceUsage, type Actor,
} from "@jotacular/domain";

/**
 * What an owner is on, per space, for the account page. ADR-038.
 *
 * Assembled here rather than in the page so the page stays a view: three
 * domain calls per space, and the only place that decides what "you are on the
 * free plan and have used 12 of 100" actually means.
 */

export type PlanView = {
  /** Whether this deployment can take money at all. With no provider
   *  configured there is nothing to buy, and offering a price that throws when
   *  it is clicked is worse than offering nothing. */
  sellable: boolean;
  spaceId: string;
  name: string;
  plan: string;
  used: number;
  allowance: number;
  over: boolean;
  /** True once this space has ever been billed, which is what makes a portal
   *  link possible -- there is nothing to manage before the first purchase. */
  billed: boolean;
  /** Set while a payment is failing: what they bought, which is no longer what
   *  they are allowed. Saying nothing here is how a silent downgrade happens. */
  purchased: string | null;
  status: string | null;
  renewsAt: Date | null;
};

/** Only spaces this person owns. A member sees usage on their own screen; the
 *  paperwork belongs to whoever pays for it (ADR-036). */
export async function ownedPlans(actor: Actor): Promise<PlanView[]> {
  const spaces = (await listSpaces(actor)).filter((s) => s.role === "owner");
  const sellable = billing() !== null;

  return Promise.all(spaces.map(async (space) => {
    const [usage, paperwork] = await Promise.all([
      spaceUsage(actor, space.id),
      billingStatus(actor, space.id),
    ]);
    return {
      sellable,
      spaceId: space.id,
      name: space.name,
      plan: usage.plan,
      used: usage.used,
      allowance: usage.allowance,
      over: usage.over,
      billed: paperwork.managedBy !== null,
      purchased: paperwork.purchasedPlan,
      status: paperwork.status,
      renewsAt: paperwork.currentPeriodEnd,
    };
  }));
}
