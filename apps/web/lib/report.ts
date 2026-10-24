import { isRedirectError } from "next/dist/client/components/redirect-error";

/** Rethrow a Next redirect so it still redirects; anything else is the caller's to handle. */
export function rethrowRedirect(err: unknown): void {
  if (isRedirectError(err)) throw err;
}

/** Put a swallowed server error on the request span and in the logs. Never throws. */
export async function reportError(err: unknown, where: string): Promise<void> {
  console.error(`[${where}]`, err);
  try {
    const { onRequestError } = await import("@wizeworks/lens-node/next");
    onRequestError(err, { path: where, method: "POST" },
      { routerKind: "App Router", routePath: where, routeType: "action" });
  } catch {
    // Tracing is optional: the console line above already has the error.
  }
}
