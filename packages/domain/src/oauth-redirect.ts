/**
 * Does a redirect address belong to this client?
 *
 * Exact match, with the one exception the spec carves out for native apps:
 * RFC 8252 s7.3, ADR-097. Everything else -- wildcards, prefixes -- is a hole.
 */

/** `new URL("http://[::1]:9/x").hostname` keeps the brackets. Both forms here. */
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

const parse = (uri: string): URL | null => {
  try {
    return new URL(uri);
  } catch {
    return null;
  }
};

const isLoopback = (u: URL): boolean =>
  u.protocol === "http:" && LOOPBACK_HOSTS.has(u.hostname);

/**
 * A native client takes an ephemeral port from the OS when the flow starts, so
 * the port cannot be in a document written weeks earlier. Codex registers
 * `http://127.0.0.1/callback/x` and then listens on :52143.
 */
const sameLoopbackSocket = (known: URL, asked: URL): boolean =>
  isLoopback(known)
  && known.hostname === asked.hostname
  && known.pathname === asked.pathname
  && known.search === asked.search;

export function redirectUriIsRegistered(registered: string[], requested: string): boolean {
  if (registered.includes(requested)) return true;

  const asked = parse(requested);
  if (!asked || !isLoopback(asked)) return false;

  return registered.some((uri) => {
    const known = parse(uri);
    return known !== null && sameLoopbackSocket(known, asked);
  });
}
