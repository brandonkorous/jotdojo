import { createHmac } from "node:crypto";
import { StorageError, type BlobStore, type Upload } from "./provider";

/**
 * Azure Blob Storage with service SAS URLs.
 *
 * The browser PUTs straight to Blob and our servers never see the bytes, which
 * is the rule in docs/04. Written against the REST API rather than
 * @azure/storage-blob: the SDK is a large dependency for two signed URLs and a
 * GET, and the signing is the only part with any substance to it.
 *
 * Account key signing rather than a managed identity user-delegation key. That
 * is a deliberate first step and a real trade-off -- an account key is a
 * standing credential that must live in Key Vault, whereas a user-delegation
 * SAS is short-lived and revocable. Moving to workload identity means replacing
 * `sign` here and nothing else.
 */
export function azureStore(config: {
  account: string;
  container: string;
  accountKey: string;
}): BlobStore {
  const key = Buffer.from(config.accountKey, "base64");
  const origin = `https://${config.account}.blob.core.windows.net`;

  const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

  /**
   * Service SAS, 2020-12-06. The field ORDER is the signature -- Azure
   * concatenates these in a fixed sequence and any deviation produces a 403
   * that says only "Signature did not match", so do not tidy this list.
   */
  const sas = (blob: string, permissions: string, ttlSeconds: number) => {
    const start = new Date(Date.now() - 5 * 60_000);   // clock skew
    const expiry = new Date(Date.now() + ttlSeconds * 1000);
    const version = "2020-12-06";
    const resource = `/blob/${config.account}/${config.container}/${blob}`;

    const toSign = [
      permissions, iso(start), iso(expiry), resource,
      "",            // identifier
      "",            // IP range
      "https",       // protocol
      version,
      "b",           // signed resource: blob
      "", "", "", "", "",  // snapshot, encryption scope, cache-control, disposition, encoding
      "", "",        // language, type
    ].join("\n");

    const signature = createHmac("sha256", key).update(toSign, "utf8").digest("base64");
    return new URLSearchParams({
      sv: version, sr: "b", st: iso(start), se: iso(expiry),
      sp: permissions, spr: "https", sig: signature,
    }).toString();
  };

  return {
    kind: "azure",

    async uploadUrl(blobKey, contentType, ttlSeconds = 900) {
      return {
        url: `${origin}/${config.container}/${blobKey}?${sas(blobKey, "cw", ttlSeconds)}`,
        // Required by Azure for a single-shot PUT; without it the upload is
        // rejected with a message that does not mention this header.
        headers: { "x-ms-blob-type": "BlockBlob", "content-type": contentType },
        key: blobKey,
      } satisfies Upload;
    },

    async readUrl(blobKey, ttlSeconds = 900) {
      return `${origin}/${config.container}/${blobKey}?${sas(blobKey, "r", ttlSeconds)}`;
    },

    async read(blobKey) {
      const res = await fetch(await this.readUrl(blobKey, 300), {
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) {
        throw new StorageError(
          `blob read failed: ${res.status}`,
          res.status === 429 || res.status >= 500,
        );
      }
      return new Uint8Array(await res.arrayBuffer());
    },

    async remove(blobKey) {
      const res = await fetch(
        `${origin}/${config.container}/${blobKey}?${sas(blobKey, "d", 300)}`,
        { method: "DELETE" },
      );
      // 404 means it is already gone, which is the state we wanted.
      if (!res.ok && res.status !== 404) {
        throw new StorageError(`blob delete failed: ${res.status}`, res.status >= 500);
      }
    },
  };
}
