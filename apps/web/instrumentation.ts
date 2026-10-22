import type { Instrumentation } from "next";

/**
 * WizeLens: one trace per request to this server, with Next's own spans inside.
 * On in development (dashboard at /_wizelens); in production only with
 * WIZELENS_ENABLED=true, and then send-only to WIZELENS_HUB.
 */
const ENABLED = process.env.NODE_ENV === "development" || process.env.WIZELENS_ENABLED === "true";

/** Node.js runtime only. The import sits INSIDE the runtime check, so the edge build drops it. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (!ENABLED) return;
    try {
      const { registerWizeLens } = await import("@wizeworks/lens-node/next");
      registerWizeLens({ serviceName: "jotdojo-web", enabled: true });
    } catch (err) {
      // Tracing is not worth an outage: the app runs untraced.
      console.warn("[wizelens] tracing did not start", err);
    }
  }
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (!ENABLED) return;
    try {
      const { onRequestError } = await import("@wizeworks/lens-node/next");
      onRequestError(...args);
    } catch {
      // Tracing is optional: the error itself is still Next's to report.
    }
  }
};
