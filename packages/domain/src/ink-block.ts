import { and, eq, sql } from "drizzle-orm";
import { withActor, notes, blocks, mediaAssets, type Tx } from "@jotacular/db";
import { canReachSpace, hasScope, type Actor } from "./actor";
import { Forbidden, NotFound, DomainError } from "./errors";
import { assertMember } from "./spaces";
import type { InkDocument, Stroke } from "./ink-doc";

/**
 * An ink block: bringing one into existence, finding it, and reading it back.
 * docs/08-ink.md.
 *
 * Split from ink.ts, which writes strokes into it. A block exists before a
 * single stroke is drawn -- eager sync needs somewhere to put the first batch
 * -- so its lifecycle genuinely is a separate thing from its contents.
 */

export type InkBlock = {
  blockId: string;
  artifactId: string;
  noteId: string;
  spaceId: string;
  strokeCount: number;
  /** How many typed boxes are on the plane. A page with text and no strokes
   *  still has to be loaded. ADR-065. */
  textCount: number;
  /** Moves on every write to the page, append included. What a follower
   *  compares against to decide whether it is behind. ADR-058. */
  version: number;
  canvas: { w: number; h: number };
  transcript: string | null;
  transcriptState: string;
  /** WHAT read it. 'user' means the person typed it out and it is not a guess
   *  -- the one thing a confidence figure must never be attached to. */
  transcriptSource: string | null;
  confidence: number | null;
};

/**
 * Start an ink block. Creates the empty artifact the canvas will append into.
 *
 * Created before a single stroke is drawn, on purpose: eager sync needs
 * somewhere to put the first batch two seconds later, and asking for an id at
 * that point would put a network round trip in the middle of someone writing.
 */
export async function createInkBlock(
  actor: Actor, noteId: string, canvas: { w: number; h: number },
): Promise<InkBlock> {
  if (!hasScope(actor, "notes:write") && !hasScope(actor, "capture:write")) {
    throw new Forbidden("This connection cannot create notes");
  }
  if (!Number.isFinite(canvas.w) || !Number.isFinite(canvas.h)
      || canvas.w <= 0 || canvas.h <= 0 || canvas.w > 20000 || canvas.h > 20000) {
    throw new DomainError("implausible canvas size", "bad_canvas", 400);
  }

  return withActor(actor.userId, async (tx) => {
    const note = await loadNote(tx, actor, noteId);
    await assertMember(tx, actor, note.spaceId);

    const doc: InkDocument = { v: 1, canvas, strokes: [] };
    const asset = (await tx.insert(mediaAssets).values({
      spaceId: note.spaceId,
      kind: "ink",
      strokes: doc,
      width: canvas.w,
      height: canvas.h,
    }).returning())[0]!;

    const next = await nextPosition(tx, noteId);
    const block = (await tx.insert(blocks).values({
      noteId,
      spaceId: note.spaceId,
      position: next,
      kind: "ink",
      artifactId: asset.id,
      // An empty page has nothing to recognize. The worker moves this to
      // 'pending' when the first strokes land -- see appendStrokes.
      transcriptState: "ready",
    }).returning())[0]!;

    return {
      blockId: block.id, artifactId: asset.id, noteId, spaceId: note.spaceId,
      strokeCount: 0, textCount: 0, version: 0, canvas, transcript: null,
      transcriptState: block.transcriptState, transcriptSource: null, confidence: null,
    };
  });
}

export async function loadNote(tx: Tx, actor: Actor, noteId: string) {
  const rows = await tx.select({ id: notes.id, spaceId: notes.spaceId })
    .from(notes).where(eq(notes.id, noteId)).limit(1);
  const note = rows[0];
  if (!note) throw new NotFound("That note does not exist, or you cannot reach it");
  if (!canReachSpace(actor, note.spaceId)) {
    throw new NotFound("That note does not exist, or you cannot reach it");
  }
  return note;
}

async function nextPosition(tx: Tx, noteId: string): Promise<number> {
  const rows = await tx.execute(
    sql`SELECT coalesce(max(position), -1) + 1 AS next FROM blocks WHERE note_id = ${noteId}`,
  );
  return Number((rows as unknown as Array<{ next: number }>)[0]?.next ?? 0);
}


/** Read a block's ink, for rendering and for recognition. */
export async function getInk(actor: Actor, blockId: string): Promise<InkBlock & { document: InkDocument }> {
  return withActor(actor.userId, async (tx) => {
    const rows = await tx.execute(sql`
      SELECT b.id, b.note_id, b.space_id, b.transcript, b.transcript_state,
             b.transcript_source, b.confidence,
             a.id AS artifact_id, a.strokes, a.strokes_version
        FROM blocks b
        JOIN media_assets a ON a.id = b.artifact_id
       WHERE b.id = ${blockId} AND b.kind = 'ink'
    `);
    const row = (rows as unknown as Array<Record<string, unknown>>)[0];
    if (!row) throw new NotFound("That ink block does not exist, or you cannot reach it");
    if (!canReachSpace(actor, String(row.space_id))) {
      throw new NotFound("That ink block does not exist, or you cannot reach it");
    }

    const document = row.strokes as InkDocument;
    return {
      blockId: String(row.id),
      artifactId: String(row.artifact_id),
      noteId: String(row.note_id),
      spaceId: String(row.space_id),
      strokeCount: document.strokes.length,
      textCount: document.texts?.length ?? 0,
      version: Number(row.strokes_version ?? 0),
      canvas: document.canvas,
      transcript: (row.transcript as string | null) ?? null,
      transcriptState: String(row.transcript_state),
      transcriptSource: (row.transcript_source as string | null) ?? null,
      confidence: row.confidence === null ? null : Number(row.confidence),
      document,
    };
  });
}


/**
 * The strokes from `from` onward, and nothing before it.
 *
 * What a device does when the live stream says the page grew. Sending the whole
 * page instead would work and would be wrong: somebody writing for ten minutes
 * generates three hundred of these, and the point of an append-only log is that
 * catching up costs what was added rather than what exists.
 */
export async function strokesSince(
  actor: Actor, blockId: string, from: number,
): Promise<{ strokes: Stroke[]; strokeCount: number; version: number }> {
  const start = Number.isInteger(from) && from > 0 ? from : 0;

  return withActor(actor.userId, async (tx) => {
    const rows = await tx.execute(sql`
      SELECT b.space_id, a.strokes_version AS version,
             jsonb_array_length(a.strokes -> 'strokes') AS count,
             coalesce(
               (SELECT jsonb_agg(s ORDER BY ord)
                  FROM jsonb_array_elements(a.strokes -> 'strokes')
                       WITH ORDINALITY AS t(s, ord)
                 WHERE ord > ${start}),
               '[]'::jsonb) AS tail
        FROM blocks b
        JOIN media_assets a ON a.id = b.artifact_id
       WHERE b.id = ${blockId} AND b.kind = 'ink'
    `);
    const row = (rows as unknown as Array<Record<string, unknown>>)[0];
    if (!row) throw new NotFound("That ink block does not exist, or you cannot reach it");
    if (!canReachSpace(actor, String(row.space_id))) {
      throw new NotFound("That ink block does not exist, or you cannot reach it");
    }

    return {
      strokes: (row.tail as Stroke[] | null) ?? [],
      strokeCount: Number(row.count ?? 0),
      version: Number(row.version ?? 0),
    };
  });
}
