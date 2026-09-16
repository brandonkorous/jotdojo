"use client";

import { useTransition } from "react";
import { startCheckoutAction, billingPortalAction } from "@/app/actions";
import type { PaidPlan } from "@jotacular/billing";
import type { PlanView } from "@/lib/plans-view";

/**
 * What this space costs, and the only way to change it. ADR-038.
 *
 * The domain layer, the provider seam and the webhook were all built before
 * this was, which meant everything worked except the part where somebody hands
 * us money. A pricing page nobody can act on is a leaflet.
 */

/**
 * The seat numbers here must match `app_plan_seats` — solo 1, family 6, team 25.
 *
 * Team said "up to 5" on this screen long after ADR-112 corrected it in the
 * database, in docs/01 and on the pricing page, so the one button somebody
 * presses to pay offered less than the cheaper plan above it. Issue 033.
 */
const PRICE: Record<PaidPlan, { label: string; price: string; who: string }> = {
  solo: { label: "Solo", price: "$5", who: "just you" },
  family: { label: "Family", price: "$9", who: "up to 6 people" },
  team: { label: "Team", price: "$19", who: "up to 25 people, and the agent that reads new notes" },
};

export function PlanSection({ plans }: { plans: PlanView[] }) {
  const [pending, startTransition] = useTransition();
  if (plans.length === 0) return null;

  return (
    <section>
      <h2 className="font-head text-xl">What you are on</h2>
      <p className="mb-4 mt-1 text-sm jd-quiet">
        One price for the space, however many people are in it. Only reading
        costs anything — pages of handwriting, photos, and minutes of audio.
        Writing notes never counts against it.
      </p>

      <ul className="flex flex-col gap-3">
        {plans.map((space) => (
          <li key={space.spaceId} className="rounded-xl border border-black/10 px-4 py-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-medium">{space.name}</span>
              <span className="badge badge-neutral badge-sm">{space.plan}</span>
              <span className="ml-auto text-sm jd-quiet">{usage(space)}</span>
            </div>

            {trouble(space) && (
              <p className="mt-2 text-sm text-accent">{trouble(space)}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {/* ONE path per state, and they must not both be offered.
                *
                * Checkout STARTS a subscription. Offering it to somebody who
                * already has one does not move them between plans -- it opens a
                * second subscription alongside the first and bills them for
                * both. Changing an existing plan belongs to the portal, which
                * switches it in place and prorates. */}
              {!space.sellable ? null : space.billed ? (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    className="btn btn-sm btn-ghost"
                    onClick={() => startTransition(async () => {
                      await billingPortalAction(space.spaceId);
                    })}
                  >
                    Change plan or cancel
                  </button>
                  {/* The second sentence is the one somebody cancelling actually
                      wants, and this button hands them to a payment portal that
                      cannot answer it. Measured: cancelling drops the plan to
                      free and deletes nothing. Issue 035. */}
                  <span className="text-sm jd-quiet">
                    Switching plans and cancelling both happen here.
                    {" "}Your notes stay either way — nothing is deleted by cancelling.
                  </span>
                </>
              ) : (
                (Object.keys(PRICE) as PaidPlan[])
                  .filter((plan) => plan !== space.plan)
                  .map((plan) => (
                    <button
                      key={plan}
                      type="button"
                      disabled={pending}
                      className="btn btn-sm btn-ghost"
                      onClick={() => startTransition(async () => {
                        await startCheckoutAction(space.spaceId, plan);
                      })}
                      aria-label={`Move this space to ${PRICE[plan].label}, `
                        + `${PRICE[plan].price} a month, ${PRICE[plan].who}`}
                    >
                      {PRICE[plan].label} {PRICE[plan].price}
                    </button>
                  ))
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The two numbers people actually want: how much of the month is left, and how
 * much of the space is.
 *
 * Seats are only mentioned on a plan that holds more than one person. On Free
 * and Solo "1 of 1 people" is a limit shown to somebody who has not met it and
 * cannot, which docs/11 calls furniture. ADR-112.
 */
function usage(space: PlanView): string {
  const read = `${space.used} of ${space.allowance.toLocaleString()} read this month`;
  if (space.seats <= 1) return read;
  return `${read} · ${space.seatsTaken} of ${space.seats} people`;
}

/**
 * The two states worth interrupting for.
 *
 * Over the allowance, nothing was lost and it is worth saying so out loud --
 * docs/01 calls losing a thought to a billing limit the one unforgivable
 * failure. A failing payment is worse than a cancelled one, because the plan
 * has already quietly gone away.
 */
function trouble(space: PlanView): string | null {
  // past_due KEEPS the plan on purpose (migration 0016), so the signal is the
  // status, not a difference between what was bought and what is allowed.
  if (space.status === "past_due") {
    return "The card is not going through. Nothing has been taken away and"
      + " nothing has been deleted, but it will lapse if it keeps failing.";
  }
  if (space.purchased && space.purchased !== space.plan) {
    return `This space is on ${space.plan} rather than the ${space.purchased}`
      + ` that was bought. Nothing has been deleted.`;
  }
  if (space.over) {
    return "You have used this month's reading. Everything still saves, and what"
      + " is waiting gets read when the month turns over.";
  }
  return null;
}
