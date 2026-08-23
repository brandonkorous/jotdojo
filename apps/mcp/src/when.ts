import { DomainError, type Change, type TimeWindow } from "@jotacular/domain";

/**
 * Dates, as an agent supplies them. ADR-063.
 *
 * Strict on the way in and explicit when it refuses. A model asked for "notes
 * since last Tuesday" will compute a date and send it, and a parser that
 * quietly turns an unparseable string into `undefined` answers that request
 * with the whole notebook -- which reads as a working filter returning a lot of
 * results, not as a rejected input.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const WHEN_HINT =
  "ISO 8601: a date (2026-08-01) or an instant (2026-08-01T09:30:00Z). "
  + "A bare date is midnight UTC.";

function one(value: string | undefined, field: string): Date | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const text = value.trim();
  // A bare date has no zone, and JS reads it as UTC midnight -- which is what
  // we want and worth pinning rather than relying on.
  const parsed = new Date(DATE_ONLY.test(text) ? `${text}T00:00:00Z` : text);
  if (Number.isNaN(parsed.getTime())) {
    throw new DomainError(`${field} is not a date I can read. ${WHEN_HINT}`, "bad_date", 400);
  }
  return parsed;
}

export function parseWhen(since?: string, until?: string): TimeWindow {
  const window = { since: one(since, "since"), until: one(until, "until") };
  // Backwards is almost always a mistake at the call site rather than an empty
  // question, and answering it with "no notes" hides that.
  if (window.since && window.until && window.since >= window.until) {
    throw new DomainError(
      `since (${since}) is not before until (${until}), so nothing could match.`,
      "bad_date_range", 400,
    );
  }
  return window;
}

/** How a window reads back in a sentence, so an empty answer says what it was
 *  empty ABOUT rather than just "nothing". */
export function describeWhen(w: TimeWindow): string {
  if (w.since && w.until) return ` between ${iso(w.since)} and ${iso(w.until)}`;
  if (w.since) return ` since ${iso(w.since)}`;
  if (w.until) return ` before ${iso(w.until)}`;
  return "";
}

const iso = (d: Date) => d.toISOString();

/**
 * One line of the changes feed.
 *
 * Written as a sentence rather than a record, because it is read by something
 * that will paraphrase it to a person. "you commented on Boat" survives that;
 * `{action: "note.comment", actor_type: "user"}` becomes whatever the model
 * decides those fields meant.
 */
export function renderChange(c: Change): string {
  const what = c.noteTitle ? `"${c.noteTitle}"` : `note ${c.noteId ?? "?"}`;
  const verb = VERBS[c.action] ?? c.action;
  const head = `- ${c.at.toISOString()} — ${c.who} ${verb} ${what}`;
  const via = c.toolName ? ` (via ${c.toolName})` : "";
  // The comment body, indented under its own line. A feed that says somebody
  // commented and makes you fetch the note to find out what they said is a
  // notification, not a feed.
  return c.detail ? `${head}${via}\n    ${c.detail.replace(/\s+/g, " ").slice(0, 240)}` : head + via;
}

const VERBS: Record<string, string> = {
  "note.create": "created",
  "note.update": "rewrote",
  "note.append": "added to",
  "note.delete": "deleted",
  "note.comment": "commented on",
  "note.export": "exported",
  "space.export": "exported everything in this space —",
  "note.transcript.ready": "finished reading the handwriting on",
  "note.transcript.failed": "could not read the handwriting on",
  "note.transcript.correct": "corrected the transcript on",
  "note.media": "added a photo or recording to",
};
