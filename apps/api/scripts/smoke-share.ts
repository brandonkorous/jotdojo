/**
 * Sharing into Jotacular, over real HTTP. ADR-064.
 *
 * Follows smoke-capture.ts beside it, and covers the two things that were not
 * possible before:
 *
 *   1. A URL IS A CAPTURE. It used to have to arrive pre-formatted as `text`,
 *      and a bare link titled the note with two hundred characters of its own
 *      query string.
 *   2. A PHOTO IS A CAPTURE, in three steps -- reserve, PUT, finalize -- so the
 *      bytes never pass through this service. docs/04 requires that, and the
 *      obvious multipart endpoint would have broken it.
 *
 * Needs the api running on API_URL (default http://localhost:3401).
 */
import {
  upsertUserFromGoogle, asUser, defaultSpaceId, createCaptureToken, getNote,
} from "@jotacular/domain";

const API = process.env.API_URL ?? "http://localhost:3401";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const stamp = Date.now();
const user = await upsertUserFromGoogle({
  googleSub: `shr-${stamp}`, email: `shr-${stamp}@example.test`, displayName: "Sam",
});
const A = asUser(user.id);
const spaceId = await defaultSpaceId(A);
const { token } = await createCaptureToken(A, spaceId, "iPhone (smoke)");

const post = (path: string, body: unknown, bearer = token) =>
  fetch(`${API}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const bodyOf = async (noteId: string) => (await getNote(A, noteId)).body;
const titleOf = async (noteId: string) => (await getNote(A, noteId)).title;

console.log("\na link, shared");
{
  const res = await post("/v1/capture", {
    url: "https://www.theguardian.com/lifeandstyle/2026/aug/12/a-very-long-slug-about-boats?utm_source=share",
    request_id: `link-${stamp}`,
    source: "share-sheet",
  });
  const json = await res.json() as { note_id: string; success: boolean };
  check("a URL alone is enough to capture", res.status === 201, `status ${res.status}`);

  const body = await bodyOf(json.note_id);
  check("the link itself is kept, whole", body.includes("a-very-long-slug-about-boats"));
  check("...including its tracking parameters, untouched", body.includes("utm_source=share"));

  // The point of the exercise. `inferTitle` names a note from its first line,
  // so a bare href used to become a title nobody could read in a list.
  const title = await titleOf(json.note_id);
  check("the note is titled with the site, not the href", title === "theguardian.com", String(title));

  const again = await post("/v1/capture", {
    url: "https://example.com/x", request_id: `link-${stamp}`,
  });
  check("a retry is deduplicated", again.status === 200, `status ${again.status}`);
}

console.log("\na link with a title and a note on it");
{
  const res = await post("/v1/capture", {
    title: "Buying a second-hand boat",
    text: "the bit about surveys",
    url: "https://example.com/boats",
    request_id: `titled-${stamp}`,
  });
  const json = await res.json() as { note_id: string };
  check("it captures", res.status === 201, `status ${res.status}`);
  check("the page title becomes the note's title",
    (await titleOf(json.note_id)) === "Buying a second-hand boat", String(await titleOf(json.note_id)));

  const body = await bodyOf(json.note_id);
  check("what they said is kept", body.includes("the bit about surveys"));
  check("...and so is the link", body.includes("https://example.com/boats"));
}

console.log("\nnothing at all is still nothing");
{
  const res = await post("/v1/capture", { request_id: `empty-${stamp}` });
  check("an empty share is refused", res.status === 400, `status ${res.status}`);
}

console.log("\na photo, in three steps and no bytes through here");
{
  const reserve = await post("/v1/capture/media", {
    kind: "image",
    content_type: "image/png",
    text: "van hire receipt",
    request_id: `photo-${stamp}`,
  });
  const slot = await reserve.json() as {
    note_id: string; block_id: string; upload_url: string;
    upload_headers: Record<string, string>;
  };
  check("a block is reserved", reserve.status === 201, `status ${reserve.status}`);
  check("...with somewhere to put the bytes", typeof slot.upload_url === "string" && slot.upload_url.length > 0);
  // The whole architectural point: the URL we hand back is NOT this service.
  // On Azure it is Blob; in development it is the signed local driver.
  check("...on a note that says what the photo is of",
    (await bodyOf(slot.note_id)).includes("van hire receipt"));

  const png = Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100" +
    "05fe02fea7e3e5ba0000000049454e44ae426082", "hex");
  const put = await fetch(slot.upload_url, {
    method: "PUT",
    headers: { ...slot.upload_headers, "content-length": String(png.length) },
    body: png,
  });
  check("the bytes upload straight to storage", put.ok, `status ${put.status}`);

  const done = await post(`/v1/capture/media/${slot.block_id}`, { byte_size: png.length });
  check("finalizing succeeds", done.status === 200, `status ${done.status}`);

  const note = await getNote(A, slot.note_id);
  const image = note.blocks?.find((b) => b.kind === "image");
  check("the note has an image block", image !== undefined,
    note.blocks?.map((b) => b.kind).join(", "));
  // Queued for the recognizer, which is what makes a photographed receipt
  // findable by what is written on it.
  check("...queued to be read", image?.transcriptState === "pending", String(image?.transcriptState));

  const unfinished = await post(`/v1/capture/media/${slot.block_id}`, { byte_size: 0 });
  check("a nonsense size is refused", unfinished.status === 400, `status ${unfinished.status}`);
}

console.log("\nwhose token it is");
{
  const stranger = await post("/v1/capture/media", {
    kind: "image", content_type: "image/png",
  }, "jd_cap_not-a-real-token");
  check("a bad token cannot reserve a block", stranger.status === 401, `status ${stranger.status}`);

  const noAuth = await fetch(`${API}/v1/capture/media`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "image", content_type: "image/png" }),
  });
  check("nor can no token at all", noAuth.status === 401, `status ${noAuth.status}`);
}

console.log(failures === 0 ? "\nshare: all good\n" : `\nshare: ${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
