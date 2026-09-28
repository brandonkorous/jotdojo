"use client";

import { useTransition } from "react";
import {
  startCheckoutAction, billingPortalAction, joinBillingAction, leaveBillingAction,
} from "@/app/billing-actions";
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

/** `payer` is computed on the server (plans-view.ts) and handed down: this
 *  file is a client component, and importing that module would pull the whole
 *  domain layer into the browser bundle to answer one question. */
export function PlanSection(
  { plans, payer }: { plans: PlanView[]; payer: PlanView | null },
) {
  const [pending, startTransition] = useTransition();
  if (plans.length === 0) return null;

  return (
    <section>
      <h2 className="font-head text-xl">What you are on</h2>
      <p className="mb-4 mt-1 text-sm jd-quiet">
        One price, however many people are in it and however many spaces you
        make. Only reading costs anything — pages of handwriting, photos, and
        minutes of audio. Writing notes never counts against it.
      </p>

      <ul className="flex flex-col gap-3">
        {plans.map((space) => (
          <PlanRow key={space.spaceId} space={space} payer={payer}
            pending={pending} run={startTransition} />
        ))}
      </ul>
    </section>
  );
}

type RowProps = {
  space: PlanView;
  /** The space already paying, if any -- what a free space can join. */
  payer: PlanView | null;
  pending: boolean;
  run: (fn: () => void) => void;
};

/** One space: what it is on, what it has spent, and what can be done about it. */
function PlanRow({ space, payer, pending, run }: RowProps) {
  return (
    <li className="rounded-xl border border-black/10 px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-medium">{space.name}</span>
        <span className="badge badge-neutral badge-sm">{space.plan}</span>
        <span className="ml-auto text-sm jd-quiet">{usage(space)}</span>
      </div>

      {trouble(space) && <p className="mt-2 text-sm text-accent">{trouble(space)}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PlanActions space={space} payer={payer} pending={pending} run={run} />
      </div>
    </li>
  );
}

/**
 * The one path out of this state, and never two.
 *
 * Checkout STARTS a subscription. Offering it to somebody who already has one
 * does not move them between plans — it opens a second subscription alongside
 * the first and bills them for both. Changing a plan belongs to the portal.
 *
 * A COVERED SPACE IS OFFERED NEITHER. It rides on another space's bill, so a
 * price list here is the £9-twice trap of issue 051 drawn one screen later.
 */
function PlanActions({ space, payer, pending, run }: RowProps) {
  if (space.includedIn) return <Covered space={space} pending={pending} run={run} />;
  if (!space.sellable) return null;
  if (space.billed) return <Bought space={space} pending={pending} run={run} />;

  return (
    <>
      {/* A space made BEFORE the card. Offered first, because "add it to what
          you already pay for" is the answer to the price list beside it. */}
      {payer && payer.spaceId !== space.spaceId && space.plan === "free" && (
        <button type="button" disabled={pending} className="btn btn-sm"
          onClick={() => run(async () => {
            await joinBillingAction(space.spaceId, payer.spaceId);
          })}>
          Add to {payer.name}
        </button>
      )}
      {(Object.keys(PRICE) as PaidPlan[])
        .filter((plan) => plan !== space.plan)
        .map((plan) => (
          <button key={plan} type="button" disabled={pending} className="btn btn-sm btn-ghost"
            onClick={() => run(async () => { await startCheckoutAction(space.spaceId, plan); })}
            aria-label={`Move this space to ${PRICE[plan].label}, `
              + `${PRICE[plan].price} a month, ${PRICE[plan].who}`}>
            {PRICE[plan].label} {PRICE[plan].price}
          </button>
        ))}
    </>
  );
}

/** A space somebody else's subscription pays for, and the way back out. */
function Covered({ space, pending, run }: Omit<RowProps, "payer">) {
  return (
    <>
      {/* The cancelled case is the one worth spelling out. The grouping
          survives a cancellation on purpose, so putting the payer back on a
          plan covers this space again — but saying "no second bill" about two
          free spaces would be describing a plan neither of them is on. */}
      <span className="text-sm jd-quiet">
        {space.plan === "free" ? (
          <>
            Included in <strong>{space.includedIn?.name}</strong>, which is not on
            a plan just now. Put that one back on a plan, or bill this one alone.
          </>
        ) : (
          <>
            Included in <strong>{space.includedIn?.name}</strong> — no second bill.
            The reading above is what those spaces have used between them.
          </>
        )}
      </span>
      <button type="button" disabled={pending} className="btn btn-sm btn-ghost"
        onClick={() => run(async () => { await leaveBillingAction(space.spaceId); })}>
        Bill this space on its own
      </button>
    </>
  );
}

/** A space with a subscription of its own. The portal, and the sentence the
 *  portal cannot answer: cancelling drops the plan and deletes nothing.
 *  Measured, issue 035. */
function Bought({ space, pending, run }: Omit<RowProps, "payer">) {
  return (
    <>
      <button type="button" disabled={pending} className="btn btn-sm btn-ghost"
        onClick={() => run(async () => { await billingPortalAction(space.spaceId); })}>
        Change plan or cancel
      </button>
      <span className="text-sm jd-quiet">
        Switching plans and cancelling both happen here.
        {" "}Your notes stay either way — nothing is deleted by cancelling.
      </span>
    </>
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
