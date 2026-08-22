import Fastify from "fastify";
import {
  resolveCaptureToken, captureNote, RateLimited, DomainError,
} from "@jotdojo/domain";

const PORT = Number(process.env.API_PORT ?? 3401);
const APP_URL = process.env.APP_URL ?? "http://localhost:3400";

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? "info" },
  // Shortcuts send small JSON. A generous body would only widen the abuse
  // surface on an endpoint authenticated by a long-lived bearer token.
  bodyLimit: 1_000_000,
});

app.get("/health", async () => ({ ok: true }));

// Development only. See apps/api/src/media.ts -- on Azure the browser uploads
// straight to Blob and these routes do not exist.
if (process.env.STORAGE_PROVIDER?.toLowerCase() === "local") {
  const { registerMediaRoutes } = await import("./media.js");
  registerMediaRoutes(app);
  app.log.info("local media routes registered (development only)");
}

/**
 * A helpful 404 rather than a blank one.
 *
 * Borrowed from kanninja's MCP host, which answers a bare GET / by naming the
 * real path. Someone pasting the host into a browser should be told where to
 * go, not left guessing.
 */
app.setNotFoundHandler((request, reply) => {
  reply.code(404).send({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `No route for ${request.method} ${request.url}. The capture endpoint is POST /v1/capture on this host.`,
    },
  });
});

type CaptureBody = {
  text?: string;
  request_id?: string;
  source?: string;
};

app.post("/v1/capture", async (request, reply) => {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) {
    return reply.code(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Missing bearer token" },
    });
  }

  const actor = await resolveCaptureToken(token);
  if (!actor) {
    return reply.code(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "That capture token is not valid or was revoked" },
    });
  }

  const body = (request.body ?? {}) as CaptureBody;
  const text = typeof body.text === "string" ? body.text : "";

  if (!text.trim()) {
    return reply.code(400).send({
      success: false,
      error: { code: "EMPTY", message: "Nothing to capture" },
    });
  }

  try {
    const result = await captureNote(actor, {
      text,
      requestId: body.request_id ?? null,
      source: body.source ?? null,
    });

    // 200 on a deduplicated retry, 201 on a new note -- so a Shortcut retrying
    // over a flaky connection is told plainly that nothing was duplicated.
    return reply.code(result.deduplicated ? 200 : 201).send({
      success: true,
      note_id: result.noteId,
      url: `${APP_URL}/n/${result.noteId}`,
      deduplicated: result.deduplicated,
    });
  } catch (err) {
    if (err instanceof RateLimited) {
      return reply.code(429).send({
        success: false,
        error: { code: "RATE_LIMITED", message: "Too many captures in a short window" },
      });
    }
    if (err instanceof DomainError) {
      return reply.code(err.status).send({
        success: false,
        error: { code: err.code.toUpperCase(), message: err.message },
      });
    }
    request.log.error({ err }, "capture failed");
    return reply.code(500).send({
      success: false,
      error: { code: "INTERNAL", message: "That did not send. Try again." },
    });
  }
});

await app.listen({ port: PORT, host: "0.0.0.0" });
