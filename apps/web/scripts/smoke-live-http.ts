/**
 * The live stream, over real HTTP, against a real server process. ADR-058.
 *
 * This is the suite that can catch what the others cannot, and there are three
 * such things:
 *
 *   1. NOTIFY CROSSING PROCESSES. Everything in-process passes whether or not
 *      LISTEN works at all -- a plain emitter would satisfy it. Here the write
 *      happens in THIS process and the delivery happens in the web server's,
 *      which is the arrangement production actually runs.
 *   2. THE FRAMING. `event:` and `data:` on separate lines, terminated by a
 *      blank one. Get it subtly wrong and EventSource silently never fires.
 *   3. BUFFERING. A proxy or a framework that holds the response until it ends
 *      turns a live stream into a very slow download, and every unit test still
 *      passes.
 *
 * Needs the web server running on WEB_ORIGIN (default http://localhost:3400).
 */
import { encode } from "@auth/core/jwt";
import {
  upsertUserFromGoogle, asUser, createNote, defaultSpaceId,
  createInkBlock, appendStrokes, type Stroke,
} from "@jotacular/domain";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3400";
/** Auth.js derives the encryption key from the secret AND the cookie name. */
const COOKIE = "authjs.session-token";

const secret = process.env.AUTH_SECRET;
if (!secret) throw new Error("AUTH_SECRET is not set; the session cookie cannot be signed");

const stamp = Date.now();
const user = await upsertUserFromGoogle({
  googleSub: `lhttp-${stamp}`, email: `lh-${stamp}@example.test`, displayName: "Wren",
});
const actor = asUser(user.id);
const note = await createNote(actor, await defaultSpaceId(actor), "watched from elsewhere");
const ink = await createInkBlock(actor, note.id, { w: 800, h: 600 });

const token = await encode({
  salt: COOKIE, secret, token: { jotacularUserId: user.id, sub: user.id },
});

console.log("\nwho may open a stream");

const anonymous = await fetch(`${ORIGIN}/api/live/${note.id}`);
check("an unauthenticated request is refused", anonymous.status === 401);
await anonymous.body?.cancel();

const missing = await fetch(`${ORIGIN}/api/live/00000000-0000-0000-0000-000000000000`, {
  headers: { cookie: `${COOKIE}=${token}` },
});
check("a note this person cannot reach is a 404", missing.status === 404);
await missing.body?.cancel();

console.log("\nthe stream itself");

const stream = await fetch(`${ORIGIN}/api/live/${note.id}`, {
  headers: { cookie: `${COOKIE}=${token}`, accept: "text/event-stream" },
});
check("the stream opens", stream.status === 200);
check("...as an event stream",
  (stream.headers.get("content-type") ?? "").includes("text/event-stream"),
  `content-type was ${stream.headers.get("content-type")}`);
check("...and is not allowed to be cached or transformed",
  (stream.headers.get("cache-control") ?? "").includes("no-cache"));

const reader = stream.body!.getReader();
const decoder = new TextDecoder();
let seen = "";

/** Read until the text we want shows up, or time runs out. */
async function waitFor(needle: string, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const next = await Promise.race([
      reader.read(),
      new Promise<null>((r) => setTimeout(() => r(null), deadline - Date.now())),
    ]);
    if (!next || next.done) return seen.includes(needle);
    seen += decoder.decode(next.value, { stream: true });
    if (seen.includes(needle)) return true;
  }
  return seen.includes(needle);
}

// The opening comment proves the response is flushed BEFORE anything happens,
// which is exactly what a buffering proxy breaks.
check("the first frame arrives before there is any news", await waitFor(": open", 5000));

const stroke: Stroke = {
  id: `http-${stamp}`, tool: "pen", color: "#1A1817", width: 2,
  pts: [[1, 1, 0, 0.5, 0, 0], [9, 9, 8, 0.5, 0, 0]],
};
// Written from THIS process. The delivery has to cross into the server's.
await appendStrokes(actor, ink.blockId, 0, [stroke]);

const arrived = await waitFor("event: ink", 8000);
check("a stroke written in another process arrives on the stream", arrived,
  `saw: ${JSON.stringify(seen.slice(-300))}`);
check("...named as an ink event with the block on it", seen.includes(ink.blockId));
check("...carrying the new count, so a follower knows what to fetch",
  seen.includes('"strokeCount":1'));
check("...and NOT the strokes themselves -- the stream carries pointers",
  !seen.includes('"pts"'),
  "a payload with points in it would bypass the authorized read");

await reader.cancel();

console.log(`\n${failures === 0 ? "all good" : `${failures} FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
