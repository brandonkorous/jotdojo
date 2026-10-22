// WizeLens: request tracing. On in development (dashboard at /_wizelens); in
// production only with WIZELENS_ENABLED=true, and then send-only to WIZELENS_HUB.
// Off in the smoke suites. Queries are untraced: postgres.js is not supported yet.
import { createWizeLens, wizelensFastify, type WizeLens } from "@wizeworks/lens-node";

const SERVICE = "jotdojo-api";

const enabled = process.env.NODE_ENV === "development"
  || process.env.WIZELENS_ENABLED === "true";

/** Tracing is not worth an outage: a failure to start is logged and the API runs untraced. */
function start(): WizeLens {
  try {
    return createWizeLens({ serviceName: SERVICE, enabled });
  } catch (err) {
    console.warn("[wizelens] tracing did not start", err);
    return createWizeLens({ serviceName: SERVICE, enabled: false });
  }
}

export const wizelens = start();

/** Fastify plugin. Registered before every route so its span wraps them all. */
export const wizelensPlugin = wizelensFastify(wizelens);
