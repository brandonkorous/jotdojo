import { exportSpace } from "@jotacular/domain";
import { requireActor } from "@/lib/session";
import { zipNotes } from "@/lib/export-zip";
import { download, refusal } from "@/lib/export-response";

/**
 * Everything in a space, as one archive. ADR-067.
 *
 * This is the route the privacy policy has been describing since the site went
 * up -- "a zip of markdown files plus original artifacts" -- and until now it
 * described nothing. There is no `format` here on purpose: a hundred notes is
 * an archive whatever anyone would prefer.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request, { params }: { params: Promise<{ spaceId: string }> },
): Promise<Response> {
  const actor = await requireActor();
  const { spaceId } = await params;

  let notes: Awaited<ReturnType<typeof exportSpace>>;
  try {
    notes = await exportSpace(actor, spaceId);
  } catch (err) {
    return refusal(err, "That space does not exist, or you cannot reach it.");
  }

  const at = new Date();
  // Dated, because this is the kind of file that gets downloaded twice and
  // then compared. `jotacular.zip (2)` answers no question anybody has.
  const name = `jotacular-${at.toISOString().slice(0, 10)}.zip`;
  return download(await zipNotes(notes, at), "application/zip", name);
}
