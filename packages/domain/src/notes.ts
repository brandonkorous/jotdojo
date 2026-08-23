import { and, eq, isNull } from "drizzle-orm";
import { withActor, notes, blocks } from "@jotdojo/db";
import { canReachSpace, hasScope, type Actor } from "./actor";
import { assertAgentMayWrite } from "./plans";
import { Forbidden, NotFound, RevisionConflict } from "./errors";
import { assertMember } from "./spaces";
import {
  inferTitle, previewOf, audit, queueEmbedding, readBody, readBlocks, writeRevision,
  announceSaved, writeTextBlock,
  type NoteBlock,
} from "./note-body";
export { readBlocks, type NoteBlock } from "./note-body";

export type NoteSummary = {
  id: string; title: string | null; preview: string; pinned: boolean;
  updatedAt: Date; revision: number;
};

export type NoteDetail = NoteSummary & {
  spaceId: string;
  /** Typed text only. See readBody. */
  body: string;
  /** Every block including ink, for callers that render the whole note. */
  blocks?: NoteBlock[];
};

export async function createNote(
  actor: Actor, spaceId: string, body = "",
): Promise<NoteDetail> {
  // Both scopes permit creating a note. capture:write simply permits nothing
  // else -- see the capture actor in actor.ts.
  if (!hasScope(actor, "notes:write") && !hasScope(actor, "capture:write")) {
    throw new Forbidden("This connection cannot create notes");
  }

  if (!canReachSpace(actor, spaceId)) throw new Forbidden("This connection cannot reach that space");

  return withActor(actor.userId, async (tx) => {
    await assertMember(tx, actor, spaceId);
    await assertAgentMayWrite(tx, actor, spaceId);

    const note = (await tx.insert(notes).values({
      spaceId,
      title: inferTitle(body),
      titleSource: "inferred",
      createdBy: actor.userId,
    }).returning())[0]!;

    await tx.insert(blocks).values({
      noteId: note.id, spaceId, position: 0, kind: "text", body,
      transcriptState: "ready",
    });

    await writeRevision(tx, actor, note, body, "created");
    await audit(tx, actor, spaceId, "note.create", note.id);
    if (body.trim()) await queueEmbedding(tx, note.id, note.revision);

    return {
      id: note.id, spaceId, title: note.title, preview: previewOf(body),
      pinned: note.pinned, updatedAt: note.updatedAt, revision: note.revision, body,
    };
  });
}

export async function getNote(actor: Actor, noteId: string): Promise<NoteDetail> {
  return withActor(actor.userId, async (tx) => {
    const rows = await tx.select().from(notes)
      .where(and(eq(notes.id, noteId), isNull(notes.deletedAt))).limit(1);
    const note = rows[0];
    if (!note) throw new NotFound("That note does not exist, or you cannot reach it");
    // An agent granted your personal space must not see the family one. The
    // same 404 either way -- a different error would confirm the note exists.
    if (!canReachSpace(actor, note.spaceId)) {
      throw new NotFound("That note does not exist, or you cannot reach it");
    }

    const body = await readBody(tx, note.id);
    const noteBlocks = await readBlocks(tx, note.id);
    await audit(tx, actor, note.spaceId, "note.read", note.id);

    return {
      blocks: noteBlocks,
      id: note.id, spaceId: note.spaceId, title: note.title, preview: previewOf(body),
      pinned: note.pinned, updatedAt: note.updatedAt, revision: note.revision, body,
    };
  });
}

/**
 * Just the typed body, for a device catching up on somebody else's save.
 *
 * Deliberately does NOT write an audit row, where getNote does. This is a
 * device that already has the note open -- its read was audited when it opened
 * it -- coming back for the version it was just told about. Auditing every one
 * would put a row in the log per keystroke-debounce of whoever is typing on the
 * other device, and bury the reads that mean something. ADR-058.
 */
