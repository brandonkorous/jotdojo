import { and, eq, sql } from "drizzle-orm";
import { withActor, notes, blocks, mediaAssets, type Tx } from "@jotdojo/db";
import { canReachSpace, hasScope, type Actor } from "./actor";
import { Forbidden, NotFound, DomainError } from "./errors";
import { assertMember } from "./spaces";

/**
 * Ink. docs/08-ink.md.
 *
 * Vectors are the truth and are never flattened to a raster. Strokes are small
 * -- a page of handwriting is tens of kilobytes -- and keeping them means a
 * better recognizer can be run over old notes later, so handwriting from a year
 * ago silently improves. A PNG is a one-way door.
 */

/** [x, y, t, pressure, tiltX, tiltY]. Flat arrays, not objects per point: a
 *  page is thousands of points and the payload difference is large. `t` is
 *  milliseconds from the start of the stroke. */
export type Point = [number, number, number, number, number, number];

export type Stroke = {
  tool: "pen" | "highlighter";
  color: string;
  width: number;
  pts: Point[];
};

export type InkDocument = {
  v: 1;
  canvas: { w: number; h: number };
  strokes: Stroke[];
};

/** Generous, and far above a real page. A guard against a runaway client, not
 *  a product limit -- if anyone legitimately hits it, raise it. */
const MAX_STROKES = 20_000;
const MAX_POINTS_PER_STROKE = 10_000;
const MAX_BATCH = 200;

const TOOLS = new Set(["pen", "highlighter"]);
const COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * Validate strokes at the boundary rather than trusting the client.
 *
 * These land in a jsonb column that a recognizer, a renderer and eventually a
 * VLM prompt all read. A NaN coordinate or a 40MB point array is not a
 * theoretical problem: it is a rendering crash or a bill, arriving from a
 * device we do not control.
 */
export function validateStrokes(input: unknown): Stroke[] {
  if (!Array.isArray(input)) throw new DomainError("strokes must be an array", "bad_strokes", 400);
  if (input.length > MAX_BATCH) {
    throw new DomainError(`at most ${MAX_BATCH} strokes per batch`, "bad_strokes", 400);
  }

  return input.map((raw, i) => {
    const s = raw as Partial<Stroke>;
    const where = `stroke ${i}`;
    if (!s || typeof s !== "object") throw new DomainError(`${where}: not an object`, "bad_strokes", 400);
    if (!TOOLS.has(String(s.tool))) throw new DomainError(`${where}: unknown tool`, "bad_strokes", 400);
    if (typeof s.color !== "string" || !COLOR.test(s.color)) {
      throw new DomainError(`${where}: color must be #rrggbb`, "bad_strokes", 400);
    }
    if (typeof s.width !== "number" || !Number.isFinite(s.width) || s.width <= 0 || s.width > 200) {
      throw new DomainError(`${where}: implausible width`, "bad_strokes", 400);
    }
    if (!Array.isArray(s.pts) || s.pts.length === 0) {
      throw new DomainError(`${where}: no points`, "bad_strokes", 400);
    }
    if (s.pts.length > MAX_POINTS_PER_STROKE) {
      throw new DomainError(`${where}: too many points`, "bad_strokes", 400);
    }
    for (const p of s.pts) {
      if (!Array.isArray(p) || p.length !== 6 || p.some((n) => typeof n !== "number" || !Number.isFinite(n))) {
        throw new DomainError(`${where}: each point is six finite numbers`, "bad_strokes", 400);
      }
    }
    return { tool: s.tool as Stroke["tool"], color: s.color, width: s.width, pts: s.pts as Point[] };
  });
}

export type InkBlock = {
  blockId: string;
  artifactId: string;
  noteId: string;
  spaceId: string;
  strokeCount: number;
  canvas: { w: number; h: number };
  transcript: string | null;
  transcriptState: string;
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
      strokeCount: 0, canvas, transcript: null,
      transcriptState: block.transcriptState, confidence: null,
    };
  });
}

