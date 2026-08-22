import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { mediaKey, StorageError, type BlobStore, type Upload } from "./provider";

/**
 * Filesystem storage for development.
 *
 * Bytes go through the API, which production must never do -- so this driver
 * refuses to exist when NODE_ENV is production (see resolveStorage). It is here
 * so that images and audio can be built and tested without an Azure account,
 * not as a deployment option.
 *
 * The signed URLs are real HMACs rather than a stub, because the endpoints they
 * authorise are real endpoints. A dev-only driver that hands out unauthenticated
 * write URLs would be a live upload endpoint on anyone's laptop.
 */
export function localStore(config: {
  root: string;
  baseUrl: string;
  secret: string;
}): BlobStore {
  const sign = (key: string, verb: string, expires: number) =>
    createHmac("sha256", config.secret)
      .update(`${verb}:${key}:${expires}`).digest("base64url");

  /**
   * Resolve a key to a path INSIDE the root, or refuse.
   *
   * mediaKey() builds every key we issue, so a traversal should be impossible.
   * This checks anyway: the value arrives back from the database and from URL
   * paths, and "it cannot happen upstream" is how directory traversals ship.
   */
  const pathFor = (key: string) => {
    const root = resolve(config.root);
    const full = resolve(join(root, key));
    if (full !== root && !full.startsWith(root + sep)) {
      throw new StorageError(`refusing a key that escapes the store: ${key}`);
    }
    return full;
  };

  return {
    kind: "local",

    async uploadUrl(key, contentType, ttlSeconds = 900) {
      const expires = Date.now() + ttlSeconds * 1000;
      const sig = sign(key, "PUT", expires);
      return {
        url: `${config.baseUrl}/v1/media/${key}?expires=${expires}&sig=${sig}`,
        headers: { "content-type": contentType },
        key,
      } satisfies Upload;
    },

    async readUrl(key, ttlSeconds = 900) {
      const expires = Date.now() + ttlSeconds * 1000;
      return `${config.baseUrl}/v1/media/${key}?expires=${expires}&sig=${sign(key, "GET", expires)}`;
    },

    async read(key) {
      try {
        return new Uint8Array(await readFile(pathFor(key)));
      } catch (err) {
        throw new StorageError(`cannot read ${key}: ${(err as Error).message}`);
      }
    },

    async remove(key) {
      await rm(pathFor(key), { force: true });
    },
  };
}

/** Used by the API endpoint that backs the local driver's URLs. */
export function verifyLocalSignature(
  secret: string, key: string, verb: string, expires: string, sig: string,
): boolean {
  const deadline = Number(expires);
  if (!Number.isFinite(deadline) || deadline < Date.now()) return false;
  const expected = createHmac("sha256", secret)
    .update(`${verb}:${key}:${deadline}`).digest("base64url");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  // Length check first: timingSafeEqual throws on a mismatch rather than
  // returning false, and a thrown error is a very loud oracle.
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function writeLocal(root: string, key: string, bytes: Uint8Array): Promise<void> {
  const rootAbs = resolve(root);
  const full = resolve(join(rootAbs, key));
  if (full !== rootAbs && !full.startsWith(rootAbs + sep)) {
    throw new StorageError(`refusing a key that escapes the store: ${key}`);
  }
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, bytes);
}

export { mediaKey };
