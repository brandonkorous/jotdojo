import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { verifyAccessToken, DomainError, type TokenRefusal } from "@jotacular/domain";
import { registerTools } from "./tools.js";

const PORT = Number(process.env.MCP_PORT ?? 3402);
const RESOURCE = process.env.MCP_RESOURCE ?? `http://localhost:${PORT}/mcp`;
const AS_ISSUER = process.env.APP_URL ?? "http://localhost:3400";

/**
 * Two causes with opposite fixes, so two sentences. A wrong address is the
 * agent's to correct; a token that is not current must never be retried as-is.
 * Issue 024.
 */
const REFUSED: Record<TokenRefusal, string> = {
  wrong_server: "That token was issued for a different server. Check the address you connected to.",
  not_current: "That token is not current. Refresh it — if the refresh is refused too, the person has disconnected you.",
};

const json = (res: import("node:http").ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  /**
   * RFC 9728 Protected Resource Metadata.
   *
   * This is the whole reason apps/mcp can be a pure resource server: it points
   * at the authorization server rather than being one. /authorize needs a
   * signed-in human and the session cookie lives on the web app's origin, so
   * hosting it here would mean a cross-domain session with no good answer.
   */
  if (url.pathname === "/.well-known/oauth-protected-resource") {
    return json(res, 200, {
      resource: RESOURCE,
      authorization_servers: [AS_ISSUER],
      scopes_supported: ["notes:read", "notes:comment", "notes:append"],
      bearer_methods_supported: ["header"],
    }, { "cache-control": "public, max-age=300" });
  }

  if (url.pathname === "/health") return json(res, 200, { ok: true });

  if (url.pathname !== "/mcp") {
    // Helpful rather than blank, the way kanninja's host answers a bare GET.
    return json(res, 404, {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `No route for ${req.method} ${url.pathname}. The MCP endpoint is /mcp on this host.`,
      },
    });
  }

  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;

  // The 401 carries the pointer to our metadata, which is how a client
  // discovers where to authorize. Without this header it cannot begin.
  const unauthorized = (message: string) =>
    json(res, 401, { error: "unauthorized", error_description: message }, {
      "www-authenticate":
        `Bearer resource_metadata="${RESOURCE.replace(/\/mcp$/, "")}/.well-known/oauth-protected-resource"`,
    });

  if (!token) return unauthorized("A bearer token is required");

  // The audience check is the confused-deputy defence: a token minted for
  // kanninja must not work here. RFC 8707.
  const check = await verifyAccessToken(token, RESOURCE);
  if (!check.ok) return unauthorized(REFUSED[check.why]);
  const actor = check.actor;

  const mcp = new McpServer(
    { name: "jotacular", version: "0.1.0" },
    {
      instructions:
        "Jotacular holds the user's captured notes -- typed, handwritten, spoken and " +
        "photographed. A note is the user's own words, and handwriting is kept as " +
        "strokes, so a page can be looked at as well as read. Comments are the record " +
        "of anything said about a note; every agent write is attributed and revertible.",
    },
  );

  registerTools(mcp as never, actor);

  // Stateless: a fresh transport per request. Simpler than session management,
  // and correct for a server whose tools are all short reads and writes.
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => { void transport.close(); void mcp.close(); });

  try {
    await mcp.connect(transport);
    await transport.handleRequest(req, res);
  } catch (err) {
    if (!res.headersSent) {
      const status = err instanceof DomainError ? err.status : 500;
      json(res, status, { error: "server_error", error_description: (err as Error).message });
    }
  }
});

server.listen(PORT, () => {
  console.log(`jotacular mcp listening on http://localhost:${PORT}/mcp (resource: ${RESOURCE})`);
});
