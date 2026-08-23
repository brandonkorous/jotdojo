import { exportNote, type ExportNote } from "@jotacular/domain";
import { svgToPng } from "@jotacular/ink-render/raster";
import { requireActor } from "@/lib/session";
import { inkOf, inkSvg, noteMarkdown, slugOf } from "@/lib/export-files";
import { zipNotes } from "@/lib/export-zip";
import { download, notFound, refusal } from "@/lib/export-response";

/**
 * Take a note away with you. ADR-067.
 *
 * GET  /export/note/<id>?format=md|svg|png|zip
 * POST /export/note/<id>   {format, strokeIds}   -- just what the lasso caught
 *
 * The POST exists because a selection can be hundreds of stroke ids and a URL
 * cannot carry them. It reads nothing from the client but the ids: the strokes
 * themselves are taken from the server's copy of the page, so an export cannot
 * contain anything that was not saved.
 */

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ noteId: string }> };

export async function GET(request: Request, { params }: Params): Promise<Response> {
  const actor = await requireActor();
  const { noteId } = await params;
  const format = new URL(request.url).searchParams.get("format") ?? "md";

  let note: ExportNote;
  try {
    note = await exportNote(actor, noteId);
  } catch (err) {
    return refusal(err, "That note does not exist, or you cannot reach it.");
  }

  const name = slugOf(note);
  if (format === "zip") {
    return download(await zipNotes([note]), "application/zip", `${name}.zip`);
  }
  if (format === "svg" || format === "png") return picture(note, format, name);
  if (format === "md") {
    // No attachment list on a bare markdown download: the links would point at
    // files that are not there. Somebody who wants those wants the zip.
    return download(noteMarkdown(note, []), "text/markdown; charset=utf-8", `${name}.md`);
  }
  return notFound("Ask for format=md, svg, png or zip.");
}

export async function POST(request: Request, { params }: Params): Promise<Response> {
  const actor = await requireActor();
  const { noteId } = await params;

  const body = await request.json().catch(() => null) as
    { format?: unknown; strokeIds?: unknown } | null;
  const format = body?.format === "png" ? "png" : "svg";
  const ids = Array.isArray(body?.strokeIds)
    ? body.strokeIds.filter((id): id is string => typeof id === "string")
    : [];
  if (ids.length === 0) return notFound("Nothing was selected.");

  let note: ExportNote;
  try {
    note = await exportNote(actor, noteId);
  } catch (err) {
    return refusal(err, "That note does not exist, or you cannot reach it.");
  }
  return picture(note, format, `${slugOf(note)}-selection`, new Set(ids));
}

/**
 * The handwriting, as a picture.
 *
 * `viewing` mode rather than `recognition`: this is for a person, so the pen
 * colours survive and the page is drawn on white paper rather than nothing at
 * all. A transparent PNG opened against a dark background is invisible ink.
 */
async function picture(
  note: ExportNote, format: "svg" | "png", name: string, only?: Set<string>,
): Promise<Response> {
  const block = inkOf(note);
  const svg = block ? inkSvg(block, only) : null;
  if (!svg) {
    return notFound(only
      ? "None of the selected strokes are on the saved page yet."
      : "There is no handwriting on that note to draw.");
  }
  if (format === "svg") {
    return download(svg, "image/svg+xml; charset=utf-8", `${name}.svg`);
  }
  return download(await svgToPng(svg), "image/png", `${name}.png`);
}
