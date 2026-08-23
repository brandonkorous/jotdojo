import { and, eq, isNull, sql } from "drizzle-orm";
import { blocks, noteRevisions, auditLog, type Tx } from "@jotacular/db";
import { attribution, type Actor } from "./actor";
import { publish } from "./events";

/**
 * What a note's text IS, and how it stays findable.
 *
 * Split out of notes.ts, which had grown past the size limit. These four are
 * the shared internals every write path leans on -- the title nobody typed, the
 * text the editor sees, the blocks an agent sees, and the outbox row that keeps
 * semantic search honest.
 */

/**
 * A title nobody had to type.
 *
 * M0 does this inline; from M2 it moves to the worker so it can run after
 * recognition lands on non-text blocks (docs/07-capture-pipeline.md). Keep it
 * short and literal -- this is not a place for cleverness.
 */
export function inferTitle(body: string): string | null {
  const line = body.split("\n").map((l) => l.replace(/^#+\s*/, "").trim()).find(Boolean);
  if (!line) return null;
  return line.length > 72 ? `${line.slice(0, 71)}\u2026` : line;
}

export const previewOf = (body: string) => body.replace(/\s+/g, " ").trim().slice(0, 180);

export async function audit(
  tx: Tx, actor: Actor, spaceId: string, action: string, targetId?: string,
  toolName?: string, extra?: Record<string, unknown>,
) {
  // actor_type is the PRINCIPAL, which for a capture token is still the person
  // -- they are just coming through a different door. Which door is recorded in
  // metadata, so "what did my Shortcut add?" stays answerable without inventing
  // a third kind of principal.
  await tx.insert(auditLog).values({
    spaceId,
    actorType: actor.type === "agent" ? "agent" : "user",
    actorUserId: actor.userId,
    mcpClientId: actor.type === "agent" ? actor.clientRecordId : null,
    action,
    targetId: targetId ?? null,
    toolName: toolName ?? null,
    // `extra` is how a row points at the thing it is about -- the comment id,
    // the block that was read. The changes feed joins on it rather than making
    // a second query per row. ADR-063.
    metadata: actor.type === "capture"
      ? { via: "capture", tokenId: actor.tokenId, ...extra }
      : (extra ?? null),
  });
}

/**
 * The body of a note, as one markdown string.
 *
 * M0 keeps a single text block at position 0. Ink, audio and image blocks
 * arrive from M2 onward; the block table already models them, so that is an
 * additive change rather than a migration of existing notes.
 */
/**
 * Queue the note for embedding, in the same transaction as the write.
 *
 * Every path that changes a body calls this. A note that is saved but never
 * queued is invisible to semantic search forever, with nothing to indicate it
 * -- lexical search still finds it, so the gap looks like a ranking quirk
 * rather than a missing row. See apps/worker.
 */
export async function queueEmbedding(tx: Tx, noteId: string, revision: number) {
  // Coalesced, not appended. The canvas autosaves every 600ms, so a note
  // written over ten minutes would otherwise arrive at the worker as a hundred
  // jobs that all embed the identical final text. One pending job per note is
  // enough, because the worker reads the block at claim time, not at queue
  // time -- whatever the text is when it drains is what gets embedded.
  //
  // Two concurrent saves can both pass the NOT EXISTS and insert. That is
  // harmless: the second job embeds the same text into the same upsert.
  await tx.execute(sql`
    INSERT INTO outbox (topic, payload)
    SELECT 'block.embed', jsonb_build_object('noteId', ${noteId}::text, 'revision', ${revision}::int)
     WHERE NOT EXISTS (
       SELECT 1 FROM outbox o
        WHERE o.topic = 'block.embed'
          AND o.completed_at IS NULL
          AND o.payload ->> 'noteId' = ${noteId}
     )
  `);
}

/**
 * Put the body in the note's text block, making it if this is the first.
 *
 * M0 is one text block per note, at position 0. Both write paths did this
 * identically, and a rule two callers implement separately is one that
 * eventually differs between them.
 */
export async function writeTextBlock(
  tx: Tx, note: { id: string; spaceId: string }, body: string,
): Promise<void> {
  // `artifact_id IS NULL` matches readBody's filter, so the two agree BY
  // CONSTRUCTION rather than by the fact that createNote happens to put the
  // spine at position 0. One reads what the other writes; they should not
  // identify the row two different ways. ADR-065.
  const existing = await tx.select({ id: blocks.id }).from(blocks)
    .where(and(
      eq(blocks.noteId, note.id),
      eq(blocks.position, 0),
      isNull(blocks.artifactId),
    )).limit(1);

  if (existing[0]) {
    await tx.update(blocks).set({ body }).where(eq(blocks.id, existing[0].id));
    return;
  }
  await tx.insert(blocks).values({
    noteId: note.id, spaceId: note.spaceId, position: 0, kind: "text", body,
    transcriptState: "ready",
  });
}

export async function readBody(tx: Tx, noteId: string): Promise<string> {
  // THE SPINE ONLY, and both halves of the filter are load-bearing.
  //
  // `kind = 'text'` because folding an ink transcript in here would put
  // recognized handwriting into the typing surface, and the next autosave would
  // write it into the text block as though the person had typed it --
  // duplicating it, and making a machine reading indistinguishable from their
  // own words.
  //
  // `artifact_id IS NULL` for the same reason, one layer up. Canvas text boxes
  // get a companion text block so they reach lexical search (ADR-065), and it
  // is joined to the ink layer by artifact_id. Without this clause their
  // flattened contents would land in the textarea and the next autosave would
  // save them into the spine -- the exact duplication the paragraph above
  // warns about, arriving by a different door. It was a dormant bug from the
  // day readBody joined ALL text blocks and writeTextBlock only ever wrote
  // position 0.
  //
  // Agents get the whole note through readBlocks instead.
  const rows = await tx.select({ body: blocks.body })
    .from(blocks)
    .where(and(
      eq(blocks.noteId, noteId),
      eq(blocks.kind, "text"),
      isNull(blocks.artifactId),
    ))
    .orderBy(blocks.position);
  return rows.map((r) => r.body ?? "").join("\n\n");
}

export type NoteBlock = {
  id: string;
  kind: string;
  position: number;
  body: string | null;
  transcript: string | null;
  transcriptSource: string | null;
  transcriptState: string;
  confidence: number | null;
  /** How much of the surface was read. NULL = whole or unmeasured. ADR-056. */
  transcriptCoverage: number | null;
};

/** Every block, in order. What MCP and the renderer need; not what the editor
 *  needs. */
export async function readBlocks(tx: Tx, noteId: string): Promise<NoteBlock[]> {
  return tx.select({
    id: blocks.id,
    kind: blocks.kind,
    position: blocks.position,
    body: blocks.body,
    transcript: blocks.transcript,
    transcriptSource: blocks.transcriptSource,
    transcriptState: blocks.transcriptState,
    confidence: blocks.confidence,
    transcriptCoverage: blocks.transcriptCoverage,
  }).from(blocks).where(eq(blocks.noteId, noteId)).orderBy(blocks.position);
}

export async function writeRevision(
  tx: Tx, actor: Actor, note: { id: string; spaceId: string; revision: number },
  body: string, summary: string,
) {
  await tx.insert(noteRevisions).values({
    noteId: note.id,
    spaceId: note.spaceId,
    revision: note.revision,
    snapshot: { blocks: [{ kind: "text", body }] },
    summary,
    ...attribution(actor),
  });
}

/**
 * Tell any other open copy of this note that the body moved on.
 *
 * Both write paths say exactly this, so they say it in one place: a device with
 * nothing unsaved adopts the new revision, and one mid-sentence keeps its
 * sentence. The revision is the same one the conflict check runs on. ADR-058.
 */
export function announceSaved(note: { id: string; spaceId: string; revision: number }) {
  publish({
    kind: "note", spaceId: note.spaceId, noteId: note.id, revision: note.revision,
    at: Date.now(),
  });
}
