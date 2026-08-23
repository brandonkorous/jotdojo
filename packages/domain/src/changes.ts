import { sql } from "drizzle-orm";
import { withActor, withoutActor, type Tx } from "@jotdojo/db";
import { canReachSpace, type Actor } from "./actor";
import { Forbidden } from "./errors";
import { assertMember } from "./spaces";
import { eventWindowSql, type TimeWindow } from "./time-window";

/**
 * What has been going on. ADR-063.
 *
 * An agent asked "anything new?" had no way to answer before this. `list_notes`
 * says which notes are recent, which is not the same question: a note whose
 * handwriting was finally read, or that somebody commented on, has changed in a
 * way its position in a list cannot express.
 *
 * Built on audit_log, which already had the shape and the index. What it did
 * not have was anything worth reading -- see 0030.
 */

export type Change = {
  at: Date;
  /** `note.create`, `note.comment`, `note.transcript`, ... */
  action: string;
  noteId: string | null;
  noteTitle: string | null;
  /** Who, in words: "you", "an agent", or "jotdojo". Never a uuid. */
  who: string;
  /** The MCP tool used, when a tool was used. */
  toolName: string | null;
  /** For a comment, what it said. The feed is useless if reading it requires a
   *  second call per row. */
  detail: string | null;
};

export type ChangeOptions = TimeWindow & { limit?: number };

export async function listChanges(
  actor: Actor, spaceId: string, options: ChangeOptions = {},
): Promise<Change[]> {
  if (!canReachSpace(actor, spaceId)) {
    throw new Forbidden("This connection cannot reach that space");
  }
  const limit = Math.min(options.limit ?? 50, 200);

  return withActor(actor.userId, async (tx) => {
    // Refused rather than empty, for the reason searchNotes gives. ADR-020.
    await assertMember(tx, actor, spaceId);

    const rows = await tx.execute(sql`
      SELECT a.created_at, a.action, a.target_id, a.actor_type, a.actor_user_id,
             a.tool_name, n.title, c.body AS comment_body
        FROM audit_log a
        LEFT JOIN notes n ON n.id = a.target_id
        -- The comment this row is about, when it is about one. A feed that
        -- says "somebody commented" and makes you fetch the note to find out
        -- what they said is a notification, not a feed.
        LEFT JOIN LATERAL (
          SELECT body FROM comments WHERE id = (a.metadata ->> 'commentId')::uuid
        ) c ON a.action = 'note.comment'
       -- A READ IS NOT A CHANGE. note.read outnumbers everything else put
       -- together -- get_note writes one per call -- and including it would
       -- bury the events somebody actually wants. audit_log_changes_idx is
       -- partial on exactly this predicate.
       WHERE a.space_id = ${spaceId}
         AND a.action <> 'note.read'
         ${eventWindowSql(options)}
       ORDER BY a.created_at DESC
       LIMIT ${limit}
    `);

    return (rows as unknown as Array<Record<string, unknown>>).map((r) => shape(r, actor));
  });
}

function shape(r: Record<string, unknown>, actor: Actor): Change {
  const actorType = String(r.actor_type);
  return {
    at: new Date(String(r.created_at)),
    action: String(r.action),
    noteId: (r.target_id as string | null) ?? null,
    noteTitle: (r.title as string | null) ?? null,
    who: describe(actorType, (r.actor_user_id as string | null) ?? null, actor),
    toolName: (r.tool_name as string | null) ?? null,
    detail: (r.comment_body as string | null) ?? null,
  };
}

/**
 * Who did it, in words a person would use.
 *
 * Never a uuid: this is read by an agent that will quote it back, and "user
 * 4f3a-… commented" is not a sentence anybody says. A second member of a shared
 * space is "someone else" rather than their name, because audit_log does not
 * join to a display name and inventing one here would be a second source of
 * truth for something the members list already owns.
 */
function describe(actorType: string, actorUserId: string | null, actor: Actor): string {
  if (actorType === "system") return "jotdojo";
  if (actorType === "agent") return "an agent";
  if (actorUserId && actorUserId === actor.userId) return "you";
  return "someone else in this space";
}

/**
 * Record something the worker did, with no actor to attribute it to.
 *
 * Goes through app_record_change because the worker runs inside `withoutActor`,
 * where audit_log's policy matches nothing -- a plain INSERT there does not
 * fail, it writes zero rows and reports success. ADR-057, and 0030 says it at
 * length.
 */
export async function recordSystemChange(
  spaceId: string, action: string, targetId: string | null, metadata?: unknown,
): Promise<void> {
  await withoutActor(async (tx) => writeChange(tx, spaceId, action, targetId, metadata));
}

/** The same, inside a transaction the caller already holds. */
export async function writeChange(
  tx: Tx, spaceId: string, action: string, targetId: string | null, metadata?: unknown,
): Promise<void> {
  await tx.execute(sql`
    SELECT app_record_change(
      ${spaceId}::uuid, ${action}, ${targetId}::uuid,
      ${metadata === undefined ? null : JSON.stringify(metadata)}::jsonb
    )
  `);
}
