/**
 * A shared thing, as a note. ADR-064.
 *
 * Three fields arrive from a share sheet -- a title, some text, a URL -- and
 * every door has to turn them into the same note. `share/route.ts` was joining
 * them with blank lines and the capture API was ignoring two of the three, so a
 * link shared from Android and the same link sent by a Shortcut produced
 * different notes.
 *
 * It lives in the domain because that is where the rule belongs, not because
 * either caller was long.
 */

export type Shared = {
  /** The page title, when the platform supplies one. Android does; a Shortcut
   *  can, if whoever built it thought to. */
  title?: string | null;
  text?: string | null;
  url?: string | null;
};

/**
 * The body, first line first.
 *
 * `inferTitle` names a note from its first non-empty line, so the ORDER here is
 * the whole design: whatever a person would call this thing goes at the top.
 */
export function captureText(shared: Shared): string {
  const title = clean(shared.title);
  const text = clean(shared.text);
  const url = clean(shared.url);

  const lines = [title, text, url].filter(Boolean);
  if (lines.length > 0 && (title || text)) return lines.join("\n\n");

  // A bare URL and nothing else -- the commonest share of all, and the one that
  // used to title a note with two hundred characters of query string. The host
  // is what a person calls the thing they just sent themselves.
  if (url) return `${hostOf(url)}\n\n${url}`;
  return "";
}

const clean = (v: string | null | undefined) => (typeof v === "string" ? v.trim() : "");

/**
 * The bit of a URL somebody would say out loud.
 *
 * `www.` goes, because nobody says it. A URL we cannot parse is returned whole
 * rather than replaced with a placeholder: a bad title is recoverable and a
 * lost link is not.
 */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 72);
  }
}
