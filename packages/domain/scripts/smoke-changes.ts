/**
 * When, and what changed. ADR-063.
 *
 * Two things here are worth more than the rest put together:
 *
 *   1. THE RRF TRAP. searchNotes fuses three independently ranked lists and
 *      recalls four times deeper than the limit so fusion has something to
 *      rank. A date filter applied AFTER fusion spends that headroom on rows it
 *      then discards, and returns fewer than `limit` whenever a date is given.
 *      It looks like a ranking quirk, not a bug. The check below asks for a
 *      windowed search that SHOULD fill its limit, and fails if it does not.
 *
 *   2. THE FEED IS NOT A READ LOG. note.read outnumbers everything else put
 *      together. If it ever reappears in the feed, the feed is useless and
 *      nothing else here would notice.
 */
import { sql } from "drizzle-orm";
import { withActor } from "@jotacular/db";
import {
  upsertUserFromGoogle, asUser, createNote, defaultSpaceId, getNote,
  listNotes, searchNotes, listChanges, commentOnNote, nextCursor,
  createInkBlock, appendStrokes, storeTranscript, correctTranscript,
  type NoteSummary, type Point, type Stroke,
} from "../src/index";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const stamp = Date.now();
const user = await upsertUserFromGoogle({
  googleSub: `chg-${stamp}`, email: `chg-${stamp}@example.test`, displayName: "Wren",
});
const A = asUser(user.id);
const spaceId = await defaultSpaceId(A);

/** Notes are stamped by the database, so the window is moved rather than the
 *  clock: back-date the rows and ask about a range that brackets them. */
const backdate = async (id: string, when: Date) => {
  await withActor(user.id, async (tx) => tx.execute(sql`
    UPDATE notes SET updated_at = ${when.toISOString()}::timestamptz WHERE id = ${id}
  `));
};

const day = (n: number) => new Date(Date.UTC(2026, 0, n, 12, 0, 0));

// Twelve notes that all say the same word, spread over twelve days. Twelve so a
// windowed search has more than `limit` to choose from.
const spread: string[] = [];
for (let i = 1; i <= 12; i++) {
  const note = await createNote(A, spaceId, `Mooring note ${i}\n\nRing the marina about the mooring.`);
  await backdate(note.id, day(i));
  spread.push(note.id);
}

console.log("\na window on the list");
{
  const all = await listNotes(A, spaceId, { limit: 50 });
  check("everything is there without one", all.length === 12, `${all.length}`);

  const early = await listNotes(A, spaceId, { until: day(5), limit: 50 });
  check("until excludes its own boundary", early.length === 4, `${early.length} (days 1-4)`);

  const late = await listNotes(A, spaceId, { since: day(10), limit: 50 });
  check("since includes its own boundary", late.length === 3, `${late.length} (days 10-12)`);

  const middle = await listNotes(A, spaceId, { since: day(5), until: day(8), limit: 50 });
  check("both together are a range", middle.length === 3, `${middle.length} (days 5,6,7)`);

  const none = await listNotes(A, spaceId, { since: day(20), limit: 50 });
  check("a window with nothing in it is empty, not everything", none.length === 0, `${none.length}`);
}

console.log("\npaging that neither skips nor repeats");
{
  const seen: NoteSummary[] = [];
  let cursor: ReturnType<typeof nextCursor> = null;
  for (let page = 0; page < 6; page++) {
    const rows = await listNotes(A, spaceId, { limit: 5, after: cursor ?? undefined });
    if (rows.length === 0) break;
    seen.push(...rows);
    cursor = nextCursor(rows, 5);
    if (!cursor) break;
  }
  check("every note is reached", seen.length === 12, `${seen.length}`);
  check("...exactly once", new Set(seen.map((n) => n.id)).size === seen.length,
    "an id appeared on two pages");
  // The reason `id` is in both the ORDER BY and the cursor: without it, two
  // notes with the same updated_at straddle a page boundary and one is lost.
  const order = seen.map((n) => n.updatedAt.getTime());
  check("...in order", order.every((t, i) => i === 0 || order[i - 1]! >= t));
}

