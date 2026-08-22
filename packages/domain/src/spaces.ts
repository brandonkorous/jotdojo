import { and, eq, sql } from "drizzle-orm";
import { withActor, withoutActor, spaces, spaceMembers, users, type Tx } from "@jotdojo/db";
import { canReachSpace, type Actor } from "./actor";
import { Forbidden } from "./errors";

export type SpaceSummary = { id: string; name: string; kind: string; role: string };

/**
 * Resolve a Google identity to a user, creating them and their personal space
 * on first sign-in.
 *
 * Runs without an actor because there is no actor yet -- this is one of the two
 * sanctioned uses of withoutActor (see packages/db/src/client.ts).
 */
export async function upsertUserFromGoogle(input: {
  googleSub: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}): Promise<{ id: string; isNew: boolean }> {
  // Sign-in happens before there is an actor, so it cannot satisfy any RLS
  // policy. Rather than granting the app blanket INSERT on users, spaces and
  // space_members, account creation goes through one SECURITY DEFINER function
  // -- see migrations/0003_provision_user.sql.
  return withoutActor(async (tx) => {
    const rows = await tx.execute(sql`
      SELECT user_id, is_new FROM app_provision_user(
        ${input.googleSub},
        ${input.email},
        ${input.displayName ?? null},
        ${input.avatarUrl ?? null}
      )
    `);

    const row = (rows as unknown as Array<Record<string, unknown>>)[0];
    if (!row) throw new Error("app_provision_user returned no row");
    return { id: String(row.user_id), isNew: Boolean(row.is_new) };
  });
}

export async function listSpaces(actor: Actor): Promise<SpaceSummary[]> {
  return withActor(actor.userId, async (tx) => {
    const rows = await tx.select({
      id: spaces.id, name: spaces.name, kind: spaces.kind, role: spaceMembers.role,
    })
      .from(spaces)
      .innerJoin(spaceMembers, eq(spaceMembers.spaceId, spaces.id))
      .where(eq(spaceMembers.userId, actor.userId));
    // An agent sees only what it was granted, not everything its user can reach.
    return rows.filter((r) => canReachSpace(actor, r.id));
  });
}

/** The space a bare capture lands in when the user has not picked one. */
export async function defaultSpaceId(actor: Actor): Promise<string> {
  const all = await listSpaces(actor);
  const personal = all.find((s) => s.kind === "personal") ?? all[0];
  if (!personal) throw new Error(`user ${actor.userId} has no spaces`);
  return personal.id;
}

/** Defence in depth: RLS already enforces this, but say it out loud too. */
export async function assertMember(tx: Tx, actor: Actor, spaceId: string): Promise<void> {
  const rows = await tx.select({ role: spaceMembers.role }).from(spaceMembers)
    .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, actor.userId)))
    .limit(1);
  if (!rows[0]) throw new Forbidden();
}

export type ToolbarSide = "auto" | "left" | "right";

/**
 * Which side the tool rail sits on. ADR-012.
 *
 * Lives here rather than being read from the db in a page component: only the
 * domain layer talks to @jotdojo/db, so that the web app, the REST API and the
 * MCP server all reach the same rule through the same door.
 */
export async function getToolbarSide(actor: Actor): Promise<ToolbarSide> {
  return withActor(actor.userId, async (tx) => {
    const rows = await tx.select({ side: users.toolbarSide }).from(users)
      .where(eq(users.id, actor.userId)).limit(1);
    return (rows[0]?.side ?? "auto") as ToolbarSide;
  });
}

export async function setToolbarSide(actor: Actor, side: ToolbarSide) {
  await withActor(actor.userId, async (tx) => {
    await tx.update(users).set({ toolbarSide: side }).where(eq(users.id, actor.userId));
  });
}
