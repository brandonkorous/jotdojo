import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { withActor, spaceInvites, spaceMembers, users, type Tx } from "@jotdojo/db";
import type { Actor } from "./actor";
import { DomainError, Forbidden, NotFound } from "./errors";

const PREFIX = "jd_inv_";
const TTL_DAYS = 14;

/** Compared by hash, so the plaintext never reaches the database. */
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export type MemberSummary = {
  userId: string; email: string; displayName: string | null;
  avatarUrl: string | null; role: string; joinedAt: Date;
};

export type InviteSummary = {
  id: string; email: string; role: string; createdAt: Date;
  expiresAt: Date; acceptedAt: Date | null; revokedAt: Date | null;
};

/** Thrown when an invite cannot be accepted, with the reason preserved.
 *  ADR-020: a caller must be able to tell "expired" from "went wrong". */
export class InviteRejected extends DomainError {
  constructor(message: string, code: string) {
    super(message, code, 400);
  }
}

export async function assertOwner(tx: Tx, actor: Actor, spaceId: string): Promise<void> {
  const rows = await tx.select({ role: spaceMembers.role }).from(spaceMembers)
    .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, actor.userId)))
    .limit(1);
  if (rows[0]?.role !== "owner") throw new Forbidden("Only an owner can do that");
}

/**
 * Create a shared space.
 *
 * Through a SECURITY DEFINER door because there is deliberately no INSERT
 * policy on `spaces` or `space_members` -- account and space creation have
 * exactly one auditable entrance. ADR-024, ADR-035.
 */
export async function createSpace(
  actor: Actor, name: string, kind: "family" | "team",
): Promise<string> {
  const clean = name.trim();
  if (!clean) throw new InviteRejected("A space needs a name", "invalid_name");

  return withActor(actor.userId, async (tx) => {
    const rows = await tx.execute(
      sql`SELECT app_create_space(${clean}, ${kind}, ${actor.userId}::uuid) AS id`,
    );
    const row = (rows as unknown as Array<Record<string, unknown>>)[0];
    if (!row) throw new Error("app_create_space returned no row");
    return String(row.id);
  });
}

export async function listMembers(actor: Actor, spaceId: string): Promise<MemberSummary[]> {
  return withActor(actor.userId, async (tx) => {
    const rows = await tx.select({
      userId: users.id, email: users.email, displayName: users.displayName,
      avatarUrl: users.avatarUrl, role: spaceMembers.role, joinedAt: spaceMembers.joinedAt,
    })
      .from(spaceMembers)
      .innerJoin(users, eq(users.id, spaceMembers.userId))
      .where(eq(spaceMembers.spaceId, spaceId))
      .orderBy(desc(spaceMembers.role), spaceMembers.joinedAt);
    // RLS returns nothing rather than refusing, so say the difference out loud.
    if (rows.length === 0) throw new Forbidden("You are not in that space");
    return rows;
  });
}

/**
 * Invite someone by email. Returns the plaintext token exactly once.
 *
 * The token is the credential and the email is the binding: `app_accept_invite`
 * refuses if the accepting account's address differs, so a forwarded link is
 * useless to the person who received it by accident.
 */
export async function inviteToSpace(
  actor: Actor, spaceId: string, email: string, role: "owner" | "member" = "member",
): Promise<{ inviteId: string; token: string; expiresAt: Date }> {
  const address = email.trim().toLowerCase();
  if (!address.includes("@")) throw new InviteRejected("That is not an email address", "invalid_email");

  const token = PREFIX + randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);

  return withActor(actor.userId, async (tx) => {
    await assertOwner(tx, actor, spaceId);
    const [row] = await tx.insert(spaceInvites).values({
      spaceId, email: address, role, tokenHash: hash(token),
      invitedBy: actor.userId, expiresAt,
    }).returning({ id: spaceInvites.id });
    if (!row) throw new Error("invite insert returned no row");
    return { inviteId: row.id, token, expiresAt };
  });
}

export async function listInvites(actor: Actor, spaceId: string): Promise<InviteSummary[]> {
  return withActor(actor.userId, async (tx) => {
    return tx.select({
      id: spaceInvites.id, email: spaceInvites.email, role: spaceInvites.role,
      createdAt: spaceInvites.createdAt, expiresAt: spaceInvites.expiresAt,
      acceptedAt: spaceInvites.acceptedAt, revokedAt: spaceInvites.revokedAt,
    })
      .from(spaceInvites)
      .where(eq(spaceInvites.spaceId, spaceId))
      .orderBy(desc(spaceInvites.createdAt));
  });
}