console.log("\nthe RRF trap: a windowed search still fills its limit");
{
  const wide = await searchNotes(A, spaceId, "mooring", { limit: 5 });
  check("an unwindowed search fills its limit", wide.length === 5, `${wide.length}`);

  // EXACTLY five notes are in this window and the limit is five, out of twelve
  // that all match the query equally well. Filtering after fusion would rank
  // all twelve, take five arbitrary ones, and then drop the ones outside the
  // window -- so this check fails loudly rather than being a formality.
  const windowed = await searchNotes(A, spaceId, "mooring", { since: day(8), limit: 5 });
  check("a windowed one fills it too", windowed.length === 5,
    `${windowed.length} of 5 -- the date is not inside all three strategies`);
  check("...and everything it returned is inside the window",
    windowed.every((h) => h.updatedAt >= day(8)),
    windowed.map((h) => h.updatedAt.toISOString()).join(", "));

  const narrow = await searchNotes(A, spaceId, "mooring", { since: day(11), limit: 5 });
  check("a narrow window returns only what is in it", narrow.length === 2, `${narrow.length}`);
}

console.log("\nwhat changed");
{
  const note = await createNote(A, spaceId, "Boat\n\nRing the marina.");
  await commentOnNote(A, note.id, "the mooring fee went up");

  // A reading arriving. The worker has no actor, so this is the path that
  // writes through app_record_change -- and the path that silently wrote
  // nothing before 0030.
  const ink = await createInkBlock(A, note.id, { w: 800, h: 600 });
  const point = (x: number, y: number): Point => [x, y, 0, 0.5, 0, 0];
  await appendStrokes(A, ink.blockId, 0, [{
    id: "s1", tool: "pen", color: "#1F2933", width: 3,
    pts: [point(10, 10), point(60, 60)],
  } satisfies Stroke]);
  await storeTranscript(ink.blockId, "ring the marina", "htr:vlm:m/r2", 0.8, 1);
  await correctTranscript(A, ink.blockId, "ring the marina on Tuesday");

  // Reads, plenty of them, to prove they stay out.
  for (let i = 0; i < 5; i++) await getNote(A, note.id);

  const feed = await listChanges(A, spaceId, { limit: 100 });
  const has = (action: string) => feed.some((c) => c.action === action);

  check("a comment is in the feed", has("note.comment"));
  check("...with what it said", feed.some((c) => c.detail?.includes("mooring fee went up")),
    JSON.stringify(feed.find((c) => c.action === "note.comment")));
  check("a transcript arriving is in the feed", has("note.transcript.ready"),
    feed.map((c) => c.action).join(", "));
  check("...attributed to nobody in particular",
    feed.find((c) => c.action === "note.transcript.ready")?.who === "jotacular");
  check("a person overruling it is in the feed", has("note.transcript.correct"));
  check("...attributed to them", feed.find((c) => c.action === "note.transcript.correct")?.who === "you");
  check("note.create is in the feed", has("note.create"));

  // The whole reason the feed is not just `SELECT * FROM audit_log`.
  check("READS ARE NOT", !has("note.read"), feed.map((c) => c.action).join(", "));

  check("newest first", feed.every((c, i) => i === 0 || feed[i - 1]!.at >= c.at));
  check("a note's title travels with the event",
    feed.some((c) => c.noteTitle === "Boat"), JSON.stringify(feed.slice(0, 3)));
}

console.log("\nthe feed is scoped like everything else");
{
  const other = await upsertUserFromGoogle({
    googleSub: `chg-b-${stamp}`, email: `chgb-${stamp}@example.test`, displayName: "Bo",
  });
  const B = asUser(other.id);
  let refused = false;
  try {
    await listChanges(B, spaceId);
  } catch (err) {
    refused = (err as { code?: string }).code === "forbidden";
  }
  check("a stranger is refused rather than shown an empty feed", refused);
}

console.log(failures === 0 ? "\nchanges: all good\n" : `\nchanges: ${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
