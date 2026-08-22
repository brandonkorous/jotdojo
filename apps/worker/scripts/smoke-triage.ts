/**
 * The triage agent. M5, ADR-048.
 *
 * The behaviour under test is almost entirely about restraint: who it is off
 * for, how long it waits, what it refuses to do, and what happens to work
 * already queued when somebody turns it off. Whether a real model's remarks are
 * worth reading is not tested here and is not claimed anywhere.
 *
 * The check this file exists for is the last section. Turning it off has to
 * stop work that is ALREADY in the queue, or "off" means "off from tomorrow",
 * which is not what anybody reads it as.
 */
import { fakeReasoner } from "@jotdojo/reason";
import {
  upsertUserFromGoogle, asUser, createNote, deleteNote, defaultSpaceId, getNote,
  applyBillingEvent, listNoteComments, listTriageSettings, setTriage, spaceUsage,
  enqueueTriage, recordTriage, createSpace, inviteToSpace, acceptInvite,
  DomainError,
} from "@jotdojo/domain";
import { runTriageCycle } from "../src/triage";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const codeOf = async (run: Promise<unknown>): Promise<string> =>
  run.then(() => "no error").catch((e) => (e instanceof DomainError ? e.code : e.name));

/**
 * Take everybody else's queued triage out of the picture.
 *
 * The CLAIM is global -- a worker takes the oldest jobs, whoever they belong to
 * -- so a leftover job from another space would be in our batch and every count
 * below would be somebody else's. Queueing is scoped instead, with the space
 * argument on `enqueueTriage`.
 *
 * An earlier version of this tried to switch the agent OFF for every other
 * space, which did nothing at all: `spaces` only accepts an update from an
 * owner, and this connection has no actor. It passed anyway, because no other
 * space happened to have the agent on. Development databases only.
 */
async function clearForeignJobs(mine: string[]) {
  const { db } = await import("@jotdojo/db");
  const ours = mine.map((id) => `'${id}'`).join(",");
  await db.execute(
    `UPDATE outbox o SET completed_at = now(), locked_until = NULL
      WHERE o.topic = 'note.triage' AND o.completed_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM notes n
                         WHERE n.id = (o.payload->>'noteId')::uuid
                           AND n.space_id IN (${ours}))`,
  );
}

/** Ours only. Every count in this file is about one space. */
const queueFor = (space: string, quiet = "0 seconds") =>
  enqueueTriage(quiet, "24 hours", 200, space);

const TEAM = (spaceId: string) => applyBillingEvent({
  kind: "subscription" as const,
  spaceId,
  subscription: {
    customerId: "cus_triage", subscriptionId: "sub_triage",
    plan: "team", status: "active",
    currentPeriodEnd: new Date(Date.now() + 30 * 864e5),
  },
}, "smoke");

const ERRAND = "Call the vet on Monday about Bramble's booster, and book the "
  + "car in for its MOT before the end of the month.";
const IDLE = "Thoughts on the colour of the kitchen wall, which is currently a "
  + "sort of oatmeal and has been for eleven years now.";

const reasoner = fakeReasoner("Monday is the one with two things on it.");
const stamp = Date.now();
const user = await upsertUserFromGoogle({
  googleSub: `tri-${stamp}`, email: `tri-${stamp}@example.test`, displayName: "Triage",
});
const actor = asUser(user.id);
const space = await defaultSpaceId(actor);

console.log("\nit is off until somebody turns it on");
const initial = (await listTriageSettings(actor)).find((s) => s.spaceId === space)!;
check("a new space has the agent switched off", initial.enabled === false);
check("...and it is not available on the free plan", initial.available === false);
check("...and has never run", initial.lastRunAt === null);
check(
  "turning it on is refused on a plan that does not include it",
  await codeOf(setTriage(actor, space, true)) === "triage_unavailable",
);

const quiet = await createNote(actor, space, ERRAND);
check("nothing is queued for a space that is off", await queueFor(space) === 0);

console.log("\nonly an owner can turn it on");
await TEAM(space);
const guestUser = await upsertUserFromGoogle({
  googleSub: `tri-g-${stamp}`, email: `tri-g-${stamp}@example.test`, displayName: "Guest",
});
const guest = asUser(guestUser.id);
const shared = await createSpace(actor, "Triage shared", "team");
await TEAM(shared);
const invite = await inviteToSpace(actor, shared, `tri-g-${stamp}@example.test`);
await acceptInvite(guest, invite.token);
check(
  "a member who is not an owner cannot switch it on",
  await codeOf(setTriage(guest, shared, true)) === "forbidden",
);
check("...and still sees the switch",
  (await listTriageSettings(guest)).some((s) => s.spaceId === shared));

console.log("\nit waits for the writing to stop");
await setTriage(actor, space, true);
await clearForeignJobs([space, shared]);
check("a note being written is not read", await queueFor(space, "15 minutes") === 0);
check("...and the watermark still moved", await lastRun() !== null);
check("a note that has settled is queued", await queueFor(space) === 1);
check("...and it is not queued a second time", await queueFor(space) === 0);

console.log("\nit reads the note and comments");
const before = await getNote(actor, quiet.id);
const first = await runTriageCycle(reasoner, 4);
check("the job was claimed", first.claimed === 1, JSON.stringify(first));
check("...and it had something to say", first.spoke === 1, JSON.stringify(first));

