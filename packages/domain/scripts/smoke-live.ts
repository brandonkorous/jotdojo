/**
 * Live updates, and the property they exist to protect: TWO DEVICES ON ONE PAGE
 * MUST NOT EAT EACH OTHER'S WORK. ADR-058.
 *
 * Everything here is a scenario that was either impossible before this feature
 * or actively broken by it. Written as two people in one shared space, because
 * that is the harder case and it contains the easier one -- somebody's own
 * tablet and laptop are the same problem with the same account on both.
 *
 * Every refusal asserts the error CODE, not merely that something threw.
 * ADR-020: a check that cannot tell a refusal from a crash is not testing it.
 */
import {
  upsertUserFromGoogle, asUser, createNote, defaultSpaceId, createSpace, inviteToSpace,
  acceptInvite, createInkBlock, appendStrokes, applyInkDelta, getInk, strokesSince,
  saveNote, heartbeat, whoIsHere, leave, publish, subscribeToNote,
  type Stroke, type LiveEvent,
} from "../src/index";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

async function refused(label: string, code: string, fn: () => Promise<unknown>) {
  let got = "nothing was thrown";
  try { await fn(); } catch (err) {
    got = (err as { code?: string }).code ?? `an error with no code: ${(err as Error).message}`;
  }
  check(label, got === code, `expected code "${code}", got "${got}"`);
}

let nth = 0;
const stroke = (n: number): Stroke => ({
  id: `s-${++nth}`,
  tool: "pen", color: "#1A1817", width: 2,
  pts: [[n, n, 0, 0.5, 0, 0], [n + 10, n + 4, 16, 0.6, 0, 0]],
});

const ids = (page: { document: { strokes: Stroke[] } }) => page.document.strokes.map((s) => s.id);

const stamp = Date.now();
const one = await upsertUserFromGoogle({
  googleSub: `live-a-${stamp}`, email: `la-${stamp}@example.test`, displayName: "Ada",
});
const two = await upsertUserFromGoogle({
  googleSub: `live-b-${stamp}`, email: `lb-${stamp}@example.test`, displayName: "Bo",
});
const A = asUser(one.id);
const B = asUser(two.id);

const shared = await createSpace(A, "The shared page", "family");  // returns the id
const invite = await inviteToSpace(A, shared, `lb-${stamp}@example.test`);
await acceptInvite(B, invite.token);
const note = await createNote(A, shared, "two people, one page");
const ink = await createInkBlock(A, note.id, { w: 1024, h: 1366 });

console.log("\nthe page carries a version, not just a count");

const first = await appendStrokes(A, ink.blockId, 0, [stroke(0), stroke(30)]);
check("appending moves the version", first.version > 0);
check("...and the count", first.strokeCount === 2);

const erased = await applyInkDelta(A, ink.blockId, { remove: [ids(await getInk(A, ink.blockId))[0]!], upsert: [] });
check("a delta moves the version too", erased.version > first.version);
check("...while the count goes DOWN, which a count alone cannot express",
  erased.strokeCount === 1);

console.log("\nerase and draw at the same time. THE BUG THIS FEATURE WOULD HAVE CAUSED");

// Ada is about to rub something out. Bo draws while she does.
const page = await getInk(A, ink.blockId);
const doomed = ids(page)[0]!;
const bos = stroke(500);

// Bo's stroke lands FIRST, then Ada's erase arrives naming only her own target.
await appendStrokes(B, ink.blockId, page.strokeCount, [bos]);
await applyInkDelta(A, ink.blockId, { remove: [doomed], upsert: [] });

const after = await getInk(A, ink.blockId);
check("the erased stroke is gone", !ids(after).includes(doomed));
check("...and BO'S STROKE SURVIVED, which whole-page replacement would have eaten",
  ids(after).includes(bos.id));

console.log("\ntwo devices appending at once");

// Bo's client still thinks the page is shorter than it is, because Ada wrote
// while his request was being prepared. His strokes are real and must land.
const behind = ids(after).length - 1;
const late = stroke(900);
const caught = await appendStrokes(B, ink.blockId, behind, [late]);
check("a batch behind the page is NOT dismissed as a retry", caught.accepted === 1);
check("...and the stroke is on the page",
  ids(await getInk(A, ink.blockId)).includes(late.id));

const replay = await appendStrokes(B, ink.blockId, behind, [late]);
check("...but sending the SAME stroke again is still a no-op", replay.accepted === 0);

console.log("\ncatching up without re-reading the page");

const size = (await getInk(A, ink.blockId)).strokeCount;
const tail = await strokesSince(A, ink.blockId, size - 1);
check("asking for the tail returns only the tail", tail.strokes.length === 1);
check("...and says where the page now is", tail.strokeCount === size);
const whole = await strokesSince(A, ink.blockId, 0);
check("asking from zero returns everything", whole.strokes.length === size);

console.log("\ndeltas cannot be used to reach another space");

const mine = await createNote(A, await defaultSpaceId(A), "private");
const privateInk = await createInkBlock(A, mine.id, { w: 100, h: 100 });
await refused("bo cannot delta a page he cannot reach", "not_found",
  () => applyInkDelta(B, privateInk.blockId, { remove: ["anything"], upsert: [] }));
await refused("bo cannot read its tail either", "not_found",
  () => strokesSince(B, privateInk.blockId, 0));
await refused("an empty delta is refused rather than counted as a write", "empty_delta",
  () => applyInkDelta(A, ink.blockId, { remove: [], upsert: [] }));

console.log("\npresence");

const alone = await heartbeat(A, note.id, "ada-tablet", false);
check("one device present is one row", alone.length === 1);
check("...and it knows the device is the reader's own", alone[0]!.self === true);

await heartbeat(B, note.id, "bo-laptop", true);
const both = await whoIsHere(A, note.id);
check("the other person shows up", both.length === 2);
check("...and is not marked as the reader", both.some((p) => !p.self));
check("...and is reported as writing", both.find((p) => !p.self)!.writing === true);
check("...by name, so the warning can say who", both.some((p) => p.displayName === "Bo"));

const secondTab = await heartbeat(A, note.id, "ada-laptop", false);
check("the same person on two devices is TWO presences, not one",
  secondTab.filter((p) => p.self).length === 2);

await leave(A, note.id, "ada-laptop");
check("leaving removes just that device",
  (await whoIsHere(A, note.id)).filter((p) => p.self).length === 1);

await refused("presence cannot be claimed in a note you cannot reach", "not_found",
  () => heartbeat(B, mine.id, "bo-laptop", false));

console.log("\nthe channel itself");

const heard: LiveEvent[] = [];
const stop = await subscribeToNote(note.id, (e) => heard.push(e));
// A note for something else entirely must not reach this subscriber.
publish({ kind: "presence", spaceId: shared, noteId: mine.id, at: Date.now() });
publish({ kind: "presence", spaceId: shared, noteId: note.id, at: Date.now() });
await new Promise((r) => setTimeout(r, 700));
stop();

check("an event for this note arrives", heard.some((e) => e.noteId === note.id));
check("...and one for another note does NOT", !heard.some((e) => e.noteId === mine.id));

console.log("\ntyped text still refuses to merge itself. ADR-001 stands");

const saved = await saveNote(A, note.id, "Ada wrote this", note.revision);
await refused("a second device saving from a stale revision CONFLICTS", "revision_conflict",
  () => saveNote(B, note.id, "Bo wrote this", note.revision));
check("...and Ada's words are untouched", saved.body === "Ada wrote this");

console.log(`\n${failures === 0 ? "all good" : `${failures} FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
