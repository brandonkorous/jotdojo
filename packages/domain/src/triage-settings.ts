import { eq } from "drizzle-orm";
import { withActor, spaces, spaceMembers } from "@jotacular/db";
import { canReachSpace, type Actor } from "./actor";
import { DomainError, NotFound } from "./errors";
import { assertOwner } from "./members";

/**
 * The switch. ADR-048.
 *
 * docs/07 asks for one thing above everything else here: it must be genuinely
 * easy to turn off, and off must mean off. So it is off until somebody turns it
 * on, an owner can turn it off in one click, and turning it off stops work that
 * is already queued -- that last part is enforced in SQL, at claim time, not
 * here.
 */

export class TriageUnavailable extends DomainError {
  constructor(what = "The triage agent is part of the Team plan") {
    super(what, "triage_unavailable", 403);
  }
}

export type TriageSetting = {
  spaceId: string;
  name: string;
  role: string;
  plan: string;
  enabled: boolean;
  /** Whether the plan allows it at all. Mirrors app_plan_allows_triage. */
  available: boolean;
  lastRunAt: Date | null;
};

/** Team only, per docs/01. The database has the same rule and enforces it;
 *  this copy exists so the UI can explain itself without a round trip. */
export const planAllowsTriage = (plan: string): boolean => plan === "team";

export async function listTriageSettings(actor: Actor): Promise<TriageSetting[]> {
  return withActor(actor.userId, async (tx) => {
    const rows = await tx.select({
      spaceId: spaces.id,
      name: spaces.name,
      plan: spaces.plan,
      enabled: spaces.triageEnabled,
      lastRunAt: spaces.triageLastRunAt,
      role: spaceMembers.role,
    })
      .from(spaces)
      .innerJoin(spaceMembers, eq(spaceMembers.spaceId, spaces.id))
      .where(eq(spaceMembers.userId, actor.userId));

    return rows
      .filter((r) => canReachSpace(actor, r.spaceId))
      .map((r) => ({ ...r, available: planAllowsTriage(r.plan) }));
  });
}

/**
 * Turn it on or off for one space.
 *
 * Owners only, because it spends the space's allowance and speaks to everyone
 * in it. Switching ON is refused on a plan that does not include it rather than
 * accepted and quietly ignored -- a switch that flips and does nothing is worse
 * than one that will not flip.
 */
export async function setTriage(
  actor: Actor, spaceId: string, on: boolean,
): Promise<void> {
  await withActor(actor.userId, async (tx) => {
    await assertOwner(tx, actor, spaceId);

    const found = await tx.select({ plan: spaces.plan }).from(spaces)
      .where(eq(spaces.id, spaceId)).limit(1);
    const plan = found[0]?.plan;
    if (!plan) throw new NotFound("That space does not exist, or you cannot reach it");
    if (on && !planAllowsTriage(plan)) {
      throw new TriageUnavailable();
    }

    await tx.update(spaces).set({ triageEnabled: on }).where(eq(spaces.id, spaceId));
  });
}
