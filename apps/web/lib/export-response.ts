import { DomainError } from "@jotacular/domain";

/**
 * How a download leaves the building. ADR-067.
 *
 * The first `content-disposition` in the repo, and the reason it needs saying
 * out loud: without it a browser renders the markdown as a wall of text and
 * "export" becomes "select all, copy". The header is the whole difference
 * between a file and a page.
 */

export function download(
  body: string | Uint8Array, contentType: string, filename: string,
): Response {
  return new Response(body as BodyInit, {
    headers: {
      "content-type": contentType,
      // The filename is built from a slug of [a-z0-9-] plus an id, so there is
      // nothing here to quote-escape. Anything else must be sanitised first.
      "content-disposition": `attachment; filename="${filename}"`,
      // Somebody's notes. Not something to leave in a shared cache, and not
      // something a back button should re-serve from disk on a borrowed laptop.
      "cache-control": "private, no-store",
    },
  });
}

/**
 * The same answer for "no such note" and "not yours", and only for those.
 *
 * A different error for each would confirm the note exists. Anything that is
 * NOT a refusal is rethrown: a storage outage answering "that does not exist"
 * is how a real fault gets closed as user error. ADR-020.
 */
export function refusal(err: unknown, message: string): Response {
  if (err instanceof DomainError && (err.status === 403 || err.status === 404)) {
    return notFound(message);
  }
  throw err;
}

/** Plain text, because this arrives in a browser tab after a link click rather
 *  than in a fetch that would parse JSON. */
export function notFound(message: string): Response {
  return new Response(`${message}\n`, {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
