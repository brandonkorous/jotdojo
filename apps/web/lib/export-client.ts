/**
 * Save a selection as a picture. ADR-067.
 *
 * A POST rather than a link, because a lasso can hold hundreds of stroke ids
 * and a URL cannot carry them -- so the response arrives as bytes rather than
 * as a navigation, and the anchor below is what turns it into a file.
 *
 * The ids go up and the strokes stay here. Whatever comes back is rendered from
 * the SERVER's copy of the page, which means an export can never contain a
 * stroke that has not been saved.
 */
export async function downloadSelection(
  noteId: string, strokeIds: string[], format: "png" | "svg" = "png",
): Promise<void> {
  if (strokeIds.length === 0) return;

  const response = await fetch(`/export/note/${noteId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ format, strokeIds }),
  });
  if (!response.ok) return;

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filenameOf(response) ?? `selection.${format}`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revoked, or the blob is held for the life of the document. A page somebody
  // draws on all afternoon would accumulate one of these per export.
  URL.revokeObjectURL(url);
}

/** The server already named the file. Parsing it back beats guessing, and the
 *  name carries the note's title, which is the point of it. */
function filenameOf(response: Response): string | null {
  const header = response.headers.get("content-disposition") ?? "";
  return /filename="([^"]+)"/.exec(header)?.[1] ?? null;
}
