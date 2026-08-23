import { sql, type SQL } from "drizzle-orm";

/**
 * When, as a predicate. ADR-063.
 *
 * The vision opens with "in the car, at the school gate, three minutes before a
 * meeting" -- the whole thesis is about WHEN a thought arrived. Search and the
 * note list took no date at all until now.
 *
 * It lives in one file for a reason that is specific and easy to get wrong.
 * `searchNotes` fuses three independently ranked lists, and a date filter
 * applied AFTER fusion silently shrinks the result below `limit`: recall goes
 * four times deeper than the limit precisely so fusion has something to rank,
 * and throwing rows away afterwards spends that headroom on nothing. The
 * predicate has to go INSIDE each strategy, which means three copies of it --
 * unless there is one copy and they all use it.
 */

export type TimeWindow = {
  /** Inclusive. "Anything since Monday" includes Monday. */
  since?: Date;
  /** Exclusive, so `until` a midnight does not catch that midnight's notes. */
  until?: Date;
};

/**
 * Keyset, not OFFSET. A page-two built on OFFSET skips a note whenever
 * somebody edits one on page one between the two requests -- and editing notes
 * is what people do here all day.
 */
export type Cursor = { updatedAt: Date; id: string; pinned: boolean };

const iso = (d: Date) => d.toISOString();

/**
 * The window, against `n.updated_at`.
 *
 * `updated_at` and not `created_at`: saveNote, appendToNote and markPageChanged
 * all maintain it, so handwriting counts as a change and "what have I touched
 * this week" means what a person means by it.
 */
export function windowSql(w?: TimeWindow): SQL {
  const since = w?.since ? sql` AND n.updated_at >= ${iso(w.since)}::timestamptz` : sql``;
  const until = w?.until ? sql` AND n.updated_at < ${iso(w.until)}::timestamptz` : sql``;
  return sql`${since}${until}`;
}

/** The same window against a bare `created_at`, for the changes feed -- an
 *  audit row is an event and has no later version of itself. */
export function eventWindowSql(w?: TimeWindow, alias = "a"): SQL {
  const col = sql.raw(`${alias}.created_at`);
  const since = w?.since ? sql` AND ${col} >= ${iso(w.since)}::timestamptz` : sql``;
  const until = w?.until ? sql` AND ${col} < ${iso(w.until)}::timestamptz` : sql``;
  return sql`${since}${until}`;
}

/**
 * Everything strictly after the cursor, in the list's own order.
 *
 * A ROW comparison rather than three ORs, and it must name every column the
 * ORDER BY names or it skips and repeats across the boundary. `pinned` is in
 * there because the list sorts by it first; `id` is in there because two notes
 * saved in the same millisecond are ordinary, and without a tiebreak the page
 * boundary lands in the middle of them.
 */
export function afterSql(cursor?: Cursor): SQL {
  if (!cursor) return sql``;
  return sql` AND (n.pinned, n.updated_at, n.id) < (${cursor.pinned}, ${iso(cursor.updatedAt)}::timestamptz, ${cursor.id}::uuid)`;
}
