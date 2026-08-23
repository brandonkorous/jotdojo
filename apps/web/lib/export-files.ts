import { renderNote, type ExportBlock, type ExportNote } from "@jotacular/domain";
import { contentBounds, toSvg } from "@jotacular/ink-render";

/**
 * What one note becomes on somebody's disk. ADR-067.
 *
 * Markdown for the words, SVG for the handwriting, the original bytes for
 * everything else. The transcript goes in the markdown AND the strokes come
 * with it, because a machine reading is a guess and the ink is the fact -- an
 * export that kept only the guess would be lossy in the one direction that
 * cannot be undone.
 */

/** Long enough to recognise a note by, short enough not to break a zip on
 *  Windows, where the whole path is capped at 260 characters. */
const SLUG_MAX = 48;

export function slugOf(note: ExportNote): string {
  const slug = (note.title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/, "");
  // The id tail, always. Two notes called "groceries" are the normal case, and
  // silently overwriting one of them inside the archive would be data loss
  // dressed up as a filename collision.
  return `${slug || "untitled"}-${note.id.slice(0, 8)}`;
}

/** A note's handwriting layer, if it has one with anything on it. */
export function inkOf(note: ExportNote): ExportBlock | null {
  return note.blocks.find((b) => b.kind === "ink"
    && ((b.document?.strokes.length ?? 0) > 0 || (b.document?.texts?.length ?? 0) > 0)) ?? null;
}

/**
 * The page as a picture, or null when there is nothing to draw.
 *
 * Null rather than a blank image: a 1x1 transparent PNG in a zip looks like a
 * bug in the export, and offering it as "your drawing" is worse than saying
 * there was no drawing.
 */
export function inkSvg(block: ExportBlock, only?: Set<string>): string | null {
  const doc = block.document;
  if (!doc) return null;
  const strokes = only ? doc.strokes.filter((s) => only.has(s.id)) : doc.strokes;
  // A selection crops to the selection, and that includes its text boxes.
  const texts = only ? (doc.texts ?? []).filter((t) => only.has(t.id)) : (doc.texts ?? []);
  if (strokes.length === 0 && texts.length === 0) return null;

  const page = { ...doc, strokes, texts };
  // `text: true` because this is for a person, who expects to see what is on
  // the page. Recognition never sets it, for the reason RenderOptions gives.
  // ADR-065.
  if (!contentBounds(page)) return null;
  return toSvg(page, { mode: "viewing", text: true });
}

export type Attachment = { block: ExportBlock; path: string };

/** The artifact files this note contributes, named by block so a transcript in
 *  the markdown and the original it came from are matchable by eye. */
export function attachmentsOf(note: ExportNote): Attachment[] {
  return note.blocks.flatMap((block) => {
    if (block.kind === "ink") {
      return inkSvg(block) ? [{ block, path: `ink/${block.id}.svg` }] : [];
    }
    if (!block.blobUrl) return [];
    return [{ block, path: `artifacts/${block.id}.${extensionOf(block.blobUrl)}` }];
  });
}

/** The storage key already carries one -- mediaKey wrote it. Guessing again
 *  from the mime type would be a second answer to a settled question. */
function extensionOf(blobUrl: string): string {
  const tail = blobUrl.split("/").pop() ?? "";
  const dot = tail.lastIndexOf(".");
  const ext = dot === -1 ? "" : tail.slice(dot + 1);
  return /^[a-z0-9]{1,5}$/i.test(ext) ? ext.toLowerCase() : "bin";
}

/**
 * One note as markdown, with its attachments listed underneath.
 *
 * `renderNote` is the same call MCP makes, so what a person downloads and what
 * an agent reads are the same account of the same page. The file list is added
 * here rather than there: a relative path means nothing over a tool call.
 */
export function noteMarkdown(note: ExportNote, attachments: Attachment[]): string {
  const body = renderNote(note);
  if (attachments.length === 0) return `${body}\n`;

  const lines = attachments.map(({ block, path }) => {
    const label = { ink: "handwriting", image: "photo", audio: "recording" }[block.kind]
      ?? block.kind;
    return `- ${label}: [${path.split("/").pop()}](../${path})`;
  });
  return `${body}\n\n## Attachments\n\n${lines.join("\n")}\n`;
}
