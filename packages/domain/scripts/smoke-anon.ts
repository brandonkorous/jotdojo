/**
 * Anonymous capture. ADR-009, ADR-039.
 *
 * The promise being tested is the strong one: a stranger who types into the
 * hero has their words in Postgres before they have an account, and signing in
 * later loses nothing. "Never lose a thought" has no asterisk for people who
 * have not paid or even registered.
 *
 * The other half is that a stranger is still a stranger -- a draft is not a
 * back door into anyone else's space, and it cannot be used to buy free
 * recognition.
 */
import {
  upsertUserFromGoogle, asUser, createNote, listNotes, getNote, saveNote,
  createInkBlock, appendStrokes, getInk, defaultSpaceId, listSpaces,
  startAnonSession, resumeAnonSession, claimAnonSession, anonUsage,
  assertAnonRoom, sweepAnonSpaces, spaceUsage, ANON_MAX_NOTES,
  assertAnonInkRoom, ANON_MAX_STROKES,
  type Stroke,
} from "../src/index";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

async function refused(label: string, code: string, fn: () => Promise<unknown>) {
  let got = "nothing was thrown";
  try {
    await fn();
  } catch (err) {
    got = (err as { code?: string }).code ?? `an error with no code: ${(err as Error).message}`;
  }
  check(label, got === code, `expected code "${code}", got "${got}"`);
}

const scrawl = (): Stroke => ({
  tool: "pen", color: "#1A1817", width: 2,
  pts: Array.from({ length: 12 }, (_, i) => [
    20 + i * 10, 50 + i, i * 8, 0.5, 0, 0,
  ] as Stroke["pts"][number]),
});

console.log("\na stranger jots");
const session = await startAnonSession();
check("a draft space exists server-side", session.spaceId.length > 0);
check("the token is opaque and prefixed", session.token.startsWith("jd_anon_"));

const first = await createNote(session.actor, session.spaceId, "the thing I must not forget");
check("the note is created", first.id.length > 0);
check("...and reads back", (await getNote(session.actor, first.id)).body.includes("must not forget"));
check("...and is listed", (await listNotes(session.actor, session.spaceId)).length === 1);

console.log("\nthe same browser coming back");
const resumed = await resumeAnonSession(session.token);
check("the token resolves to the same space", resumed?.spaceId === session.spaceId);
check("...and still sees the note",
  (await listNotes(resumed!.actor, resumed!.spaceId)).some((n) => n.id === first.id));
const again = await startAnonSession(session.token);
check("starting again with the same token does NOT mint a second space",
  again.spaceId === session.spaceId);
check("a token nobody issued resolves to nothing",
  (await resumeAnonSession("jd_anon_never-issued")) === null);
check("a token that is not ours is not treated as one",
  (await resumeAnonSession("not-a-jotdojo-token")) === null);

console.log("\na draft is not a back door");
const other = await upsertUserFromGoogle({
  googleSub: `anon-o-${Date.now()}`, email: `anon-o-${Date.now()}@example.test`, displayName: "Other",
});
const stranger = asUser(other.id);
const theirSpace = await defaultSpaceId(stranger);
const theirNote = await createNote(stranger, theirSpace, "private to them");
check("the draft cannot see anyone else's note",
  !(await listNotes(session.actor, session.spaceId)).some((n) => n.id === theirNote.id));
await refused("...and cannot fetch it by id", "not_found",
  () => getNote(session.actor, theirNote.id));
check("nobody else can see the draft",
  !(await listSpaces(stranger)).some((s) => s.id === session.spaceId));

console.log("\nrecognition is not free for strangers");
const ink = await createInkBlock(session.actor, first.id, { w: 800, h: 600 });
await appendStrokes(session.actor, ink.blockId, 0, [scrawl()]);
check("ink is stored", (await getInk(session.actor, ink.blockId)).strokeCount === 1);
const draftAllowance = await spaceUsage(session.actor, session.spaceId);
check("a draft is metered at zero, so nothing is read until claimed",
  draftAllowance.allowance === 0, String(draftAllowance.allowance));
check("...which reads as over quota", draftAllowance.over === true);

console.log("\nthe abuse ceiling");
const usage = await anonUsage(session);
check("usage is counted", usage.notes === 1 && usage.chars > 0, JSON.stringify(usage));
for (let i = usage.notes; i < ANON_MAX_NOTES; i++) {
  await createNote(session.actor, session.spaceId, `note ${i}`);
}
await refused("past the note ceiling, it refuses politely", "anon_note_limit",
  () => assertAnonRoom(session));
const roomy = await startAnonSession();
await refused("...and refuses a very large body too", "anon_char_limit",
  () => assertAnonRoom(roomy, 50_001));

const inky = await startAnonSession();
const page = await createNote(inky.actor, inky.spaceId, "a page");
const drawn = await createInkBlock(inky.actor, page.id, { w: 800, h: 600 });
await appendStrokes(inky.actor, drawn.blockId, 0, [scrawl(), scrawl()]);
check("ink is counted too, because strokes are not text",
  (await anonUsage(inky)).strokes === 2, JSON.stringify(await anonUsage(inky)));
await refused("...and drawing past the ink ceiling is refused", "anon_ink_limit",
  () => assertAnonInkRoom(inky, ANON_MAX_STROKES));


console.log("\nclaiming at sign-in");
const claimer = await upsertUserFromGoogle({
  googleSub: `anon-c-${Date.now()}`, email: `anon-c-${Date.now()}@example.test`, displayName: "Claimer",
});
const person = asUser(claimer.id);
const claimed = await claimAnonSession(person, session.token);
check("claiming returns the same space", claimed === session.spaceId);
check("the person now reaches it",
  (await listSpaces(person)).some((s) => s.id === session.spaceId));
check("...as owner",
  (await listSpaces(person)).find((s) => s.id === session.spaceId)?.role === "owner");
check("the original note survived, unchanged",
  (await getNote(person, first.id)).body.includes("must not forget"));
check("...and is still editable", (await saveNote(
  person, first.id, "the thing I must not forget, now kept", (await getNote(person, first.id)).revision,
)).body.includes("now kept"));

const afterClaim = await spaceUsage(person, session.spaceId);
check("the space is on a real plan now", afterClaim.plan === "free");
check("...with a real allowance, so the ink can finally be read",
  afterClaim.allowance >= 100, String(afterClaim.allowance));

console.log("\nthe draft cannot be claimed twice");
await refused("a claimed token is spent", "not_found",
  () => claimAnonSession(person, session.token));
check("the old shadow session no longer resolves",
  (await resumeAnonSession(session.token)) === null);

console.log("\nretention");
const idle = await startAnonSession();
await createNote(idle.actor, idle.spaceId, "abandoned");
check("a fresh draft is NOT swept", (await sweepAnonSpaces(30)) >= 0
  && (await resumeAnonSession(idle.token)) !== null);
const swept = await sweepAnonSpaces(0);
check("an unclaimed draft is swept when it ages out", swept >= 1, String(swept));
check("...and its token stops resolving", (await resumeAnonSession(idle.token)) === null);
check("a CLAIMED space is never swept by retention",
  (await listSpaces(person)).some((s) => s.id === session.spaceId));

console.log(failures === 0
  ? "\nanon smoke: all checks passed"
  : `\nanon smoke: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
