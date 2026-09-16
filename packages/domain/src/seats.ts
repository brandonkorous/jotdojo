import { sql } from "drizzle-orm";
import { withActor, type Tx } from "@jotacular/db";
import type { Actor } from "./actor";
import { DomainError, Forbidden, NotFound } from "./errors";

/**
 * How many people a plan holds, and whether there is room. ADR-112.
 *
 * Split from members.ts when that file reached its size limit, and the seam is
 * a fair one: members.ts is the LIFECYCLE of a membership -- inviting,
 * accepting, revoking, changing a role -- and this is one rule about how many
 * of them a space may have. Only one of the two changes when the pricing does.
 *
 * A CAP, not metered overage. The marketing page says "more than five people
 * on a team? write to us", so a hard cap is what is sold and a hard cap is
 * what this enforces. `app_plan_seats` in migration 0036 is the number.
 */

/** Thrown when a space has no seat left. Its own type, because the account
 *  page offers an upgrade for this and nothing else. */
export class SpaceFull extends DomainError {
  constructor(message: string) {
    super(message, "space_full", 409);
  }
}

export type Seats = {
  /** What the plan allows. */
  seats: number;
  /** Members plus invites that have not been used, revoked or expired. */
  taken: number;
  /** May be negative for a space that was already over when 0036 shipped.
   *  Nobody is ever removed; the cap decides who may JOIN. */
  left: number;
};

/** What an owner sees beside the usage figure. */
export async function spaceSeats(actor: Actor, spaceId: string): Promise<Seats> {
  return withActor(actor.userId, async (tx) => {
    const rows = await tx.execute(sql`
      SELECT app_plan_seats(s.plan)        AS seats,
             app_space_seats_taken(s.id)   AS taken,
             app_space_seats_left(s.id)    AS seats_left
        FROM spaces s WHERE s.id = ${spaceId}::uuid
    `);
    const row = (rows as unknown as Array<Record<string, unknown>>)[0];
    // RLS hides a space you cannot reach, so "no row" means "not yours".
    if (!row) throw new Forbidden("You are not in that space");
    return {
      seats: Number(row.seats), taken: Number(row.taken), left: Number(row.seats_left),
    };
  });
}

/**
 * Refuse an invite that has nowhere to land.
 *
 * Checked HERE as well as in `app_accept_invite`, and the duplication is the
 * point: the database is what makes the cap TRUE, and this is what makes it
 * KIND. Without it an owner sends the invite, the email goes out, and the
 * person who clicks the link is the one who finds out the space is full.
 *
 * Re-inviting somebody who is already a member or already has a live invite is
 * not a new seat, so it is allowed on a full space -- otherwise resending a
 * lost invite to the sixth member of a Family would be refused.
 */
export async function assertSeatFree(
  tx: Tx, spaceId: string, email: string,
): Promise<void> {
  const rows = await tx.execute(sql`
    SELECT app_space_seats_left(${spaceId}::uuid) AS seats_left,
           app_plan_seats((SELECT plan FROM spaces WHERE id = ${spaceId}::uuid)) AS seats,
           EXISTS (SELECT 1 FROM space_members m JOIN users u ON u.id = m.user_id
                    WHERE m.space_id = ${spaceId}::uuid AND u.email = ${email}) AS is_member,
           EXISTS (SELECT 1 FROM space_invites
                    WHERE space_id = ${spaceId}::uuid AND email = ${email}
                      AND accepted_at IS NULL AND revoked_at IS NULL
                      AND expires_at > now()) AS is_invited
  `);
  const row = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!row) throw new NotFound("No such space");
  if (row.is_member === true || row.is_invited === true) return;
  if (Number(row.seats_left ?? 0) >= 1) return;

  throw new SpaceFull(full(Number(row.seats ?? 1)));
}

/**
 * What to say. docs/11: name the limit and the way past it, in that order.
 *
 * A plan of one is a different sentence from a plan that filled up, because
 * the first is a person who never had room and the second is a space that ran
 * out of it.
 */
function full(seats: number): string {
  if (seats === 1) return "This plan is for one person. A Family space holds six.";
  return `This space is full. It holds ${seats} people, counting invites`
    + " nobody has used yet.";
}