async function loadNote(tx: Tx, actor: Actor, noteId: string) {
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

/** Recognition waits for a pause rather than firing per batch. */
const QUIET_PERIOD_SECONDS = 30;

/**
 * Append a batch of strokes to an ink block.
 *
 * Eager, not on save: Safari evicts script-writable storage under pressure and
 * after disuse, so a finished drawing must never exist only in IndexedDB.
 * Losing a hand-drawn page is unforgivable in a way that losing a typed
 * paragraph is not -- the person cannot retype it from memory.
 *
 * `seq` is the index this batch claims to start at, and it makes the whole
 * thing idempotent without a request id:
 *
 *   seq === count   append it
 *   seq <  count    already have it -- a retry after a response was lost. No-op.
 *   seq >  count    a batch went missing. Refuse, and tell the client where we
 *                   actually are so it can resend from there.
 *
 * The last case is the one worth being strict about. Accepting it would leave a
 * hole in the middle of someone's handwriting that nothing would ever report.
 */
export async function appendStrokes(
  actor: Actor, blockId: string, seq: number, rawStrokes: unknown,
): Promise<{ strokeCount: number; accepted: number }> {
  if (!hasScope(actor, "notes:write") && !hasScope(actor, "capture:write")) {
    throw new Forbidden("This connection cannot write notes");
  }
  if (!Number.isInteger(seq) || seq < 0) {
    throw new DomainError("seq must be a non-negative integer", "bad_seq", 400);
  }
  const strokes = validateStrokes(rawStrokes);

  return withActor(actor.userId, async (tx) => {
    // FOR UPDATE, because this is a read-modify-write on a jsonb document and
    // two tabs drawing on one page is a thing people do.
    const rows = await tx.execute(sql`
      SELECT b.id AS block_id, b.space_id, b.note_id, a.id AS artifact_id,
             jsonb_array_length(a.strokes -> 'strokes') AS count
        FROM blocks b
        JOIN media_assets a ON a.id = b.artifact_id
       WHERE b.id = ${blockId} AND b.kind = 'ink'
         FOR UPDATE OF a
    `);
    const row = (rows as unknown as Array<Record<string, unknown>>)[0];
    if (!row) throw new NotFound("That ink block does not exist, or you cannot reach it");

    const spaceId = String(row.space_id);
    if (!canReachSpace(actor, spaceId)) {
      throw new NotFound("That ink block does not exist, or you cannot reach it");
    }

    const count = Number(row.count ?? 0);

    if (seq < count) {
      // A retry whose original response never arrived. The strokes are already
      // here; saying "fine" is both true and what lets the client move on.
      return { strokeCount: count, accepted: 0 };
    }
    if (seq > count) {
      throw new DomainError(
        `strokes ${count}..${seq - 1} were never received; resend from ${count}`,
        "stroke_gap", 409,
      );
    }
    if (count + strokes.length > MAX_STROKES) {
      throw new DomainError("this page has too many strokes", "page_full", 400);
    }

    await tx.execute(sql`
      UPDATE media_assets
         SET strokes = jsonb_set(strokes, '{strokes}',
                                 (strokes -> 'strokes') || ${JSON.stringify(strokes)}::jsonb)
       WHERE id = ${String(row.artifact_id)}
    `);

    await queueRecognition(tx, blockId);
    await tx.update(blocks)
      .set({ transcriptState: "pending" })
      .where(and(eq(blocks.id, blockId), eq(blocks.transcriptState, "ready")));

    await tx.update(notes).set({ updatedAt: new Date() }).where(eq(notes.id, String(row.note_id)));

    return { strokeCount: count + strokes.length, accepted: strokes.length };
  });
}

/**
 * Queue recognition for a quiet period from now, pushing any existing job out.
 *
 * Recognition is a VLM call over the whole page, so firing one per two-second
 * batch would mean forty calls for a page someone spent two minutes writing --
 * thirty-nine of them reading an unfinished drawing, and all forty billed. The
 * job instead settles thirty seconds after the last stroke lands.
 *
 * Same coalescing shape as queueEmbedding in notes.ts, with one difference:
 * this moves `available_at` forward on every append rather than leaving the
 * first job's time alone.
 */
async function queueRecognition(tx: Tx, blockId: string) {
  const updated = await tx.execute(sql`
    UPDATE outbox
       SET available_at = now() + make_interval(secs => ${QUIET_PERIOD_SECONDS})
     WHERE topic = 'block.recognize'
       AND completed_at IS NULL
       AND payload ->> 'blockId' = ${blockId}
    RETURNING id
  `);

  if ((updated as unknown as unknown[]).length > 0) return;

  await tx.execute(sql`
    INSERT INTO outbox (topic, payload, available_at)
    VALUES ('block.recognize', jsonb_build_object('blockId', ${blockId}::text),
            now() + make_interval(secs => ${QUIET_PERIOD_SECONDS}))
  `);
}

/** Read a block's ink, for rendering and for recognition. */
export async function getInk(actor: Actor, blockId: string): Promise<InkBlock & { document: InkDocument }> {
  return withActor(actor.userId, async (tx) => {
    const rows = await tx.execute(sql`
      SELECT b.id, b.note_id, b.space_id, b.transcript, b.transcript_state, b.confidence,
             a.id AS artifact_id, a.strokes
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
      canvas: document.canvas,
      transcript: (row.transcript as string | null) ?? null,
      transcriptState: String(row.transcript_state),
      confidence: row.confidence === null ? null : Number(row.confidence),
      document,
    };
  });
}

/**
 * A person correcting what the recognizer read.
 *
 * Sets transcript_source to 'user' and confidence to null, and that block is
 * never re-recognized again. A correction is the one input we treat as ground
 * truth -- overwriting it later with a "better" model would be the single most
 * infuriating thing this product could do.
 */
export async function correctTranscript(
  actor: Actor, blockId: string, text: string,
): Promise<void> {
  if (actor.type !== "user") throw new Forbidden("Only a person can correct a transcript");

  await withActor(actor.userId, async (tx) => {
    const rows = await tx.select({ spaceId: blocks.spaceId }).from(blocks)
      .where(eq(blocks.id, blockId)).limit(1);
    if (!rows[0]) throw new NotFound();
    await assertMember(tx, actor, rows[0].spaceId);

    await tx.update(blocks).set({
      transcript: text.trim(),
      transcriptSource: "user",
      confidence: null,
      transcriptState: "ready",
    }).where(eq(blocks.id, blockId));

    // Any queued recognition for this block is now wrong by definition.
    await tx.execute(sql`
      UPDATE outbox SET completed_at = now()
       WHERE topic = 'block.recognize' AND completed_at IS NULL
         AND payload ->> 'blockId' = ${blockId}
    `);
  });
}

/**
 * Replace the whole page.
 *
 * Erase is stroke-wise, so erasing removes items from the middle of the array
 * and the append protocol -- which only ever adds to the end -- cannot express
 * it. Rather than invent a delete-by-index that would race with in-flight
 * appends, the client sends the page it now believes in and that becomes the
 * truth.
 *
 * This is a bigger payload and a bigger hammer, and it is correct precisely
 * because erasing is rare compared with drawing. Do not reach for it on the
 * append path.
 */
export async function replaceStrokes(
  actor: Actor, blockId: string, rawStrokes: unknown,
): Promise<{ strokeCount: number }> {
  if (!hasScope(actor, "notes:write") && !hasScope(actor, "capture:write")) {
    throw new Forbidden("This connection cannot write notes");
  }
  const all = Array.isArray(rawStrokes) ? rawStrokes : [];
  if (all.length > MAX_STROKES) throw new DomainError("too many strokes", "page_full", 400);

  // Validated in batches so the per-batch cap does not become a page cap.
  const strokes: Stroke[] = [];
  for (let i = 0; i < all.length; i += MAX_BATCH) {
    strokes.push(...validateStrokes(all.slice(i, i + MAX_BATCH)));
  }

  return withActor(actor.userId, async (tx) => {
    const rows = await tx.execute(sql`
      SELECT b.space_id, b.note_id, a.id AS artifact_id
        FROM blocks b
        JOIN media_assets a ON a.id = b.artifact_id
       WHERE b.id = ${blockId} AND b.kind = 'ink'
         FOR UPDATE OF a
    `);
    const row = (rows as unknown as Array<Record<string, unknown>>)[0];
    if (!row) throw new NotFound("That ink block does not exist, or you cannot reach it");
    if (!canReachSpace(actor, String(row.space_id))) {
      throw new NotFound("That ink block does not exist, or you cannot reach it");
    }

    await tx.execute(sql`
      UPDATE media_assets
         SET strokes = jsonb_set(strokes, '{strokes}', ${JSON.stringify(strokes)}::jsonb)
       WHERE id = ${String(row.artifact_id)}
    `);

    // What is on the page changed, so whatever was read off it is now stale.
    // An empty page has nothing to recognize and should not queue a VLM call.
    if (strokes.length > 0) {
      await queueRecognition(tx, blockId);
      await tx.update(blocks).set({ transcriptState: "pending" })
        .where(and(eq(blocks.id, blockId), eq(blocks.transcriptState, "ready")));
    }
    await tx.update(notes).set({ updatedAt: new Date() }).where(eq(notes.id, String(row.note_id)));

    return { strokeCount: strokes.length };
  });
}
