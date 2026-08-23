import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  resolveCaptureToken, captureNote, createMediaBlock, finalizeMedia,
  DomainError, type Actor,
} from "@jotacular/domain";

/**
 * A photo from a Shortcut, in three steps. ADR-064.
 *
 * NOT a multipart upload, and that is the whole design. docs/04 requires that
 * media bytes never pass through this service -- on Azure the client PUTs
 * straight to Blob with a time-limited SAS URL, and our servers only ever hold
 * the metadata. Accepting the file here to forward it would put every photo
 * anybody ever captures through a process sized for 1KB of JSON, and would make
 * a public endpoint authenticated by a long-lived bearer token into an upload
 * proxy.
 *
 * So a Shortcut does what the browser does:
 *
 *   POST /v1/capture/media        reserve a block, get somewhere to put it
 *   PUT  <upload_url>             the bytes, straight to storage
 *   POST /v1/capture/media/:id    say how many bytes arrived
 *
 * Three requests instead of one is awkward. Shortcuts chains them without
 * complaint, and awkward is a better trade than a byte proxy.
 */

type ReserveBody = {
  kind?: string;
  content_type?: string;
  note_id?: string;
  /** Text to put on the note this photo lands on. A receipt with "van hire" on
   *  it is far easier to find later than a receipt on its own. */
  text?: string;
  url?: string;
  title?: string;
  request_id?: string;
  source?: string;
};

type FinalizeBody = {
  byte_size?: number;
  width?: number;
  height?: number;
  duration_ms?: number;
};

const fail = (reply: FastifyReply, status: number, code: string, message: string) =>
  reply.code(status).send({ success: false, error: { code, message } });

async function actorFor(request: FastifyRequest, reply: FastifyReply): Promise<Actor | null> {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) {
    void fail(reply, 401, "UNAUTHORIZED", "Missing bearer token");
    return null;
  }
  const actor = await resolveCaptureToken(token);
  if (!actor) {
    void fail(reply, 401, "UNAUTHORIZED", "That capture token is not valid or was revoked");
    return null;
  }
  return actor;
}

function domainError(reply: FastifyReply, err: unknown): FastifyReply {
  if (err instanceof DomainError) {
    return fail(reply, err.status, err.code.toUpperCase(), err.message);
  }
  throw err;
}

export function registerCaptureMedia(app: FastifyInstance, appUrl: string) {
  app.post("/v1/capture/media", async (request, reply) => {
    const actor = await actorFor(request, reply);
    if (!actor) return reply;

    const body = (request.body ?? {}) as ReserveBody;
    const kind = body.kind === "audio" ? "audio" : "image";
    const contentType = typeof body.content_type === "string" ? body.content_type : "";
    if (!contentType) {
      return fail(reply, 400, "EMPTY", "content_type is required, e.g. image/jpeg");
    }

    try {
      // A photo needs somewhere to live. Reusing a note id lets a Shortcut put
      // several photos on one note; without one it makes a note, which is what
      // "Snap" does, and any text supplied comes with it.
      const noteId = body.note_id ?? (await captureNote(actor, {
        title: body.title, text: body.text, url: body.url,
        requestId: body.request_id ?? null,
        source: body.source ?? "shortcut",
      }).catch(fallbackNote(actor, kind))).noteId;

      const slot = await createMediaBlock(actor, noteId, kind, contentType);
      return reply.code(201).send({
        success: true,
        note_id: noteId,
        block_id: slot.blockId,
        upload_url: slot.url,
        upload_headers: slot.headers,
        url: `${appUrl}/n/${noteId}`,
      });
    } catch (err) {
      return domainError(reply, err);
    }
  });

  app.post<{ Params: { blockId: string } }>(
    "/v1/capture/media/:blockId",
    async (request, reply) => {
      const actor = await actorFor(request, reply);
      if (!actor) return reply;

      const body = (request.body ?? {}) as FinalizeBody;
      const size = Number(body.byte_size);
      // The size is a CLAIM, checked here and rechecked by the worker against
      // what it actually reads. Trusting it would let a client reserve a block
      // for "2KB" and upload two gigabytes.
      if (!Number.isFinite(size) || size <= 0) {
        return fail(reply, 400, "EMPTY", "byte_size must be the number of bytes uploaded");
      }

      try {
        await finalizeMedia(actor, request.params.blockId, {
          byteSize: size,
          width: body.width,
          height: body.height,
          durationMs: body.duration_ms,
        });
        return reply.code(200).send({ success: true, block_id: request.params.blockId });
      } catch (err) {
        return domainError(reply, err);
      }
    },
  );
}

/**
 * A photo with no words on it still needs a note.
 *
 * `captureNote` refuses an empty capture, which is right for text and wrong
 * here -- the picture IS the capture. This gives it a first line so it does not
 * land in the list as an untitled blank row.
 */
const fallbackNote = (actor: Actor, kind: string) => async (err: unknown) => {
  if (!(err instanceof DomainError) || err.status !== 404) throw err;
  return captureNote(actor, {
    text: kind === "audio" ? "Recording" : "Photo",
    source: "shortcut",
  });
};
