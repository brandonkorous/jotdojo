import { sql } from "drizzle-orm";
import { withActor } from "@jotacular/db";
import { canReachSpace, hasScope, type Actor } from "./actor";
import { Forbidden, NotFound, DomainError } from "./errors";
import { validateStrokes, MAX_STROKES, MAX_BATCH, type Stroke } from "./ink-doc";
import { validateTexts, syncTextBlock, MAX_TEXTS, type TextBox } from "./ink-text";
import { validateImages, MAX_IMAGES, type ImageOnPage } from "./ink-image";
import { markPageChanged, announceInk } from "./ink-recognition";
import { lockPage, bumpPage, writeTexts, writeImages } from "./ink-page";

/**
 * Changing the middle of a page: erase, move, recolour, delete. ADR-058.
 *
 * The append protocol only ever adds to the end, so until now these were
 * expressed by resending the whole page. That worked exactly as long as one
 * device was drawing. With two, it is a data-loss bug wearing a save button:
 * erase one word on a tablet and every stroke the laptop drew while the request
 * was in flight is gone, silently, with the erase reported as a success.
 *
 * A delta names strokes by id instead, and that single change makes the
 * operation COMMUTATIVE with drawing. Removing stroke A and appending stroke B
 * are independent facts about a page; applying them in either order gives the
 * same page. So there is nothing to guard, nothing to refuse, and no retry loop
 * -- the conflict was never real, it was an artefact of describing an edit as a
 * snapshot.
 *
 * What remains is two devices editing the SAME stroke. Removal wins over
 * restyling, because a person who rubbed something out and a person who
 * recoloured it disagree about whether it should exist, and the one who wanted
 * it gone can always draw it again.
 */

export type InkDelta = {
  /**
   * Ids to remove, of EITHER kind. Unknown ids are ignored -- somebody got
   * there first. One lasso can hold strokes and text boxes, and deleting that
   * selection has to be one delta or the two halves can interleave with
   * somebody else's edit and leave half a selection behind.
   */
  remove: string[];
  /** Strokes to add, or to replace in place when the id is already on the page. */
  upsert: Stroke[];
  /**
   * Text boxes, same rules. A SEPARATE FIELD rather than a polymorphic
   * `upsert`, for the reason ink-text.ts gives: keeping typed text out of the
   * stroke array is what stops the recogniser reading it back as handwriting,
   * and a validator that accepted either would be one edit away from losing
   * that. ADR-065.
   */
  texts?: TextBox[];
  /**
   * Where photographs sit, same rules again. ADR-103.
   *
   * Moving a photo is a delta and never a re-upload: the bytes are a `blocks`
   * row that nobody touched, and only four numbers changed.
   */
  images?: ImageOnPage[];
};

/** Erasing a big scribble can touch a lot of strokes; this is still a guard. */
const MAX_REMOVE = 5_000;

