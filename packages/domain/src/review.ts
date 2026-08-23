import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import {
  withActor, notes, blocks, noteRevisions, mcpClients, type Tx,
} from "@jotacular/db";
import { canReachSpace, type Actor } from "./actor";
import { Forbidden, NotFound } from "./errors";

/**
 * The review inbox. docs/02-product-spec.md, ADR-004, ADR-037.
 *
 * A safety control wearing a product feature's clothes: prompt injection
 * through note content cannot be prevented, so the mitigation is that agent
 * writes are attributed, visible and reversible rather than somehow safe.
 *
 * No schema was added for this. `note_revisions` has carried `author_type`,
 * `agent_client_id`, `agent_model` and `reverted_at` since 0000_init.sql.
 */

export type AgentChange = {
  revisionId: string;
  noteId: string;
  noteTitle: string | null;
  spaceId: string;
  revision: number;
  summary: string | null;
  agentName: string | null;
  agentModel: string | null;
  createdAt: Date;
  revertedAt: Date | null;
};

/**
 * Everything an agent changed, newest first.
 *
 * Reverted entries stay in the list. A review inbox that hides what you already
 * dealt with cannot answer "what has this agent been doing", which is the
 * question that matters after something goes wrong.
 */
export async function listAgentChanges(
  actor: Actor, opts: { spaceId?: string; limit?: number } = {},
): Promise<AgentChange[]> {
  if (actor.type !== "user") {
    throw new Forbidden("Only a person reviews agent changes");
  }
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);

  return withActor(actor.userId, async (tx) => {
    const where = opts.spaceId
      ? and(eq(noteRevisions.authorType, "agent"), eq(noteRevisions.spaceId, opts.spaceId))
      : eq(noteRevisions.authorType, "agent");

    return tx.select({
      revisionId: noteRevisions.id,
      noteId: noteRevisions.noteId,
      noteTitle: notes.title,
      spaceId: noteRevisions.spaceId,
      revision: noteRevisions.revision,
      summary: noteRevisions.summary,
      agentName: mcpClients.clientName,
      agentModel: noteRevisions.agentModel,
      createdAt: noteRevisions.createdAt,
      revertedAt: noteRevisions.revertedAt,
    })
      .from(noteRevisions)
      .innerJoin(notes, eq(notes.id, noteRevisions.noteId))
      .leftJoin(mcpClients, eq(mcpClients.id, noteRevisions.agentClientId))
      .where(where)
      .orderBy(desc(noteRevisions.createdAt))
      .limit(limit);
  });
}

/** The body a note had before a given revision, or "" if that was its first. */
async function bodyBefore(tx: Tx, noteId: string, revision: number): Promise<string> {
  const prior = await tx.select({ snapshot: noteRevisions.snapshot })
    .from(noteRevisions)
    .where(and(eq(noteRevisions.noteId, noteId), lt(noteRevisions.revision, revision)))
    .orderBy(desc(noteRevisions.revision))
    .limit(1);

  const snapshot = prior[0]?.snapshot as { blocks?: { body?: string }[] } | undefined;
  // No earlier revision means the agent's edit was the note's first, so the
  // state before it was an empty note -- not an error.
  return snapshot?.blocks?.[0]?.body ?? "";
}

/**
 * Undo one agent change.
 *
 * Applied as a NEW revision rather than by deleting the old one. History stays
 * append-only, so "an agent wrote this and a person took it out again" remains
 * answerable -- which is the entire point of having the inbox.
 */
export async function revertRevision(
  actor: Actor, revisionId: string,
): Promise<{ noteId: string; revision: number; body: string }> {
  // Deliberately people only. An agent undoing its own edit, or another
  // agent's, would make the audit trail a conversation we are not part of.
  if (actor.type !== "user") throw new Forbidden("Only a person can revert a change");

  return withActor(actor.userId, async (tx) => {
    const found = await tx.select({
      id: noteRevisions.id, noteId: noteRevisions.noteId, spaceId: noteRevisions.spaceId,
      revision: noteRevisions.revision, revertedAt: noteRevisions.revertedAt,
      authorType: noteRevisions.authorType,
    })
      .from(noteRevisions).where(eq(noteRevisions.id, revisionId)).limit(1);

    const target = found[0];
    if (!target) throw new NotFound("No such change");
    if (!canReachSpace(actor, target.spaceId)) throw new NotFound("No such change");
    if (target.revertedAt) throw new Forbidden("That change was already reverted");

    const note = (await tx.select().from(notes)
      .where(and(eq(notes.id, target.noteId), isNull(notes.deletedAt))).limit(1))[0];
    if (!note) throw new NotFound("That note no longer exists");

    const body = await bodyBefore(tx, target.noteId, target.revision);
    const nextRevision = note.revision + 1;

    await tx.update(notes)
      .set({ revision: nextRevision, updatedAt: new Date() })
      .where(eq(notes.id, target.noteId));

    const existing = await tx.select({ id: blocks.id }).from(blocks)
      .where(and(eq(blocks.noteId, target.noteId), eq(blocks.position, 0))).limit(1);
    if (existing[0]) {
      await tx.update(blocks).set({ body }).where(eq(blocks.id, existing[0].id));
    }

    await tx.insert(noteRevisions).values({
      noteId: target.noteId,
      spaceId: target.spaceId,
      revision: nextRevision,
      snapshot: { blocks: [{ kind: "text", body }] },
      summary: "reverted an agent change",
      authorType: "user",
      authorUserId: actor.userId,
      agentClientId: null,
      agentModel: null,
    });

    // Mark the original, so the inbox can show it as dealt with and so it
    // cannot be reverted twice.
    await tx.update(noteRevisions)
      .set({ revertedAt: new Date() })
      .where(eq(noteRevisions.id, revisionId));

    // The note's searchable text changed, so it has to be re-embedded. Same
    // coalescing insert as notes.ts: one pending job per note is enough,
    // because the worker reads the block at claim time, not at queue time.
    await tx.execute(sql`
      INSERT INTO outbox (topic, payload)
      SELECT 'block.embed', jsonb_build_object(
        'noteId', ${target.noteId}::text, 'revision', ${nextRevision}::int)
       WHERE NOT EXISTS (
         SELECT 1 FROM outbox o
          WHERE o.topic = 'block.embed'
            AND o.completed_at IS NULL
            AND o.payload ->> 'noteId' = ${target.noteId}
       )
    `);

    return { noteId: target.noteId, revision: nextRevision, body };
  });
}
