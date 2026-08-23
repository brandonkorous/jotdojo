import { sql } from "drizzle-orm";
import { withActor, type Tx } from "@jotdojo/db";
import { storage } from "@jotdojo/storage";
import { canReachSpace, type Actor } from "./actor";
import { NotFound } from "./errors";
import { assertMember } from "./spaces";
import { audit } from "./note-body";
import type { InkDocument } from "./ink-doc";
import type { RenderableBlock, RenderableNote } from "./render";

/**
 * Everything somebody wrote, in a form that outlives us. ADR-067.
 *
 * The privacy policy has promised this since the site went up, and until now it
 * was not true. That matters more here than in most products: we are the only
 * holder of handwriting that exists nowhere else, so an export is not a
 * convenience, it is the difference between a service and a hostage situation.
 *
 * Deliberately NOT built out of getNote in a loop. getNote writes a `note.read`
 * audit row per call, and exporting four hundred notes would bury every read
 * that meant something under four hundred that meant "a zip was made".
 */

export type ExportBlock = RenderableBlock & {
  id: string;
  position: number;
  /** Ink only: the strokes themselves, for drawing a picture of the page. */
  document: InkDocument | null;
  /** Image and audio only: where the original bytes live. */
  blobUrl: string | null;
  mimeType: string | null;
};

/** `Omit`, not an intersection: RenderableNote's `blocks` is optional and
 *  narrower, and intersecting the two makes reading one ambiguous. */
export type ExportNote = Omit<RenderableNote, "blocks"> & { blocks: ExportBlock[] };

const BLOCK_COLUMNS = sql`
  b.id, b.note_id, b.kind, b.position, b.body, b.transcript, b.transcript_source,
  b.transcript_state, b.confidence, b.transcript_coverage,
  a.strokes, a.blob_url, a.mime_type
`;

/** One note, with its ink and a pointer to each original artifact. */
export async function exportNote(actor: Actor, noteId: string): Promise<ExportNote> {
  return withActor(actor.userId, async (tx) => {
    const rows = await tx.execute(sql`
      SELECT id, space_id, title, revision, updated_at
        FROM notes WHERE id = ${noteId} AND deleted_at IS NULL
    `) as unknown as Array<Record<string, unknown>>;
    const row = rows[0];
    if (!row || !canReachSpace(actor, String(row.space_id))) {
      throw new NotFound("That note does not exist, or you cannot reach it");
    }

    const note = shapeNote(row, await blocksFor(tx, [noteId]));
    await audit(tx, actor, String(row.space_id), "note.export", noteId);
    return note;
  });
}

/**
 * Every note in a space, in one pass and one audit row.
 *
 * Archived notes are included and deleted ones are not. Archiving is "I am done
 * with this", which is not "destroy it" -- and an export that quietly dropped
 * them would be the second time this product told somebody it had their
 * writing when it did not.
 */
export async function exportSpace(actor: Actor, spaceId: string): Promise<ExportNote[]> {
  if (!canReachSpace(actor, spaceId)) {
    throw new NotFound("That space does not exist, or you cannot reach it");
  }

  return withActor(actor.userId, async (tx) => {
    // Refused rather than empty, and the membership check is what does it.
    // `canReachSpace` returns true for any signed-in person by design -- RLS is
    // the real boundary -- so without this, exporting a stranger's space would
    // hand back a perfectly valid archive of nothing, and an audit row in
    // THEIR space saying it happened. ADR-020.
    await assertMember(tx, actor, spaceId);

    const rows = await tx.execute(sql`
      SELECT id, space_id, title, revision, updated_at
        FROM notes
       WHERE space_id = ${spaceId} AND deleted_at IS NULL
       ORDER BY updated_at DESC
    `) as unknown as Array<Record<string, unknown>>;

    await audit(tx, actor, spaceId, "space.export", spaceId);
    if (rows.length === 0) return [];

    const byNote = await blocksFor(tx, rows.map((r) => String(r.id)));
    return rows.map((r) => shapeNote(r, byNote));
  });
}

/** Every block of every named note, keyed by note. One query, not one each. */
async function blocksFor(tx: Tx, noteIds: string[]): Promise<Map<string, ExportBlock[]>> {
  const rows = await tx.execute(sql`
    SELECT ${BLOCK_COLUMNS}
      FROM blocks b
      LEFT JOIN media_assets a ON a.id = b.artifact_id
     WHERE b.note_id IN (
             SELECT value::uuid FROM jsonb_array_elements_text(${JSON.stringify(noteIds)}::jsonb)
           )
     ORDER BY b.note_id, b.position
  `) as unknown as Array<Record<string, unknown>>;

  const out = new Map<string, ExportBlock[]>();
  for (const row of rows) {
    const list = out.get(String(row.note_id)) ?? [];
    list.push(shapeBlock(row));
    out.set(String(row.note_id), list);
  }
  return out;
}

function shapeBlock(row: Record<string, unknown>): ExportBlock {
  const kind = String(row.kind);
  return {
    id: String(row.id),
    kind,
    position: Number(row.position ?? 0),
    body: (row.body as string | null) ?? null,
    transcript: (row.transcript as string | null) ?? null,
    transcriptSource: (row.transcript_source as string | null) ?? null,
    transcriptState: String(row.transcript_state ?? "ready"),
    confidence: row.confidence === null || row.confidence === undefined
      ? null : Number(row.confidence),
    transcriptCoverage: row.transcript_coverage === null || row.transcript_coverage === undefined
      ? null : Number(row.transcript_coverage),
    document: kind === "ink" ? (row.strokes as InkDocument | null) : null,
    blobUrl: kind === "ink" ? null : ((row.blob_url as string | null) ?? null),
    mimeType: (row.mime_type as string | null) ?? null,
  };
}

function shapeNote(row: Record<string, unknown>, byNote: Map<string, ExportBlock[]>): ExportNote {
  const id = String(row.id);
  const blocks = byNote.get(id) ?? [];
  return {
    id,
    title: (row.title as string | null) ?? null,
    revision: Number(row.revision ?? 0),
    updatedAt: new Date(row.updated_at as string),
    // The typed spine, so renderNote has something to fall back on for a note
    // whose blocks were all filtered away.
    body: blocks.filter((b) => b.kind === "text").map((b) => b.body ?? "").join("\n\n"),
    blocks,
  };
}

/**
 * The original bytes behind one artifact.
 *
 * Takes the blob key rather than a block id, because the caller only ever has
 * one that came out of an export the actor was already authorised for. Null
 * when storage is not configured -- the export says so rather than shipping a
 * zip with a silently missing photo in it.
 */
export async function artifactBytes(blobUrl: string | null): Promise<Uint8Array | null> {
  const store = storage();
  if (!store || !blobUrl) return null;
  try {
    return new Uint8Array(await store.read(blobUrl));
  } catch {
    return null;
  }
}
