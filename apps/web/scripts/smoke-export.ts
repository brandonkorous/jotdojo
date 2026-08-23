/**
 * Export, over real HTTP, against a real server process. ADR-067.
 *
 * The privacy policy has promised this since the site went up, so the thing
 * worth proving is not that a function returns a string -- it is that a browser
 * asking for a file GETS a file, from somebody else's process, with the header
 * that makes it one, and that a stranger asking for the same note gets nothing.
 *
 * Needs the web server running on WEB_ORIGIN (default http://localhost:3400).
 */
import { encode } from "@auth/core/jwt";
import {
  upsertUserFromGoogle, asUser, createNote, defaultSpaceId,
  createInkBlock, appendStrokes, createMediaBlock, type Point, type Stroke,
} from "@jotdojo/domain";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3400";
const COOKIE = "authjs.session-token";

const secret = process.env.AUTH_SECRET;
if (!secret) throw new Error("AUTH_SECRET is not set; the session cookie cannot be signed");

const sessionFor = (id: string) =>
  encode({ salt: COOKIE, secret, token: { jotdojoUserId: id, sub: id } });

const point = (x: number, y: number): Point => [x, y, 0, 0.5, 0, 0];
const stroke = (id: string, from: number): Stroke => ({
  id, tool: "pen", color: "#1F2933", width: 3,
  pts: [point(from, 40), point(from + 30, 70), point(from + 60, 40)],
});

const stamp = Date.now();
const alice = await upsertUserFromGoogle({
  googleSub: `xp-a-${stamp}`, email: `xpa-${stamp}@example.test`, displayName: "Ada",
});
const bob = await upsertUserFromGoogle({
  googleSub: `xp-b-${stamp}`, email: `xpb-${stamp}@example.test`, displayName: "Bo",
});

const A = asUser(alice.id);
const spaceId = await defaultSpaceId(A);
const note = await createNote(A, spaceId, "# Boat\n\nRing the marina about the mooring.");
const ink = await createInkBlock(A, note.id, { w: 800, h: 600 });
await appendStrokes(A, ink.blockId, 0, [stroke("s1", 40), stroke("s2", 200)]);
// Reserved and never uploaded, which is the state a capture interrupted mid
// upload leaves behind. The archive has to SAY so rather than quietly omit it.
const photo = await createMediaBlock(A, note.id, "image", "image/png");
const second = await createNote(A, spaceId, "Second thing, typed only.");

const aliceCookie = `${COOKIE}=${await sessionFor(alice.id)}`;
const bobCookie = `${COOKIE}=${await sessionFor(bob.id)}`;

const get = (path: string, cookie = aliceCookie) =>
  fetch(`${ORIGIN}${path}`, { headers: { cookie }, redirect: "manual" });

const disposition = (r: Response) => r.headers.get("content-disposition") ?? "";
const type = (r: Response) => r.headers.get("content-type") ?? "";

console.log("\none note, in each format");
{
  const md = await get(`/export/note/${note.id}?format=md`);
  const text = await md.text();
  check("markdown comes back", md.status === 200, `status ${md.status}`);
  check("...as markdown", type(md).includes("text/markdown"), type(md));
  // Without this header a browser renders the file instead of saving it, and
  // "export" becomes "select all, copy".
  check("...as an attachment", disposition(md).startsWith("attachment;"), disposition(md));
  check("...named after the note", disposition(md).includes("boat"), disposition(md));
  check("...containing what she wrote", text.includes("Ring the marina"));
  check("...and marking the handwriting as handwriting", text.includes("handwritten"), text);

  const svg = await get(`/export/note/${note.id}?format=svg`);
  const drawing = await svg.text();
  check("svg comes back", svg.status === 200 && type(svg).includes("image/svg+xml"), type(svg));
  check("...with strokes in it", drawing.includes("<path"), drawing.slice(0, 120));
  check("...on white paper", drawing.includes('fill="#FFFFFF"'));

  const png = await get(`/export/note/${note.id}?format=png`);
  const bytes = new Uint8Array(await png.arrayBuffer());
  check("png comes back", png.status === 200 && type(png) === "image/png", type(png));
  check("...and really is a PNG",
    [0x89, 0x50, 0x4e, 0x47].every((b, i) => bytes[i] === b));
}