const said = await listNoteComments(actor, quiet.id);
check("the remark is on the note", said.length === 1);
check("...attributed to a machine", said[0]?.authorType === "agent");
check("...labelled, not just coloured", said[0]?.authorLabel.includes("Triage") === true,
  said[0]?.authorLabel);
check("...and it names the model", said[0]?.authorLabel.includes(reasoner.model) === true,
  said[0]?.authorLabel);

const after = await getNote(actor, quiet.id);
check("THE NOTE ITSELF IS UNTOUCHED", after.body === before.body);
check("...and its revision did not move", after.revision === before.revision);

console.log("\nsilence is a normal answer");
const dull = await createNote(actor, space, IDLE);
await queueFor(space);
const second = await runTriageCycle(reasoner, 4);
check("the note was read", second.read === 1, JSON.stringify(second));
check("...and nothing was said", second.spoke === 0, JSON.stringify(second));
check("...so the note has no comments", (await listNoteComments(actor, dull.id)).length === 0);

console.log("\nand it is metered either way");
const used = await spaceUsage(actor, space);
check("both runs were counted", used.used === 2, `used ${used.used}`);
check("...against the team allowance", used.allowance >= 10_000, String(used.allowance));

const tiny = await createNote(actor, space, "milk");
await queueFor(space);
const third = await runTriageCycle(reasoner, 4);
check("a four-word note is not sent to a model", third.spoke === 0, JSON.stringify(third));
check("...and is not billed for", (await spaceUsage(actor, space)).used === 2);
check("...and gets no comment", (await listNoteComments(actor, tiny.id)).length === 0);

console.log("\noff means off, including for work already queued");
const pending = await createNote(actor, space, ERRAND);
check("a note is queued while it is on", await queueFor(space) === 1);
// Asserted BEFORE the switch is flipped, so "nothing happened" below cannot
// pass by the job never having existed. That is the whole check.
check("...and the job really is sitting in the queue", await jobState(pending.id) === "pending");
await setTriage(actor, space, false);
const afterOff = await runTriageCycle(reasoner, 4);
check("the queued job is dropped rather than run", afterOff.claimed === 0,
  JSON.stringify(afterOff));
check("...and it is closed, not left to run tomorrow",
  await jobState(pending.id) === "done", String(await jobState(pending.id)));
check("...so nothing was said", (await listNoteComments(actor, pending.id)).length === 0);
check("...and nothing was billed", (await spaceUsage(actor, space)).used === 2);
check("the switch reads as off", await enabled() === false);

console.log("\nover the allowance, it stops talking");
await setTriage(actor, space, true);
await recordTriage(pending.id, 10_000);
const broke = await createNote(actor, space, ERRAND);
check("the note is queued like any other", await queueFor(space) === 1);
check("...and is pending before the pass", await jobState(broke.id) === "pending");
const overQuota = await runTriageCycle(reasoner, 4);
check("no job is handed to the model", overQuota.claimed === 0, JSON.stringify(overQuota));
check("...and the outbox says why", (await lastError(broke.id))?.includes("allowance") === true,
  String(await lastError(broke.id)));
check("...and the note is silent", (await listNoteComments(actor, broke.id)).length === 0);

console.log("\na deleted note is not read");
await setTriage(actor, space, false);
await setTriage(actor, shared, true);
const doomed = await createNote(actor, shared, ERRAND);
check("the note is queued while it exists", await queueFor(shared) === 1);
await deleteNote(actor, doomed.id);
const gone = await runTriageCycle(reasoner, 4);
check("the job for a deleted note is not handed to the model", gone.claimed === 0,
  JSON.stringify(gone));
check("...and is closed rather than retried", await jobState(doomed.id) === "done");

// Leave nothing switched on. The next run of this suite shares the queue with
// this one, and so does every other suite.
await setTriage(actor, shared, false);

async function lastRun(): Promise<Date | null> {
  const all = await listTriageSettings(actor);
  return all.find((s) => s.spaceId === space)?.lastRunAt ?? null;
}

async function enabled(): Promise<boolean> {
  const all = await listTriageSettings(actor);
  return all.find((s) => s.spaceId === space)?.enabled ?? false;
}

/** What the outbox says about this note, so a check that observes "nothing
 *  happened" can prove there was something to happen to. */
async function jobState(noteId: string): Promise<"none" | "pending" | "done"> {
  const rows = await outboxRow(noteId);
  if (!rows) return "none";
  return rows.completed_at ? "done" : "pending";
}

async function lastError(noteId: string): Promise<string | null> {
  return ((await outboxRow(noteId))?.last_error as string | null) ?? null;
}

async function outboxRow(noteId: string): Promise<Record<string, unknown> | null> {
  const { db } = await import("@jotdojo/db");
  const rows = await db.execute(
    `SELECT completed_at, last_error FROM outbox WHERE topic = 'note.triage'
       AND payload->>'noteId' = '${noteId}' ORDER BY id DESC LIMIT 1`,
  ) as unknown as Array<Record<string, unknown>>;
  return rows[0] ?? null;
}

console.log(failures === 0 ? "\nall good\n" : `\n${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
