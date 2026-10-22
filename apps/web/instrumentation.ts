import type { Instrumentation } from "next";

// WizeLens: one trace per request, with Next's spans and every query inside. On in
// development (dashboard at /_wizelens); in production only with WIZELENS_ENABLED=true,
// then send-only to WIZELENS_HUB.
const ENABLED = process.env.NODE_ENV === "development" || process.env.WIZELENS_ENABLED === "true";

/** Node.js runtime only. The import sits INSIDE the runtime check, so the edge build drops it. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (!ENABLED) return;
    try {
      const { registerWizeLens } = await import("@wizeworks/lens-node/next");
      const { instrumentDrizzle } = await import("@wizeworks/lens-node");
      const wizelens = registerWizeLens({ serviceName: "jotdojo-web", enabled: true });
      // packages/db calls this once its pool exists, so queries become spans.
      (globalThis as { __wizelensDb?: (db: unknown) => void }).__wizelensDb = (db) => {
        try {
          if (!instrumentDrizzle(wizelens, db)) console.warn("[wizelens] queries are untraced: unknown driver");
        } catch (err) {
          console.warn("[wizelens] queries are untraced", err);
        }
      };
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