export async function revokeInvite(actor: Actor, inviteId: string): Promise<void> {
  await withActor(actor.userId, async (tx) => {
    const res = await tx.update(spaceInvites)
      .set({ revokedAt: new Date() })
      .where(and(eq(spaceInvites.id, inviteId), isNull(spaceInvites.acceptedAt)))
      .returning({ id: spaceInvites.id });
    // The UPDATE policy is owner-only, so a non-owner simply matches no rows.
    if (res.length === 0) throw new NotFound("No invite to revoke");
  });
}

/**
 * Accept an invite. The one operation an outsider performs.
 *
 * Goes through SECURITY DEFINER because the invitee can see neither the space
 * nor the invite: every policy here is `app_can_reach_space`, and someone who
 * has not joined reaches nothing. Widening a policy to fix that would undo the
 * boundary; a door keyed by a secret does not. ADR-035.
 */
export async function acceptInvite(actor: Actor, token: string): Promise<string> {
  return withActor(actor.userId, async (tx) => {
    try {
      const rows = await tx.execute(
        sql`SELECT app_accept_invite(${hash(token)}, ${actor.userId}::uuid) AS space_id`,
      );
      const row = (rows as unknown as Array<Record<string, unknown>>)[0];
      if (!row) throw new Error("app_accept_invite returned no row");
      return String(row.space_id);
    } catch (err) {
      throw asInviteError(err);
    }
  });
}

/** Postgres RAISE messages, mapped back to codes a caller can branch on. */
function asInviteError(err: unknown): Error {
  const message = (err as { message?: string }).message ?? "";
  const known: [string, string][] = [
    ["no such invite", "invite_unknown"],
    ["invite revoked", "invite_revoked"],
    ["invite already used", "invite_used"],
    ["invite expired", "invite_expired"],
    ["different address", "invite_wrong_account"],
  ];
  for (const [needle, code] of known) {
    if (message.includes(needle)) return new InviteRejected(message, code);
  }
  return err as Error;
}

/** Change someone's role. The last owner is protected by a trigger, not here:
 *  there are three ways to strand a space and only one of them is obvious. */
export async function setMemberRole(
  actor: Actor, spaceId: string, userId: string, role: "owner" | "member",
): Promise<void> {
  await withActor(actor.userId, async (tx) => {
    await assertOwner(tx, actor, spaceId);
    const res = await tx.update(spaceMembers).set({ role })
      .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, userId)))
      .returning({ userId: spaceMembers.userId });
    if (res.length === 0) throw new NotFound("That person is not in this space");
  });
}

/** Remove a member. Anyone may remove themselves; only an owner may remove
 *  someone else -- leaving should never require asking whoever added you. */
export async function removeMember(
  actor: Actor, spaceId: string, userId: string,
): Promise<void> {
  await withActor(actor.userId, async (tx) => {
    if (userId !== actor.userId) await assertOwner(tx, actor, spaceId);
    const res = await tx.delete(spaceMembers)
      .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, userId)))
      .returning({ userId: spaceMembers.userId });
    if (res.length === 0) throw new NotFound("That person is not in this space");
  });
}

export type SpaceUsage = {
  plan: string; used: number; allowance: number;
  periodStart: Date; over: boolean;
};

/**
 * What this space has spent on recognition this period, and what it is allowed.
 *
 * Shown rather than hidden. docs/11-copy-and-tone.md is explicit that a limit
 * people cannot see is a limit they experience as a bug -- and ADR-007's whole
 * point is that capture keeps working, so the number has to explain why a
 * transcript has not appeared yet.
 */
export async function spaceUsage(actor: Actor, spaceId: string): Promise<SpaceUsage> {
  return withActor(actor.userId, async (tx) => {
    const rows = await tx.execute(sql`
      SELECT s.plan,
             app_space_usage(s.id)             AS used,
             app_plan_allowance(s.plan)        AS allowance,
             app_period_start()                AS period_start,
             app_space_over_quota(s.id)        AS over
        FROM spaces s WHERE s.id = ${spaceId}::uuid
    `);
    const row = (rows as unknown as Array<Record<string, unknown>>)[0];
    // RLS hides a space you cannot reach, so "no row" means "not yours".
    if (!row) throw new Forbidden("You are not in that space");
    return {
      plan: String(row.plan),
      used: Number(row.used),
      allowance: Number(row.allowance),
      periodStart: new Date(String(row.period_start)),
      over: Boolean(row.over),
    };
  });
}
