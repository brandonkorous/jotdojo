/**
 * Metering, and the promise it is built around: CAPTURE IS NEVER REFUSED FOR
 * BILLING REASONS. ADR-007, ADR-036.
 *
 * Over quota, the artifact is still stored, the strokes are still kept, and the
 * block says `deferred` rather than `failed` -- because it WILL be read when
 * the period rolls over. The distinction is the whole design: `failed` means
 * "this will never happen", and telling someone that about their own
 * handwriting when we simply have not billed them yet would be a lie.
 */
import { fakeRecognizer } from "@jotacular/vision";
import {
  upsertUserFromGoogle, asUser, createNote, defaultSpaceId,
  createInkBlock, appendStrokes, getInk, spaceUsage, recordRecognition,
  type Stroke,
} from "@jotacular/domain";
import { runRecognitionCycle } from "../src/recognize";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

/** Counted rather than random, so a failing run names the same stroke twice. */
let strokeNo = 0;
const nextId = () => `stroke-${++strokeNo}`;

const scrawl = (row: number): Stroke => ({
  id: nextId(),
  tool: "pen", color: "#1A1817", width: 2,
  pts: Array.from({ length: 20 }, (_, i) => [
    40 + i * 12, row + Math.sin(i / 2) * 9, i * 8, 0.5, 0, 0,
  ] as Stroke["pts"][number]),
});

/** Skip the 30s quiet period for one block, without releasing anyone else's.
 *  A page someone is still writing must not be read forty times. */
async function release(blockId: string) {
  const { db } = await import("@jotacular/db");
  await db.execute(
    `UPDATE outbox SET available_at = now() WHERE topic = 'block.recognize'
       AND completed_at IS NULL AND payload->>'blockId' = '${blockId}'`,
  );
}

const stamp = Date.now();
const user = await upsertUserFromGoogle({
  googleSub: `met-${stamp}`, email: `met-${stamp}@example.test`, displayName: "Meter",
});
const actor = asUser(user.id);
const space = await defaultSpaceId(actor);

/**
 * Our own blocks. Foreign work is told apart by ID, never by a join.
 *
 * `blocks` is FORCE ROW LEVEL SECURITY under `app_can_reach_space`, and this
 * connection sets no actor -- so a subquery against it returns nothing at all
 * and a `NOT EXISTS` built on one matches EVERY row, closing our own jobs
 * along with everyone else's. Matching on the payload touches no policy.
 */
const ours: string[] = [];

/**
 * Take everybody else's queued reading out of the picture, like smoke-triage.
 *
 * The CLAIM is global -- a worker takes the oldest jobs, whoever they belong to
 * -- so a leftover job from another suite lands in our batch and every count
 * below becomes somebody else's. This suite also passes NO TRANSCRIBER, so a
 * foreign AUDIO job does not merely inflate a count: it throws "no provider"
 * and is recorded as `failed`, which is the assertion that broke in CI.
 *
 * Draining once at startup could not fix that. Recognition is queued with a
 * 30-second quiet period, so a job enqueued just before this suite began is not
 * yet claimable when a drain runs -- and is claimable by the time we assert.
 */
async function clearForeign() {
  const { db } = await import("@jotacular/db");
  const mine = ours.map((id) => `'${id}'`).join(",");
  await db.execute(
    `UPDATE outbox SET completed_at = now(), locked_until = NULL
      WHERE topic = 'block.recognize' AND completed_at IS NULL
        ${mine ? `AND payload->>'blockId' NOT IN (${mine})` : ""}`,
  );
}

/** Every measured cycle is ours only. Foreign work is closed, never read. */
async function cycle(text: string) {
  await clearForeign();
  return runRecognitionCycle(fakeRecognizer(text), null, 8);
}

console.log("\nwhat a new space is allowed");
const fresh = await spaceUsage(actor, space);
check("a personal space is on the free plan", fresh.plan === "free");
check("the free allowance is real, not a demo", fresh.allowance >= 100, String(fresh.allowance));
check("nothing used yet", fresh.used === 0, String(fresh.used));
check("...so it is not over quota", fresh.over === false);
check("the period is the calendar month", fresh.periodStart.getUTCDate() === 1);

console.log("\na reading is metered");
const note = await createNote(actor, space, "");
const ink = await createInkBlock(actor, note.id, { w: 800, h: 600 });
ours.push(ink.blockId);
await appendStrokes(actor, ink.blockId, 0, [scrawl(100), scrawl(300)]);
await release(ink.blockId);

const first = await cycle("metered");
check("the page is read", first.read === 1, JSON.stringify(first));
const afterOne = await spaceUsage(actor, space);
check("one page costs one unit", afterOne.used === 1, String(afterOne.used));
check("the block is ready", (await getInk(actor, ink.blockId)).transcriptState === "ready");

console.log("\nover quota");
// Spend the rest of the allowance in one row. The meter counts units, not
// rows, so this is the same arithmetic as reading that many pages.
await recordRecognition(ink.blockId, afterOne.allowance);
const spent = await spaceUsage(actor, space);
check("usage reaches the allowance", spent.used >= spent.allowance, `${spent.used}/${spent.allowance}`);
check("...and the space knows it is over", spent.over === true);

console.log("\ncapture keeps working, which is the point");
const second = await createNote(actor, space, "still jotting while over quota");
check("a note is still created", second.id.length > 0);
const ink2 = await createInkBlock(actor, second.id, { w: 800, h: 600 });
ours.push(ink2.blockId);
await appendStrokes(actor, ink2.blockId, 0, [scrawl(120)]);
await release(ink2.blockId);
const stored = await getInk(actor, ink2.blockId);
check("the strokes are still stored", stored.strokeCount === 1, String(stored.strokeCount));

console.log("\nthe reading is deferred, not failed");
const overCycle = await cycle("metered");
check("nothing was read", overCycle.read === 0, JSON.stringify(overCycle));
check("...and nothing was recorded as failed", overCycle.failed === 0, JSON.stringify(overCycle));
const deferred = await getInk(actor, ink2.blockId);
check("the block says deferred", deferred.transcriptState === "deferred", deferred.transcriptState);
check("NOT failed -- it will be read when the period rolls over",
  deferred.transcriptState !== "failed");
check("the strokes are untouched", deferred.strokeCount === 1);

console.log("\nthe deferred job is not lost");
const again = await cycle("metered");
check("a second pass does not spin the queue", again.claimed === 0, JSON.stringify(again));
const afterDefer = await spaceUsage(actor, space);
check("a deferred reading costs nothing", afterDefer.used === spent.used,
  `${afterDefer.used} vs ${spent.used}`);

console.log(failures === 0
  ? "\nmetering smoke: all checks passed"
  : `\nmetering smoke: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
