import { and, asc, eq } from "drizzle-orm";
import { withActor, comments, notes, mcpClients, users } from "@jotacular/db";
import { attribution, canReachSpace, hasScope, type Actor } from "./actor";
import { DomainError, Forbidden, NotFound } from "./errors";
import { assertAgentMayWrite } from "./plans";
import { audit } from "./note-body";

export type CommentView = {
  id: string;
  body: string;
  authorType: "user" | "agent";
  authorLabel: string;
  /** The object on the page this is about, or null for the page as a whole.
   *  ADR-107. */
  anchorId: string | null;
  /** Set once somebody has dealt with it. An agent's remarks pile up on a note
   *  otherwise, and a list that only grows is a list nobody reads. */
  resolvedAt: Date | null;
  createdAt: Date;
};

/**
 * The default agent output. ADR-004.
 *
 * An agent's normal way of saying something is a comment, not an edit: prompt
 * injection through note content is unpreventable, so the mitigation has to be
 * that what an agent writes is non-destructive and reviewable.
 */
export async function commentOnNote(
  actor: Actor, noteId: string, body: string, anchorId?: string | null,
): Promise<CommentView> {
  if (!hasScope(actor, "notes:comment")) {
    throw new Forbidden("This connection cannot leave comments");
  }
  const text = body.trim();
  if (!text) throw new NotFound("Nothing to say");
  const anchor = anchorOf(anchorId);

  return withActor(actor.userId, async (tx) => {
    const found = await tx.select({ spaceId: notes.spaceId }).from(notes)
      .where(eq(notes.id, noteId)).limit(1);
    const note = found[0];
    if (!note || !canReachSpace(actor, note.spaceId)) {
      throw new NotFound("That note does not exist, or you cannot reach it");
    }
    await assertAgentMayWrite(tx, actor, note.spaceId);

    const row = (await tx.insert(comments).values({
      noteId,
      spaceId: note.spaceId,
      body: text,
      anchorId: anchor,
      ...attribution(actor),
    }).returning())[0]!;

    // The single highest-signal event in a shared space, and it was not
    // recorded at all until ADR-063. The comment id goes in the metadata so
    // the feed can say WHAT was said without a query per row.
    await audit(tx, actor, note.spaceId, "note.comment", noteId, undefined, {
      commentId: row.id,
      ...(anchor ? { anchorId: anchor } : {}),
    });

    return {
      id: row.id,
      body: row.body,
      authorType: row.authorType as "user" | "agent",
      authorLabel: actor.type === "agent" ? "agent" : "you",
      anchorId: row.anchorId,
      resolvedAt: row.resolvedAt,
      createdAt: row.createdAt,
    };
  });
}

export async function listNoteComments(actor: Actor, noteId: string): Promise<CommentView[]> {
  return withActor(actor.userId, async (tx) => {
    const found = await tx.select({ spaceId: notes.spaceId }).from(notes)
      .where(eq(notes.id, noteId)).limit(1);
    const note = found[0];
    if (!note || !canReachSpace(actor, note.spaceId)) {
      throw new NotFound("That note does not exist, or you cannot reach it");
    }

    const rows = await tx.select({
      id: comments.id,
      body: comments.body,
      authorType: comments.authorType,
      authorUserId: comments.authorUserId,
      agentClientId: comments.agentClientId,
      anchorId: comments.anchorId,
      resolvedAt: comments.resolvedAt,
      createdAt: comments.createdAt,
      userName: users.displayName,
      clientName: mcpClients.clientName,
      agentModel: comments.agentModel,
    })
      .from(comments)
      .leftJoin(users, eq(users.id, comments.authorUserId))
      .leftJoin(mcpClients, eq(mcpClients.id, comments.agentClientId))
      .where(eq(comments.noteId, noteId))
      .orderBy(asc(comments.createdAt));

    return rows.map((r) => ({
      id: r.id,
      body: r.body,
      authorType: r.authorType as "user" | "agent",
      // Every agent-authored thing carries a label, never colour alone.
      // docs/10-design-system.md, accessibility. An agent with no MCP client
      // behind it is ours, running on a schedule -- the triage agent (ADR-048).
      authorLabel: r.authorType === "agent"
        ? [r.clientName ?? (r.agentClientId ? "An agent" : "Triage"), r.agentModel]
          .filter(Boolean).join(" · ")
        // "you" for your own, the way commentOnNote labels one the moment it
        // is written. Without this a comment renamed itself on the next load.
        : r.authorUserId === actor.userId ? "you" : r.userName ?? "Someone",
      anchorId: r.anchorId,
      resolvedAt: r.resolvedAt,
      createdAt: r.createdAt,
    }));
  });
}

/**
 * Mark a comment dealt with.
 *
 * Not a delete. What an agent said and when it said it is part of the record --
 * docs/13 -- and a proposal that turned out to be wrong is more useful kept
 * than quietly removed.
 */
export async function resolveComment(actor: Actor, commentId: string): Promise<void> {
  await withActor(actor.userId, async (tx) => {
    const rows = await tx.update(comments)
      .set({ resolvedAt: new Date() })
      .where(eq(comments.id, commentId))
      .returning({ spaceId: comments.spaceId });
    const row = rows[0];
    if (!row || !canReachSpace(actor, row.spaceId)) {
      throw new NotFound("That comment does not exist, or you cannot reach it");
    }
  });
}

/**
 * The object this comment is about, checked at the boundary.
 *
 * Never a foreign key: the objects live inside a jsonb document, so the only
 * thing that can be enforced here is the shape of a name. Migration 0035 holds
 * the same rule, and an object that is later erased keeps its comments --
 * ADR-107 says why.
 */
function anchorOf(given: string | null | undefined): string | null {
  if (given === undefined || given === null) return null;
  const id = given.trim();
  if (!id) return null;
  if (id.length > 64) {
    throw new DomainError("That is not something on the page", "bad_anchor", 400);
  }
  return id;
}
