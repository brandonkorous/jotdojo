// WizeLens: request tracing. On in development (dashboard at /_wizelens); in
// production only with WIZELENS_ENABLED=true, and then send-only to WIZELENS_HUB.
// Off in the smoke suites. Queries are spans too.
import type { IncomingMessage, ServerResponse } from "node:http";
import { createWizeLens, instrumentDrizzle, type WizeLens } from "@wizeworks/lens-node";

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

/** packages/db calls this once its pool exists: every query in a request or job becomes a span. */
function traceQueries(db: unknown): void {
  try {
    if (!instrumentDrizzle(wizelens, db)) console.warn("[wizelens] queries are untraced: unknown driver");
  } catch (err) {
    console.warn("[wizelens] queries are untraced", err);
  }
}

if (wizelens.enabled) (globalThis as { __wizelensDb?: typeof traceQueries }).__wizelensDb = traceQueries;

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

/** One trace per request, with `handle` running inside it. `/_wizelens` is answered here. */
export function traced(handle: Handler) {
  return (req: IncomingMessage, res: ServerResponse): void =>
    wizelens.middleware(req, res, () => void handle(req, res));
}
