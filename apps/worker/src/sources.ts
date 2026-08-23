import type { ReadKind } from "@jotdojo/domain";

/**
 * What read a transcript, and how. docs/04.
 *
 * One definition, because re-reading (ADR-046) decides what is stale by
 * comparing a stored source against the one we would write now. If these two
 * strings were built in two places, a change to the format would not look like
 * a bug -- it would look like every block in the database suddenly needing to
 * be read again, and it would bill accordingly.
 */
/**
 * The ink RENDERER generation, which is part of what read the page.
 *
 * Ink is the one kind where we build the image the model sees, so the renderer
 * is as much "how it was read" as the model is. r2 is the geometry rework:
 * before it, the frame came from a stored canvas written once at creation, so
 * anything drawn outside it was clipped out of the read silently and
 * permanently (ADR-053). Every ink block read under r1 was read through that.
 *
 * Bumping this makes the whole existing ink corpus visible to `countStale`, so
 * `reread` can offer to fix it -- opt-in and cost-previewed, as ADR-046
 * insists. Deliberately NOT applied to image or audio: nothing changed about
 * how those are read, and marking them stale would bill for identical answers.
 */
const INK_RENDERER = "r2";

export function sourceFor(
  kind: ReadKind, models: { vision?: string; speech?: string },
): string {
  if (kind === "ink") return `htr:vlm:${models.vision}/${INK_RENDERER}`;
  if (kind === "image") return `caption:vlm:${models.vision}`;
  return `asr:${models.speech}`;
}

/**
 * What read a page's STRUCTURE, and how. ADR-066.
 *
 * Its OWN key, in its own column, and 0026 explains why at length: suffixing
 * `transcript_source` would make every structured block permanently stale to
 * `countStale`, and re-bill the entire corpus for readings that had not
 * changed. Two questions, two answers, two staleness keys.
 */
export function structureSourceFor(model: string | undefined): string {
  return `struct:vlm:${model}/${INK_RENDERER}`;
}
