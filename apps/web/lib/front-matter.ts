/**
 * Front matter, without a YAML parser.
 *
 * The vocabulary is a handful of known keys with string values, so a parser
 * would be more code than the thing it parses -- and would invite the ninth key
 * that makes the pages inconsistent.
 */
export function splitFrontMatter(
  raw: string,
): { meta: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) return { meta: {}, body: raw };

  const meta: Record<string, string> = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    const at = line.indexOf(":");
    if (at > 0) meta[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return { meta, body: raw.slice(match[0].length) };
}
