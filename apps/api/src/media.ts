import { readFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import type { FastifyInstance } from "fastify";
import { verifyLocalSignature, writeLocal } from "@jotdojo/storage";

/**
 * The endpoints the LOCAL storage driver's signed URLs point at.
 *
 * Registered only when STORAGE_PROVIDER=local, and that driver refuses to
 * resolve at all when NODE_ENV=production. On Azure the browser PUTs straight
 * to Blob with a SAS URL and none of this exists -- docs/04 is explicit that
 * media bytes must never be proxied through the API, and this is the
 * development-only exception, not a fallback.
 *
 * The signature is checked properly rather than waved through. A dev-only route
 * that accepted unsigned writes would be an open upload endpoint on a laptop
 * that is, more often than anyone admits, reachable from a coffee shop network.
 */
export function registerMediaRoutes(app: FastifyInstance) {
  const root = process.env.STORAGE_LOCAL_ROOT ?? ".media";
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("STORAGE_PROVIDER=local needs AUTH_SECRET");

  const MAX_BYTES = 200 * 1024 * 1024;

  // Raw bytes, not JSON. Without this Fastify replies 415 to every upload.
  //
  // A RegExp, not "image/*" -- Fastify matches content-type strings exactly or
  // by prefix and treats a glob as a literal, so the string form matches
  // nothing and every upload 415s while looking correctly configured.
  app.addContentTypeParser(
    /^(image|audio)\//,
    { parseAs: "buffer", bodyLimit: MAX_BYTES },
    (_req, body, done) => done(null, body as Buffer),
  );
  app.addContentTypeParser(
    "application/octet-stream",
    { parseAs: "buffer", bodyLimit: MAX_BYTES },
    (_req, body, done) => done(null, body as Buffer),
  );

  type Params = { "*": string };
  type Query = { expires?: string; sig?: string };

  const check = (key: string, verb: string, query: Query): boolean =>
    Boolean(query.expires && query.sig)
    && verifyLocalSignature(secret, key, verb, query.expires!, query.sig!);

  app.put<{ Params: Params; Querystring: Query }>("/v1/media/*", async (request, reply) => {
    const key = request.params["*"];
    if (!check(key, "PUT", request.query)) {
      return reply.code(403).send({
        success: false,
        error: { code: "BAD_SIGNATURE", message: "That upload link is not valid or has expired." },
      });
    }

    const body = request.body as Buffer | undefined;
    if (!body?.length) {
      return reply.code(400).send({
        success: false,
        error: { code: "EMPTY", message: "No bytes were sent." },
      });
    }

    await writeLocal(root, key, new Uint8Array(body));
    return reply.code(201).send({ success: true, bytes: body.length });
  });

  app.get<{ Params: Params; Querystring: Query }>("/v1/media/*", async (request, reply) => {
    const key = request.params["*"];
    if (!check(key, "GET", request.query)) {
      return reply.code(403).send({
        success: false,
        error: { code: "BAD_SIGNATURE", message: "That link is not valid or has expired." },
      });
    }

    // Checked here as well as in writeLocal: this key arrives straight off the
    // URL path, and "the signature covers it" is not the same as "it is safe".
    // A signed traversal is still a traversal.
    const rootAbs = resolve(root);
    const full = resolve(join(rootAbs, key));
    if (full !== rootAbs && !full.startsWith(rootAbs + sep)) {
      return reply.code(400).send({
        success: false,
        error: { code: "BAD_KEY", message: "Not a valid media key." },
      });
    }

    try {
      const bytes = await readFile(full);
      return reply
        .header("cache-control", "private, max-age=300")
        .type(request.query.expires ? "application/octet-stream" : "application/octet-stream")
        .send(bytes);
    } catch {
      return reply.code(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "No media at that key." },
      });
    }
  });
}
