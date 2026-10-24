/**
 * One transaction per page load, and a reachability check that leaves no trace.
 *
 * Nested `withActor` calls for one actor join the open transaction, so the
 * landing canvas reads everything in one BEGIN. JD-2, JD-3.
 */
import { and, eq, sql } from "drizzle-orm";
import { withActor, auditLog } from "@jotacular/db";
import {
  upsertUserFromGoogle, asUser, loadCanvas, defaultSpaceId, createNote,
  assertNoteReachable, getNote,
} from "../src/index";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const txid = (id: string) => withActor(id, async (tx) => {
  const rows = await tx.execute(sql`select txid_current()::text as id`);
  return (rows as unknown as Array<{ id: string }>)[0]!.id;
});

const stamp = Date.now();
const a = await upsertUserFromGoogle({ googleSub: `txn-a-${stamp}`, email: `ta-${stamp}@example.test`, displayName: "Ada" });
const b = await upsertUserFromGoogle({ googleSub: `txn-b-${stamp}`, email: `tb-${stamp}@example.test`, displayName: "Bo" });

console.log("nested withActor joins the open transaction");
const [outer, inner] = await withActor(a.id, async () => [await txid(a.id), await txid(a.id)]);
check("two nested calls for one actor share a transaction", outer === inner);
const apart = await withActor(a.id, async () => [await txid(a.id), await txid(b.id)]);
check("a different actor gets its own transaction", apart[0] !== apart[1]);
check("separate top-level calls are separate transactions", (await txid(a.id)) !== (await txid(a.id)));

console.log("\nloadCanvas");
const canvas = await loadCanvas(asUser(a.id));
check("returns a note, comments, ink flag and toolbar side", !!canvas && canvas.note.id !== "" && canvas.comments.length === 0 && canvas.hasInk === false && canvas.toolbar === "auto");
const again = await loadCanvas(asUser(a.id));
check("a second visit reuses the same note", again?.note.id === canvas?.note.id);
const ghost = await loadCanvas(asUser("00000000-0000-4000-8000-000000000000"));
check("a user who is gone gets null", ghost === null);

console.log("\nassertNoteReachable");
const space = await defaultSpaceId(asUser(a.id));
const note = await createNote(asUser(a.id), space, "mine");
const reads = (userId: string) => withActor(userId, async (tx) =>
  (await tx.select({ n: sql<number>`count(*)::int` }).from(auditLog)
    .where(and(eq(auditLog.targetId, note.id), eq(auditLog.action, "note.read"))))[0]!.n);
await getNote(asUser(a.id), note.id);
const before = await reads(a.id);
check("getNote writes a note.read row, and the owner can see it", before === 1, `saw ${before}`);
await assertNoteReachable(asUser(a.id), note.id);
check("the owner reaches the note", true);
check("...and no audit row is written", (await reads(a.id)) === before);
let refused = false;
try { await assertNoteReachable(asUser(b.id), note.id); } catch { refused = true; }
check("somebody else is refused", refused);

console.log(`\n${failures === 0 ? "all good" : `${failures} FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
