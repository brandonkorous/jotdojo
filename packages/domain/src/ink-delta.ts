import { withActor } from "@jotacular/db";
import { canReachSpace, hasScope, type Actor } from "./actor";
import { Forbidden, NotFound, DomainError } from "./errors";
import { validateStrokes, MAX_BATCH, type Stroke } from "./ink-doc";
import { validateTexts, type TextBox } from "./ink-text";
import { validateImages, type ImageOnPage } from "./ink-image";
import { validateLinks, type Link } from "./ink-link";
import { validateStickers, type Sticker } from "./ink-sticker";
import { markPageChanged, announceInk } from "./ink-recognition";
import { lockPage } from "./ink-page";
import { changed, nextPage, store, type Parts } from "./ink-apply";

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
 *
 * WHAT A DELTA MEANS is here. What applying one DOES is ink-apply.ts.
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
  /**
   * The arrows between things, same rules again. ADR-108.
   *
   * An arrow does NOT have to be named in `remove` to go: removing either of
   * the objects it ties takes it with them, which `orphanedBy` decides.
   */
  links?: Link[];
  /**
   * The stickers stuck on the page, same rules again. ADR-115.
   *
   * A sticker is named in `remove` like anything else, and an arrow tied to
   * one dies with it -- `orphanedBy` does not care what kind of thing an id
   * belonged to.
   */
  stickers?: Sticker[];
};

/** Erasing a big scribble can touch a lot of strokes; this is still a guard. */
const MAX_REMOVE = 5_000;

export async function applyInkDelta(
  actor: Actor, blockId: string, delta: InkDelta,
): Promise<{ strokeCount: number; version: number }> {
  if (!hasScope(actor, "notes:write") && !hasScope(actor, "capture:write")) {
    throw new Forbidden("This connection cannot write notes");
  }

  const parts = validated(delta);

  const page = await withActor(actor.userId, async (tx) => {
    const row = await lockPage(tx, blockId);
    if (!canReachSpace(actor, row.spaceId)) {
      throw new NotFound("That ink block does not exist, or you cannot reach it");
    }
    const next = nextPage(row, parts);
    const version = await store(tx, row, next);
    // Only when the HANDWRITING moved. Typing a note onto a page that happens
    // to have a doodle on it used to queue a fresh reading of the doodle, and a
    // recognition is billed whether or not it had anything new to look at.
    // Issue 022.
    const inkMoved = changed(row.strokes, next.strokes);
    await markPageChanged(tx, { blockId, noteId: row.noteId },
      inkMoved && next.strokes.length > 0);
    return { ...row, strokeCount: next.strokes.length, version };
  });

  announceInk(page, blockId, page.strokeCount, page.version);
  return { strokeCount: page.strokeCount, version: page.version };
}

/**
 * Check every field, and refuse a delta that says nothing.
 *
 * `undefined` and `[]` are different answers and the difference is load
 * bearing: the first says "I did not touch this kind", and the second says
 * "there is none of it left". A validator that collapsed them would let a
 * stroke-only erase wipe the page's typed boxes.
 */
function validated(delta: InkDelta): Parts {
  const parts: Parts = {
    remove: validateIds(delta.remove ?? []),
    upsert: validateUpserts(delta.upsert ?? []),
    texts: delta.texts === undefined ? null : validateTexts(delta.texts),
    images: delta.images === undefined ? null : validateImages(delta.images),
    links: delta.links === undefined ? null : validateLinks(delta.links),
    stickers: delta.stickers === undefined ? null : validateStickers(delta.stickers),
  };
  if (parts.remove.length === 0 && parts.upsert.length === 0
    && parts.texts === null && parts.images === null && parts.links === null
    && parts.stickers === null) {
    throw new DomainError("a delta must change something", "empty_delta", 400);
  }
  return parts;
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
