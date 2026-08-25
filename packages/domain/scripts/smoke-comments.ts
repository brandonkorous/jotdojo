/**
 * Comments, and the thing each one is about. ADR-107.
 *
 * The anchor is a name from inside a jsonb document, with no foreign key
 * holding it up, so three things have to be true and none of them is enforced
 * by the schema:
 *
 *   1. An anchor SURVIVES the round trip. It is written by the canvas and read
 *      back by the canvas, and a column that silently dropped it would look
 *      exactly like a page whose pins had never been placed.
 *   2. An anchored comment OUTLIVES the object. Erasing a note must not erase
 *      what somebody said about it -- there is no cascade, and there must not
 *      be one.
 *   3. The page's own comments still have no anchor. Every comment written
 *      before this shipped is one of those.
 */
import { sql } from "drizzle-orm";
import { withActor } from "@jotacular/db";
import {
  upsertUserFromGoogle, asUser, createNote, defaultSpaceId,
  commentOnNote, listNoteComments, resolveComment,
} from "../src/index";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const stamp = Date.now();
const user = await upsertUserFromGoogle({
  googleSub: `cmt-${stamp}`, email: `cmt-${stamp}@example.test`, displayName: "Wren",
});
const A = asUser(user.id);
const spaceId = await defaultSpaceId(A);
const note = await createNote(A, spaceId, "Saturday\n\nThe boat, the car, the cake.");

/** A text box's id, as the canvas would mint one. */
const BOAT = "3f2b1a90-0000-4000-8000-000000000001";
const CAKE = "3f2b1a90-0000-4000-8000-000000000002";

console.log("\na comment about one thing on the page");
{
  const said = await commentOnNote(A, note.id, "the mooring fee went up", BOAT);
  check("comes back naming what it is about", said.anchorId === BOAT, String(said.anchorId));

  const listed = await listNoteComments(A, note.id);
  check("and is still naming it when read back",
    listed[0]?.anchorId === BOAT, String(listed[0]?.anchorId));
  check("attributed to the person who wrote it", listed[0]?.authorType === "user");
}

console.log("\na comment about the page itself");
{
  await commentOnNote(A, note.id, "all of this is for Saturday");
  const listed = await listNoteComments(A, note.id);
  const page = listed.filter((c) => c.anchorId === null);
  check("has no anchor at all", page.length === 1, `${page.length}`);
  check("...and does not disturb the anchored one",
    listed.filter((c) => c.anchorId === BOAT).length === 1);
}

console.log("\ntwo things on one page are two conversations");
{
  await commentOnNote(A, note.id, "no nuts", CAKE);
  await commentOnNote(A, note.id, "ask about the icing", CAKE);
  const listed = await listNoteComments(A, note.id);
  const byAnchor = new Map<string | null, number>();
  for (const c of listed) byAnchor.set(c.anchorId, (byAnchor.get(c.anchorId) ?? 0) + 1);
  check("the boat has one", byAnchor.get(BOAT) === 1, String(byAnchor.get(BOAT)));
  check("the cake has two", byAnchor.get(CAKE) === 2, String(byAnchor.get(CAKE)));
  check("the page has one", byAnchor.get(null) === 1, String(byAnchor.get(null)));
}

console.log("\nan anchor is a name, not a foreign key");
{
  // What erasing the note on the canvas does: the object leaves the ink
  // document and nothing at all happens to the comments table.
  const before = (await listNoteComments(A, note.id)).length;
  const rows = await withActor(user.id, async (tx) => tx.execute(sql`
    SELECT count(*)::int AS n FROM comments
     WHERE note_id = ${note.id}::uuid AND anchor_id = ${CAKE}
  `));
  const held = Number((rows as unknown as Array<Record<string, unknown>>)[0]?.n ?? 0);
  check("the anchor is stored as itself", held === 2, String(held));
  check("nothing cascaded", (await listNoteComments(A, note.id)).length === before);
}

console.log("\nsomething too long to be a name is refused");
{
  let refused = false;
  try {
    await commentOnNote(A, note.id, "hello", "x".repeat(65));
  } catch { refused = true; }
  check("a 65-character anchor is turned away", refused);
}

console.log("\ndealing with one leaves the rest alone");
{
  const listed = await listNoteComments(A, note.id);
  const one = listed.find((c) => c.anchorId === CAKE)!;
  await resolveComment(A, one.id);
  const after = await listNoteComments(A, note.id);
  check("that one is settled", after.find((c) => c.id === one.id)?.resolvedAt !== null);
  check("...and only that one",
    after.filter((c) => c.resolvedAt !== null).length === 1);
}

console.log(failures === 0 ? "\ncomments smoke: all checks passed" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
