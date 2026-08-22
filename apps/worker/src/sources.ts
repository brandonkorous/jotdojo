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
export function sourceFor(
  kind: ReadKind, models: { vision?: string; speech?: string },
): string {
  if (kind === "ink") return `htr:vlm:${models.vision}`;
  if (kind === "image") return `caption:vlm:${models.vision}`;
  return `asr:${models.speech}`;
}
