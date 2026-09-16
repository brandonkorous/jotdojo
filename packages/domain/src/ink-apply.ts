import { type Tx } from "@jotacular/db";
import { DomainError } from "./errors";
import { MAX_STROKES, type Stroke } from "./ink-doc";
import { MAX_TEXTS, type TextBox } from "./ink-text";
import { syncTextBlock } from "./ink-text-block";
import { MAX_IMAGES, type ImageOnPage } from "./ink-image";
import { MAX_LINKS, orphanedBy, type Link } from "./ink-link";
import { MAX_STICKERS, type Sticker } from "./ink-sticker";
import {
  bumpPage, writeTexts, writeImages, writeLinks, writeStickers,
  type PageObjects,
} from "./ink-page";

/**
 * Folding a checked delta into the page it changes. ADR-058, ADR-108.
 *
 * Split from ink-delta.ts when arrows took that file past its limit, and the
 * seam is a real one: ink-delta.ts is the WIRE CONTRACT -- what a client may
 * say and what is refused -- while this is what saying it does to four arrays
 * and four statements. The two change for different reasons, and only one of
 * them touches a transaction.
 */

/** A delta whose every field has been checked, with `null` meaning "said
 *  nothing about this kind" -- which is not the same as "there is none". */
export type Parts = {
  remove: string[];
  upsert: Stroke[];
  texts: TextBox[] | null;
  images: ImageOnPage[] | null;
  links: Link[] | null;
  stickers: Sticker[] | null;
};

/** What `store` needs of the page besides its objects. */
export type LockedRow = { artifactId: string; noteId: string; spaceId: string };

/**
 * The page the delta asks for, with every ceiling checked before anything is
 * written. `remove` spans every kind, so a delta that only deletes still has
 * to reach all four arrays -- otherwise a lasso holding one stroke and one box
 * deletes the stroke and leaves the box behind.
 */
export function nextPage(row: PageObjects, parts: Parts): PageObjects {
  const next = {
    strokes: mergeById(row.strokes, parts.remove, parts.upsert),
    texts: mergeById(row.texts, parts.remove, parts.texts),
    images: mergeById(row.images, parts.remove, parts.images),
    links: mergeById(row.links, parts.remove, parts.links),
    stickers: mergeById(row.stickers, parts.remove, parts.stickers),
  };
  ceiling(next.strokes.length, MAX_STROKES, "strokes");
  ceiling(next.texts.length, MAX_TEXTS, "text boxes");
  ceiling(next.images.length, MAX_IMAGES, "images");
  ceiling(next.links.length, MAX_LINKS, "arrows");
  ceiling(next.stickers.length, MAX_STICKERS, "stickers");
  // An arrow outlives neither of the things it ties. ADR-108 says why this is
  // the one place a page disagrees with a comment.
  const orphans = new Set(orphanedBy(next.links, new Set(parts.remove)));
  next.links = next.links.filter((l) => !orphans.has(l.id));
  return next;
}

function ceiling(count: number, max: number, what: string): void {
  if (count > max) {
    throw new DomainError(`this page has too many ${what}`, "page_full", 400);
  }
}

/**
 * Write whatever moved, and only that.
 *
 * The version returned is the last one written, because each statement bumps
 * it. A stroke-only delta must not rewrite the flattened block and re-queue an
 * embedding for text nobody touched.
 */
export async function store(
  tx: Tx, row: PageObjects & LockedRow, next: PageObjects,
): Promise<number> {
  let version = await bumpPage(tx, row.artifactId, next.strokes);
  const texts = changed(row.texts, next.texts);
  const links = changed(row.links, next.links);
  const stickers = changed(row.stickers, next.stickers);
  if (texts) version = await writeTexts(tx, row.artifactId, next.texts);
  if (links) version = await writeLinks(tx, row.artifactId, next.links);
  if (stickers) version = await writeStickers(tx, row.artifactId, next.stickers);
  // The searchable copy, in the same transaction. A box that is saved but not
  // indexed is invisible to search forever with nothing to indicate it -- and
  // an arrow is only worth storing because it becomes a sentence there.
  // Stickers join that for one reason: a page marked with three fires should
  // be findable by searching for fire. ink-sticker.ts tallies them. ADR-115.
  if (texts || links || stickers) {
    await syncTextBlock(tx, row, next.texts, next.links, next.stickers);
  }
  // No companion row: an image's searchable text is its vision transcript,
  // which lives on the block that owns the bytes and did not move. ADR-103.
  if (changed(row.images, next.images)) {
    version = await writeImages(tx, row.artifactId, next.images);
  }
  return version;
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
 * ONE function for strokes, boxes, images and arrows. It was three
 * near-identical copies, and the third was the one that made the duplication a
 * liability rather than a smell. ADR-103.
 */
export function mergeById<T extends { id: string }>(
  page: readonly T[], remove: readonly string[], next: readonly T[] | null,
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
/** Whether one kind of object on the page actually moved. Exported because
 *  what to re-read, and what to BILL for re-reading, is the same question. */
export function changed(before: unknown[], after: unknown[]): boolean {
  return before.length !== after.length || JSON.stringify(before) !== JSON.stringify(after);
}