export async function applyInkDelta(
  actor: Actor, blockId: string, delta: InkDelta,
): Promise<{ strokeCount: number; version: number }> {
  if (!hasScope(actor, "notes:write") && !hasScope(actor, "capture:write")) {
    throw new Forbidden("This connection cannot write notes");
  }

  const remove = validateIds(delta.remove ?? []);
  const upsert = validateUpserts(delta.upsert ?? []);
  const texts = delta.texts === undefined ? null : validateTexts(delta.texts);
  const images = delta.images === undefined ? null : validateImages(delta.images);
  if (remove.length === 0 && upsert.length === 0 && texts === null && images === null) {
    throw new DomainError("a delta must change something", "empty_delta", 400);
  }

  const page = await withActor(actor.userId, async (tx) => {
    const row = await lockPage(tx, blockId);
    if (!canReachSpace(actor, row.spaceId)) {
      throw new NotFound("That ink block does not exist, or you cannot reach it");
    }

    const next = mergeById(row.strokes, remove, upsert);
    if (next.length > MAX_STROKES) {
      throw new DomainError("this page has too many strokes", "page_full", 400);
    }

    // `remove` spans both kinds, so a delta that only deletes still has to
    // reach the text array -- otherwise a lasso holding one stroke and one box
    // deletes the stroke and leaves the box behind.
    const nextTexts = mergeById(row.texts, remove, texts);
    if (nextTexts.length > MAX_TEXTS) {
      throw new DomainError("this page has too many text boxes", "page_full", 400);
    }
    const nextImages = mergeById(row.images, remove, images);
    if (nextImages.length > MAX_IMAGES) {
      throw new DomainError("this page has too many images", "page_full", 400);
    }

    let version = await bumpPage(tx, row.artifactId, next);
    if (changed(row.texts, nextTexts)) {
      version = await writeTexts(tx, row.artifactId, nextTexts);
      // The searchable copy, in the same transaction. A box that is saved but
      // not indexed is invisible to search forever with nothing to indicate it.
      await syncTextBlock(tx, row, nextTexts);
    }
    // No companion row: an image's searchable text is its vision transcript,
    // which lives on the block that owns the bytes and did not move. ADR-103.
    if (changed(row.images, nextImages)) {
      version = await writeImages(tx, row.artifactId, nextImages);
    }

    await markPageChanged(tx, { blockId, noteId: row.noteId }, next.length > 0);
    return { ...row, strokeCount: next.length, version };
  });

  announceInk(page, blockId, page.strokeCount, page.version);
  return { strokeCount: page.strokeCount, version: page.version };
}

/**
 * Apply the delta to one kind of object, preserving paint order.
 *
 * A restyled stroke keeps its position rather than moving to the end -- paint
 * order is what puts a highlighter behind the word it highlights, and a marker
 * that jumped in front of the text on recolour would look like the recolour
 * broke it. The same is true of a photo somebody deliberately put underneath.
 *
 * `next === null` means the delta said nothing about this kind, which is not
 * the same as saying there is none of it -- a plain erase must not wipe the
 * page's typed boxes or its photographs. Removal still applies either way,
 * because `remove` spans every kind.
 *
 * ONE function for strokes, boxes and images. It was three near-identical
 * copies, and the third was the one that made the duplication a liability
 * rather than a smell. ADR-103.
 */
function mergeById<T extends { id: string }>(
  page: T[], remove: string[], next: T[] | null,
): T[] {
  const gone = new Set(remove);
  const replacements = new Map((next ?? []).map((item) => [item.id, item]));

  const kept: T[] = [];
  for (const item of page) {
    if (gone.has(item.id)) continue;
    const replacement = replacements.get(item.id);
    if (replacement) {
      kept.push(replacement);
      replacements.delete(item.id);
      continue;
    }
    kept.push(item);
  }

  // Whatever was not already on the page is new, and new things go on top.
  // Removal wins: an id in both lists was rubbed out by somebody, and the
  // upsert here is a restyle of something that no longer exists.
  for (const item of next ?? []) {
    if (replacements.has(item.id) && !gone.has(item.id)) kept.push(item);
  }
  return kept;
}

/** Whether anything actually moved. A stroke-only delta must not rewrite the
 *  flattened block and re-queue an embedding for text nobody touched. */
function changed(before: unknown[], after: unknown[]): boolean {
  return before.length !== after.length || JSON.stringify(before) !== JSON.stringify(after);
}

function validateIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) throw new DomainError("remove must be an array", "bad_delta", 400);
  if (ids.length > MAX_REMOVE) throw new DomainError("too many strokes removed at once", "bad_delta", 400);
  return ids.map((id) => {
    if (typeof id !== "string" || id.length === 0 || id.length > 64) {
      throw new DomainError("each removed id is a short string", "bad_delta", 400);
    }
    return id;
  });
}

/** Validated in batches so the per-batch cap does not become a page cap:
 *  lassoing half a page and recolouring it is one legitimate operation. */
function validateUpserts(raw: unknown): Stroke[] {
  if (!Array.isArray(raw)) throw new DomainError("upsert must be an array", "bad_delta", 400);
  const strokes: Stroke[] = [];
  for (let i = 0; i < raw.length; i += MAX_BATCH) {
    strokes.push(...validateStrokes(raw.slice(i, i + MAX_BATCH)));
  }
  return strokes;
}
