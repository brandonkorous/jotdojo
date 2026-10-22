// WizeLens: one trace per claimed batch, with the provider calls inside it. On in
// development; in production only with WIZELENS_ENABLED=true, then send-only to
// WIZELENS_HUB. Off in the smoke suites. Queries are spans too.
import { createWizeLens, instrumentDrizzle, type WizeLens } from "@wizeworks/lens-node";

const SERVICE = "jotdojo-worker";

const enabled = process.env.NODE_ENV === "development"
  || process.env.WIZELENS_ENABLED === "true";

/** Tracing is not worth an outage: a failure to start is logged and the worker runs untraced. */
function start(): WizeLens {
  try {
    // No dashboard: the worker has no HTTP listener to serve one from.
    return createWizeLens({ serviceName: SERVICE, enabled, dashboard: false });
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

/**
 * Run one claimed batch of an outbox topic as its own trace. Called only once
 * something was claimed, so an idle worker sends nothing.
 */
export function traceJobs<T>(topic: string, count: number, run: () => Promise<T>): Promise<T> {
  if (!wizelens.enabled) return run();
  const attributes = {
    "messaging.system": "outbox",
    "messaging.operation.type": "process",
    "messaging.destination.name": topic,
    "messaging.batch.message_count": count,
  };
  return wizelens.tracer.startActiveSpan(`process ${topic}`, { attributes }, async (span) => {
    try {
      return await run();
    } catch (err) {
      wizelens.recordException(err);
      throw err;
    } finally {
      span.end();
    }
  });
}
