import { localStore } from "./local";
import { azureStore } from "./azure";
import type { BlobStore } from "./provider";

/**
 * Pick a store from the environment.
 *
 * Unlike the embedding and vision seams, a MISSING store is fatal for the
 * feature rather than a graceful degradation: there is no useful version of
 * "record audio" that has nowhere to put the audio. So this returns null and
 * the callers refuse the capture cleanly, rather than accepting bytes they
 * cannot keep.
 */
export function resolveStorage(env = process.env): BlobStore | null {
  const provider = env.STORAGE_PROVIDER?.trim().toLowerCase();

  if (provider === "local") {
    if (env.NODE_ENV === "production") {
      // Not a nicety. The local driver routes every byte through the API,
      // which is the exact thing docs/04 forbids -- one photo per second from
      // a hundred phones would be flowing through a Node process sized for
      // JSON. Refuse loudly rather than discover it under load.
      throw new Error(
        "STORAGE_PROVIDER=local proxies media through the API and must never run "
        + "in production. Use STORAGE_PROVIDER=azure.",
      );
    }
    const secret = env.AUTH_SECRET;
    if (!secret) throw new Error("STORAGE_PROVIDER=local needs AUTH_SECRET to sign URLs");
    return localStore({
      root: env.STORAGE_LOCAL_ROOT ?? ".media",
      baseUrl: env.API_URL ?? "http://localhost:3401",
      secret,
    });
  }

  if (provider === "azure") {
    const account = env.AZURE_STORAGE_ACCOUNT;
    const container = env.AZURE_STORAGE_CONTAINER;
    const accountKey = env.AZURE_STORAGE_KEY;
    if (!account || !container || !accountKey) {
      throw new Error(
        "STORAGE_PROVIDER=azure needs AZURE_STORAGE_ACCOUNT, AZURE_STORAGE_CONTAINER "
        + "and AZURE_STORAGE_KEY",
      );
    }
    return azureStore({ account, container, accountKey });
  }

  if (provider) throw new Error(`Unknown STORAGE_PROVIDER: ${provider}`);
  return null;
}

let cached: BlobStore | null | undefined;

export function storage(): BlobStore | null {
  if (cached === undefined) cached = resolveStorage();
  return cached;
}
