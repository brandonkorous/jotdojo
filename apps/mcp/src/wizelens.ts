// WizeLens: request tracing. On in development (dashboard at /_wizelens); in
// production only with WIZELENS_ENABLED=true, and then send-only to WIZELENS_HUB.
// Off in the smoke suites. Queries are untraced: postgres.js is not supported yet.
import type { IncomingMessage, ServerResponse } from "node:http";
import { createWizeLens, type WizeLens } from "@wizeworks/lens-node";

const SERVICE = "jotdojo-mcp";

const enabled = process.env.NODE_ENV === "development"
  || process.env.WIZELENS_ENABLED === "true";

/** Tracing is not worth an outage: a failure to start is logged and the server runs untraced. */
function start(): WizeLens {
  try {
    return createWizeLens({ serviceName: SERVICE, enabled });
  } catch (err) {
    console.warn("[wizelens] tracing did not start", err);
    return createWizeLens({ serviceName: SERVICE, enabled: false });
  }
}

const wizelens = start();

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

/** One trace per request, with `handle` running inside it. `/_wizelens` is answered here. */
export function traced(handle: Handler) {
  return (req: IncomingMessage, res: ServerResponse): void =>
    wizelens.middleware(req, res, () => void handle(req, res));
}
