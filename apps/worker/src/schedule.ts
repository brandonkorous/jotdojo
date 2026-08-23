import { enqueueTriage } from "@jotacular/domain";

/**
 * The one scheduled thing in Jotacular. M5, ADR-048.
 *
 * Everything else in the worker is event-driven: something was written, so
 * something must be read. Triage is not -- it is about notes that have STOPPED
 * changing, and there is no event for somebody putting their pen down. So it
 * runs on a clock.
 *
 * A clock inside the drain loop rather than a cron container. The loop is
 * already running, already has a database connection, and already survives
 * restarts by keeping its watermark in Postgres; a second deployment whose only
 * job is to call one function would be a second thing that can be down.
 */

/** How often to look for notes that have settled. Not how often a person is
 *  spoken to -- each note is queued once, whatever this is set to. */
const EVERY_MS = Number(process.env.TRIAGE_EVERY_MS ?? 5 * 60_000);

/** How long a note must be untouched before it is read. The difference between
 *  an assistant and an interruption. */
const QUIET = process.env.TRIAGE_QUIET ?? "15 minutes";

/** How far back a space looks the first time it is switched on. Turning it on
 *  should not read three years of notes and bill for them. */
const LOOKBACK = process.env.TRIAGE_LOOKBACK ?? "24 hours";

const PER_PASS = Number(process.env.TRIAGE_LIMIT ?? 200);

let lastRun = 0;

/**
 * Queue what is due, at most once per interval.
 *
 * Safe to call every cycle: the throttle is here and the watermark is in the
 * database, so several workers racing to enqueue the same note produce one job
 * rather than several.
 */
export async function enqueueDueTriage(now = Date.now()): Promise<number> {
  if (now - lastRun < EVERY_MS) return 0;
  lastRun = now;

  const queued = await enqueueTriage(QUIET, LOOKBACK, PER_PASS);
  if (queued > 0) console.log(`[worker] triage: queued ${queued} note(s)`);
  return queued;
}

/** Testing seam. The suite has to be able to say "pretend an interval passed"
 *  without waiting five minutes or reaching into module state. */
export function resetTriageSchedule(): void {
  lastRun = 0;
}
