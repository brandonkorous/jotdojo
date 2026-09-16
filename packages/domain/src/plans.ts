import { sql } from "drizzle-orm";
import type { Tx } from "@jotacular/db";
import { DomainError } from "./errors";
import type { Actor } from "./actor";

/**
 * Free reads, paid writes. docs/01-audience-and-pricing.md, ADR-042.
 *
 * The pricing doc calls this the most important decision it contains, and the
 * reasoning is worth keeping next to the code: watching an agent read a photo of
 * your own napkin is the moment the product makes sense, and putting THAT behind
 * a card kills the word of mouth that is our only distribution. So reading is
 * free forever, and the fence sits exactly where a neat demo becomes part of
 * somebody's workflow -- which is also where our costs begin.
 */

export class PlanRequired extends DomainError {
  constructor(what: string) {
    super(what, "plan_read_only", 403);
  }
}

const READ_ONLY = new Set(["free", "anon"]);

/** Whether an agent may write in a space on this plan. Exported so a screen can
 *  describe the fence rather than guess at it, and so both answers come from
 *  the same set. Issue 017. */
export const agentMayWrite = (plan: string): boolean => !READ_ONLY.has(plan);

/**
 * Checked at USE time rather than granted at consent time.
 *
 * A grant made while a space was free would otherwise stay read-only after the
 * upgrade, and a grant made while it was paid would keep writing after the
 * subscription ended. Entitlement is a live property of the space, the same way
 * the recognition allowance is.
 *
 * Only agents are fenced. A person writing in their own space is not a cost we
 * are metering, and a capture token is the person, through a narrower door.
 */
export async function assertAgentMayWrite(
  tx: Tx, actor: Actor, spaceId: string,
): Promise<void> {
  if (actor.type !== "agent") return;

  const rows = await tx.execute(sql`SELECT plan FROM spaces WHERE id = ${spaceId}::uuid`);
  const plan = String((rows as unknown as Array<Record<string, unknown>>)[0]?.plan ?? "free");
  if (!READ_ONLY.has(plan)) return;

  // The second sentence is the whole point: a refusal that names the fence and
  // not the gate sends somebody off to hunt for a pricing page from inside a
  // chat window, which is where they stop. Issue 021.
  throw new PlanRequired(
    "This space is on the free plan, where an agent can read but not write. "
    + "Solo and up can — change it in Jotacular under Account, What you are on.",
  );
}