export async function noteBody(
  actor: Actor, noteId: string,
): Promise<{ body: string; revision: number; title: string | null }> {
  return withActor(actor.userId, async (tx) => {
    const rows = await tx.select({
      revision: notes.revision, title: notes.title, spaceId: notes.spaceId,
    }).from(notes).where(and(eq(notes.id, noteId), isNull(notes.deletedAt))).limit(1);
    const note = rows[0];
    if (!note || !canReachSpace(actor, note.spaceId)) {
      throw new NotFound("That note does not exist, or you cannot reach it");
    }
    return { body: await readBody(tx, noteId), revision: note.revision, title: note.title };
  });
}

/**
 * Save the body of a note.
 *
 * Optimistic concurrency on `revision`. On conflict we throw rather than merge:
 * the caller is handed the current revision so the losing copy can be kept as a
 * duplicate and flagged. Never silently merge, never silently discard.
 */
export async function saveNote(
  actor: Actor, noteId: string, body: string, expectedRevision: number,
): Promise<NoteDetail> {
  if (!hasScope(actor, "notes:edit")) throw new Forbidden("This connection cannot edit notes");

  const saved = await withActor(actor.userId, async (tx) => {
    const rows = await tx.select().from(notes)
      .where(and(eq(notes.id, noteId), isNull(notes.deletedAt))).limit(1);
    const note = rows[0];
    if (!note) throw new NotFound("That note does not exist, or you cannot reach it");
    if (!canReachSpace(actor, note.spaceId)) {
      throw new NotFound("That note does not exist, or you cannot reach it");
    }
    await assertAgentMayWrite(tx, actor, note.spaceId);
    if (note.revision !== expectedRevision) throw new RevisionConflict(note.revision);

    const nextRevision = note.revision + 1;
    const title = note.titleSource === "user" ? note.title : inferTitle(body);

    await tx.update(notes)
      .set({ revision: nextRevision, title, updatedAt: new Date() })
      .where(eq(notes.id, noteId));

    await writeTextBlock(tx, note, body);

    await writeRevision(
      tx, actor, { ...note, revision: nextRevision }, body,
      actor.type === "agent" ? "edited by agent" : "edited",
    );
    await audit(tx, actor, note.spaceId, "note.update", noteId);

    await queueEmbedding(tx, noteId, nextRevision);

    return {
      id: noteId, spaceId: note.spaceId, title, preview: previewOf(body),
      pinned: note.pinned, updatedAt: new Date(), revision: nextRevision, body,
    };
  });

  announceSaved(saved);
  return saved;
}

/**
 * Append blocks to the end of a note.
 *
 * The preferred agent write: non-destructive by construction, so nothing an
 * agent adds can remove what a person wrote. `update_note` exists but is
 * deliberately harder to reach. ADR-004.
 */
export async function appendToNote(
  actor: Actor, noteId: string, text: string,
): Promise<NoteDetail> {
  if (!hasScope(actor, "notes:append")) {
    throw new Forbidden("This connection cannot add to notes");
  }
  const addition = text.trim();
  if (!addition) throw new NotFound("Nothing to append");

  const current = await getNote(actor, noteId);
  const merged = current.body.trim() ? `${current.body.trimEnd()}

${addition}` : addition;

  const appended = await withActor(actor.userId, async (tx) => {
    const rows = await tx.select().from(notes).where(eq(notes.id, noteId)).limit(1);
    const note = rows[0];
    if (!note) throw new NotFound();
    await assertAgentMayWrite(tx, actor, note.spaceId);

    const nextRevision = note.revision + 1;
    await tx.update(notes)
      .set({ revision: nextRevision, updatedAt: new Date() })
      .where(eq(notes.id, noteId));

    await writeTextBlock(tx, note, merged);

    await writeRevision(tx, actor, { ...note, revision: nextRevision }, merged,
      actor.type === "agent" ? "appended by agent" : "appended");
    await audit(tx, actor, note.spaceId, "note.append", noteId);
    await queueEmbedding(tx, noteId, nextRevision);

    return {
      id: noteId, spaceId: note.spaceId, title: note.title,
      preview: previewOf(merged), pinned: note.pinned,
      updatedAt: new Date(), revision: nextRevision, body: merged,
    };
  });

  // The commonest live update that is not a person: an agent adding to a note
  // somebody has open. Watching it arrive is the whole demo.
  announceSaved(appended);
  return appended;
}
