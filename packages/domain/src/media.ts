import { and, eq, sql } from "drizzle-orm";
import { withActor, notes, blocks, mediaAssets, type Tx } from "@jotdojo/db";
import { ACCEPTED, extensionFor, mediaKey, storage } from "@jotdojo/storage";
import { canReachSpace, hasScope, type Actor } from "./actor";
import { Forbidden, NotFound, DomainError } from "./errors";
import { assertMember } from "./spaces";

/**
 * Images and audio. docs/07-capture-pipeline.md.
 *
 * The claim this file exists to test: adding a modality should be a new
 * recognizer, not a schema change. It was -- `blocks` already had kind,
 * artifact_id and the universal four fields, `media_assets` already had
 * blob_url, mime_type, byte_size, duration_ms and width/height, and nothing in
 * 0000_init.sql had to move. The only migration needed was widening the
 * worker's claim function to dispatch on kind.
 *
 * Bytes never pass through here. The caller gets a time-limited upload URL and
 * PUTs directly to storage; we only ever hold the metadata.
 */

export type MediaKind = "image" | "audio";

export type MediaUpload = {
  blockId: string;
  artifactId: string;
  /** Where the browser PUTs the bytes, and what headers it must send. */
  url: string;
  headers: Record<string, string>;
};

/** Generous but finite. A phone photo is ~5MB; an hour of Opus is ~30MB. */
const MAX_BYTES: Record<MediaKind, number> = {
  image: 25 * 1024 * 1024,
  audio: 200 * 1024 * 1024,
};

const KIND_PREFIX: Record<MediaKind, string> = { image: "image/", audio: "audio/" };

/**
 * Reserve a block and hand back somewhere to put the bytes.
 *
 * Two steps, not one, because the upload does not come back through us. The
 * block exists first -- in `pending` -- so that a capture interrupted between
 * the reservation and the upload leaves a visible, explainable gap rather than
 * nothing at all.
 */
export async function createMediaBlock(
  actor: Actor, noteId: string, kind: MediaKind, contentType: string,
): Promise<MediaUpload> {
  if (!hasScope(actor, "notes:write") && !hasScope(actor, "capture:write")) {
    throw new Forbidden("This connection cannot add to notes");
  }

  const type = contentType.split(";")[0]!.trim().toLowerCase();
  if (!ACCEPTED.has(type) || !type.startsWith(KIND_PREFIX[kind])) {
    throw new DomainError(`${contentType} is not a supported ${kind} type`, "bad_media_type", 400);
  }

  const store = storage();
  if (!store) {
    // Refused cleanly rather than accepting a capture we cannot keep. This is
    // the one seam where a missing provider is NOT a graceful degradation:
    // there is no useful version of "record this" with nowhere to put it.
    throw new DomainError(
      "Media storage is not configured, so photos and audio cannot be saved yet.",
      "storage_unavailable", 503,
    );
  }

  return withActor(actor.userId, async (tx) => {
    const note = await loadNote(tx, actor, noteId);
    await assertMember(tx, actor, note.spaceId);

    const asset = (await tx.insert(mediaAssets).values({
      spaceId: note.spaceId, kind, mimeType: type,
    }).returning())[0]!;

    const key = mediaKey(note.spaceId, asset.id, extensionFor(type));
    await tx.update(mediaAssets).set({ blobUrl: key }).where(eq(mediaAssets.id, asset.id));

    const position = await nextPosition(tx, noteId);
    const block = (await tx.insert(blocks).values({
      noteId, spaceId: note.spaceId, position, kind,
      artifactId: asset.id,
      // Nothing to read until the bytes arrive. finalizeMedia queues the work.
      transcriptState: "pending",
    }).returning())[0]!;

    const upload = await store.uploadUrl(key, type);
    return {
      blockId: block.id, artifactId: asset.id,
      url: upload.url, headers: upload.headers,
    };
  });
}

async function loadNote(tx: Tx, actor: Actor, noteId: string) {
  const rows = await tx.select({ id: notes.id, spaceId: notes.spaceId })
    .from(notes).where(and(eq(notes.id, noteId))).limit(1);
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

/**
 * The bytes are up. Record what they were and queue the recognizer.
 *
 * The size is reported by the client, which means it is a claim rather than a
 * fact -- so it is bounds-checked here and the worker rechecks against what it
 * actually reads. Trusting it outright would let a client reserve a block for
 * "2KB" and upload two gigabytes.
 */
export async function finalizeMedia(
  actor: Actor, blockId: string,
  meta: { byteSize: number; width?: number; height?: number; durationMs?: number },
): Promise<void> {
  if (!hasScope(actor, "notes:write") && !hasScope(actor, "capture:write")) {
    throw new Forbidden("This connection cannot add to notes");
  }

  await withActor(actor.userId, async (tx) => {
    const rows = await tx.execute(sql`
      SELECT b.space_id, b.kind, b.note_id, a.id AS artifact_id
        FROM blocks b
        JOIN media_assets a ON a.id = b.artifact_id
       WHERE b.id = ${blockId} AND b.kind IN ('image','audio')
    `);
    const row = (rows as unknown as Array<Record<string, unknown>>)[0];
    if (!row) throw new NotFound("That block does not exist, or you cannot reach it");
    if (!canReachSpace(actor, String(row.space_id))) {
      throw new NotFound("That block does not exist, or you cannot reach it");
    }

    const kind = String(row.kind) as MediaKind;
    const size = Number(meta.byteSize);
    if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES[kind]) {
      throw new DomainError(
        `${kind} must be between 1 byte and ${MAX_BYTES[kind] / 1024 / 1024}MB`,
        "media_too_large", 400,
      );
    }

    await tx.update(mediaAssets).set({
      byteSize: size,
      width: meta.width ?? null,
      height: meta.height ?? null,
      durationMs: meta.durationMs ?? null,
    }).where(eq(mediaAssets.id, String(row.artifact_id)));

    // Immediately, not after a quiet period. Unlike ink -- where more strokes
    // are likely in the next few seconds -- a photo is finished the moment it
    // is uploaded, and the person is waiting to see what it says.
    await tx.execute(sql`
      INSERT INTO outbox (topic, payload)
      SELECT 'block.recognize', jsonb_build_object('blockId', ${blockId}::text)
       WHERE NOT EXISTS (
         SELECT 1 FROM outbox o
          WHERE o.topic = 'block.recognize' AND o.completed_at IS NULL
            AND o.payload ->> 'blockId' = ${blockId}
       )
    `);

    await tx.update(notes).set({ updatedAt: new Date() }).where(eq(notes.id, String(row.note_id)));
  });
}

/** A time-limited URL for showing the artifact, or reading it in the worker. */
export async function mediaUrl(actor: Actor, blockId: string): Promise<string> {
  const store = storage();
  if (!store) throw new DomainError("Media storage is not configured", "storage_unavailable", 503);

  return withActor(actor.userId, async (tx) => {
    const rows = await tx.select({ spaceId: blocks.spaceId, blobUrl: mediaAssets.blobUrl })
      .from(blocks)
      .innerJoin(mediaAssets, eq(mediaAssets.id, blocks.artifactId))
      .where(eq(blocks.id, blockId)).limit(1);
    const row = rows[0];
    if (!row?.blobUrl) throw new NotFound("No media for that block");
    // RLS already scoped the row; this catches the grant-scoped agent case,
    // which lives in an array column no policy reads. ADR-021.
    if (!canReachSpace(actor, row.spaceId)) throw new NotFound("No media for that block");
    return store.readUrl(row.blobUrl);
  });
}