console.log("\nthe whole note, as an archive");
{
  const zip = await get(`/export/note/${note.id}?format=zip`);
  const bytes = Buffer.from(await zip.arrayBuffer());
  check("zip comes back", zip.status === 200 && type(zip) === "application/zip", type(zip));
  check("...and starts like one", bytes.subarray(0, 4).toString("hex") === "504b0304");
  // The end-of-central-directory record: the last 22 bytes, no comment. A zip
  // without it opens nowhere, and every byte before it can be perfect.
  check("...and ends like one", bytes.subarray(-22, -18).toString("hex") === "504b0506",
    bytes.subarray(-22).toString("hex"));
  check("...with a readme", bytes.includes(Buffer.from("README.txt")));
  check("...the note as markdown", bytes.includes(Buffer.from("notes/0001-boat")));
  check("...and the handwriting beside it", bytes.includes(Buffer.from(`ink/${ink.blockId}.svg`)));
  // The photo was reserved and never uploaded. Silence here would be the same
  // failure as the missing export itself, one layer down.
  check("a photo we cannot read is named, not dropped",
    bytes.includes(Buffer.from(photo.blockId)), "the block id is nowhere in the archive");
}

console.log("\neverything in the space");
{
  const zip = await get(`/export/space/${spaceId}`);
  const bytes = Buffer.from(await zip.arrayBuffer());
  check("the archive comes back", zip.status === 200 && type(zip) === "application/zip");
  check("...dated in its name", /filename="jotdojo-\d{4}-\d{2}-\d{2}\.zip"/.test(disposition(zip)),
    disposition(zip));
  check("...holding both notes",
    bytes.includes(Buffer.from("notes/0001-")) && bytes.includes(Buffer.from("notes/0002-")));
  check("...including the typed-only one", bytes.includes(Buffer.from("second-thing")),
    `note ${second.id} is missing`);
}

console.log("\njust what the lasso caught");
{
  const post = (body: unknown, cookie = aliceCookie) =>
    fetch(`${ORIGIN}/export/note/${note.id}`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify(body),
      redirect: "manual",
    });

  const one = await post({ format: "svg", strokeIds: ["s2"] });
  const drawing = await one.text();
  check("a selection renders", one.status === 200, `status ${one.status}`);
  check("...named as a selection", disposition(one).includes("selection"), disposition(one));
  // Two strokes on the page, one asked for. The frame is derived from what is
  // drawn, so the width is the proof: the whole page is far wider.
  const width = Number(/width="(\d+)"/.exec(drawing)?.[1] ?? 0);
  const whole = await (await get(`/export/note/${note.id}?format=svg`)).text();
  const wholeWidth = Number(/width="(\d+)"/.exec(whole)?.[1] ?? 0);
  check("...cropped to it", width > 0 && width < wholeWidth, `${width} vs ${wholeWidth}`);

  const none = await post({ format: "svg", strokeIds: [] });
  check("an empty selection is refused", none.status === 404, `status ${none.status}`);

  const unknown = await post({ format: "svg", strokeIds: ["not-a-stroke"] });
  check("ids that are not on the page are refused, not drawn blank",
    unknown.status === 404, `status ${unknown.status}`);
}

console.log("\nwhose notes these are");
{
  const stranger = await get(`/export/note/${note.id}?format=md`, bobCookie);
  check("someone else's note is a 404", stranger.status === 404, `status ${stranger.status}`);

  const strangerSpace = await get(`/export/space/${spaceId}`, bobCookie);
  check("...and so is their space", strangerSpace.status === 404, `status ${strangerSpace.status}`);

  const out = await fetch(`${ORIGIN}/export/note/${note.id}?format=md`, { redirect: "manual" });
  check("signed out, there is nothing to download", out.status !== 200, `status ${out.status}`);
  await out.body?.cancel();
}

console.log(failures === 0 ? "\nexport: all good\n" : `\nexport: ${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
