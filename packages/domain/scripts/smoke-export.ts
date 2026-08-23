/**
 * What an export is allowed to see, and what it costs to look. ADR-067.
 *
 * The HTTP suite in apps/web proves a browser gets a file. This proves the two
 * things underneath that, neither of which is visible from outside:
 *
 *   1. TENANCY. `canReachSpace` returns true for any signed-in person by
 *      design -- RLS is the real boundary -- so an export of somebody else's
 *      space would come back as a valid archive of nothing rather than a
 *      refusal, and would log a row in THEIR space saying it happened.
 *   2. THE COST OF READING. getNote writes a note.read row per call. An export
 *      built by looping it would bury every read that meant something under
 *      four hundred that meant "a zip was made".
 */
import { sql } from "drizzle-orm";
import { withActor } from "@jotacular/db";
import {
  upsertUserFromGoogle, asUser, createNote, defaultSpaceId, getNote,
  createInkBlock, appendStrokes, exportNote, exportSpace,
  type Point, type Stroke,
} from "../src/index";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const point = (x: number, y: number): Point => [x, y, 0, 0.5, 0, 0];
const stroke = (id: string): Stroke => ({
  id, tool: "pen", color: "#1F2933", width: 3,
  pts: [point(10, 10), point(40, 40), point(70, 10)],
});

const stamp = Date.now();
const alice = await upsertUserFromGoogle({
  googleSub: `xd-a-${stamp}`, email: `xda-${stamp}@example.test`, displayName: "Ada",
});
const bob = await upsertUserFromGoogle({
  googleSub: `xd-b-${stamp}`, email: `xdb-${stamp}@example.test`, displayName: "Bo",
});
const A = asUser(alice.id);
const B = asUser(bob.id);

const spaceId = await defaultSpaceId(A);
const bobSpace = await defaultSpaceId(B);
const note = await createNote(A, spaceId, "# Mooring\n\nRing the marina.");
const ink = await createInkBlock(A, note.id, { w: 800, h: 600 });
await appendStrokes(A, ink.blockId, 0, [stroke("s1")]);
await createNote(A, spaceId, "Second thing.");

/**
 * The log, read AS Alice.
 *
 * Not `withoutActor`: audit_log's policy is app_can_reach_space(space_id), so
 * with no actor set nothing matches and every count comes back zero -- which
 * makes "the export read nothing" pass for the wrong reason. The first version
 * of this suite did exactly that.
 */
const actions = async (space: string) => {
  const rows = await withActor(alice.id, async (tx) => tx.execute(sql`
    SELECT action, count(*)::int AS n FROM audit_log
     WHERE space_id = ${space} GROUP BY action
  `)) as unknown as Array<{ action: string; n: number }>;
  return new Map(rows.map((r) => [r.action, Number(r.n)]));
};

console.log("\none note, with everything on it");
{
  const exported = await exportNote(A, note.id);
  check("the typed words come back", exported.body.includes("Ring the marina"));
  check("...and so does the handwriting layer",
    exported.blocks.some((b) => b.kind === "ink" && (b.document?.strokes.length ?? 0) === 1));
  check("...with the strokes themselves, not a reading of them",
    exported.blocks.find((b) => b.kind === "ink")?.document?.strokes[0]?.id === "s1");
  check("blocks arrive in reading order",
    exported.blocks.every((b, i, all) => i === 0 || all[i - 1]!.position <= b.position));
}

console.log("\nreading a note and exporting a note are different events");
{
  const before = await actions(spaceId);
  await exportSpace(A, spaceId);
  const after = await actions(spaceId);

  check("the space export logged once",
    (after.get("space.export") ?? 0) - (before.get("space.export") ?? 0) === 1);
  check("...and read nothing",
    (after.get("note.read") ?? 0) === (before.get("note.read") ?? 0),
    `note.read went from ${before.get("note.read") ?? 0} to ${after.get("note.read") ?? 0}`);

  // The contrast, so the check above cannot pass because auditing is broken.
  await getNote(A, note.id);
  check("whereas reading one still does", ((await actions(spaceId)).get("note.read") ?? 0) > 0);
}

console.log("\nwhose space this is");
{
  const mine = await exportSpace(A, spaceId);
  check("she gets both her notes", mine.length === 2, `${mine.length} notes`);

  let refused = false;
  try {
    await exportSpace(B, spaceId);
  } catch (err) {
    refused = (err as { code?: string }).code === "forbidden";
  }
  // Refused, NOT an empty archive. An export that hands a stranger a valid zip
  // of nothing has told them the space exists and left a row in it saying so.
  check("a stranger is refused rather than handed an empty archive", refused);

  const before = await actions(spaceId);
  try { await exportSpace(B, spaceId); } catch { /* expected */ }
  check("...and the refusal left no trace in her log",
    (await actions(spaceId)).get("space.export") === before.get("space.export"));

  let noteRefused = false;
  try {
    await exportNote(B, note.id);
  } catch (err) {
    noteRefused = (err as { code?: string }).code === "not_found";
  }
  check("one of her notes is a 404 to him", noteRefused);
  check("his own space is empty and that is fine",
    (await exportSpace(B, bobSpace)).length === 0);
}

console.log(failures === 0 ? "\nexport: all good\n" : `\nexport: ${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
