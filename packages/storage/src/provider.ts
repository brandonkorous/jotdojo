/**
 * Raw artifact storage. docs/04-data-model.md.
 *
 * Ink strokes live in Postgres jsonb -- they are small, they are queried, and
 * they get re-recognized. Audio and images do not: they are megabytes, they are
 * never queried, and they must never be proxied through the API.
 *
 * That last rule is why this interface hands out URLs rather than accepting
 * bytes. On Azure the browser PUTs straight to Blob with a SAS URL and our
 * servers never see the payload. The local driver cannot do that, so it points
 * at an endpoint on the API instead -- which is exactly the thing production
 * must not do, and is therefore refused when NODE_ENV is production.
 */

export type Upload = {
  /** Where the browser should PUT the bytes. */
  url: string;
  /** Headers it must send. Azure SAS uploads require x-ms-blob-type. */
  headers: Record<string, string>;
  /** The stable key, stored on media_assets.blob_url. */
  key: string;
};

export type BlobStore = {
  readonly kind: string;
  /** A time-limited URL the browser may PUT to. */
  uploadUrl(key: string, contentType: string, ttlSeconds?: number): Promise<Upload>;
  /** A time-limited URL anything may GET. */
  readUrl(key: string, ttlSeconds?: number): Promise<string>;
  /** Server-side read, for the worker. */
  read(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
};

export class StorageError extends Error {
  constructor(message: string, readonly retryable = false) {
    super(message);
    this.name = "StorageError";
  }
}

/**
 * Keys are derived, never taken from the client.
 *
 * A caller-supplied key is a path traversal and a cross-tenant overwrite
 * waiting to happen: `../../other-space/note.png` is a valid-looking string.
 * The space id leads so that a bucket listing is at least sorted by tenant, and
 * so a mis-scoped key is visible rather than merely wrong.
 */
export function mediaKey(spaceId: string, artifactId: string, ext: string): string {
  const safeExt = /^[a-z0-9]{1,8}$/.test(ext) ? ext : "bin";
  return `${spaceId}/${artifactId}.${safeExt}`;
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic",
  "audio/webm": "webm", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav",
  "audio/ogg": "ogg",
};

export const extensionFor = (contentType: string): string =>
  EXTENSIONS[contentType.split(";")[0]!.trim().toLowerCase()] ?? "bin";

/** What we are willing to accept at all. Anything else is refused up front. */
export const ACCEPTED = new Set(Object.keys(EXTENSIONS));
