/**
 * End-to-end test of the capture endpoint, over real HTTP.
 *
 * The capture path is the product's most important surface (docs/09) and its
 * credential is the weakest one we issue, so both the happy path and every
 * refusal get exercised. Requires the API running: pnpm --filter @jotdojo/api dev
 */
import {
  upsertUserFromGoogle, asUser, createCaptureToken, revokeCaptureToken,
  defaultSpaceId, listNotes, listCaptureTokens,
} from "@jotdojo/domain";

const API = `http://localhost:${process.env.API_PORT ?? 3401}`;

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `  (${detail})` : ""}`);
  if (!ok) failures++;
};

const post = async (token: string | null, body: unknown) => {
  const res = await fetch(`${API}/v1/capture`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() as Record<string, unknown> };
};

const stamp = Date.now();
const owner = await upsertUserFromGoogle({
  googleSub: `cap-owner-${stamp}`, email: `cap-owner-${stamp}@example.test`, displayName: "Owner",
});
const other = await upsertUserFromGoogle({
  googleSub: `cap-other-${stamp}`, email: `cap-other-${stamp}@example.test`, displayName: "Other",
});

const A = asUser(owner.id);
const B = asUser(other.id);
const aSpace = await defaultSpaceId(A);
const bSpace = await defaultSpaceId(B);

const { token } = await createCaptureToken(A, aSpace, "Smoke shortcut");
check("token is prefixed and opaque", token.startsWith("jd_cap_") && token.length > 40);

const health = await fetch(`${API}/health`);
check("health responds", health.ok);

const t0 = Date.now();
const first = await post(token, { text: "buy milk", request_id: `req-${stamp}-1`, source: "shortcut:jot" });
const elapsed = Date.now() - t0;
check("capture returns 201", first.status === 201, String(first.status));
check("capture returns a note url", typeof first.json.url === "string");
check(`capture is fast (${elapsed}ms, target <300ms)`, elapsed < 300, `${elapsed}ms`);

const retry = await post(token, { text: "buy milk", request_id: `req-${stamp}-1` });
check("retry with same request_id is deduplicated", retry.status === 200 && retry.json.deduplicated === true);
check("retry returns the SAME note", retry.json.note_id === first.json.note_id);

const notes = await listNotes(A, aSpace, 50);
check("exactly one note was created", notes.filter((n) => n.preview === "buy milk").length === 1);

check("no bearer is rejected", (await post(null, { text: "x" })).status === 401);
check("garbage token is rejected", (await post("jd_cap_nonsense", { text: "x" })).status === 401);
check("empty text is rejected", (await post(token, { text: "   " })).status === 400);

// The credential's whole design is that it can do exactly one thing.
const bNotesBefore = (await listNotes(B, bSpace, 50)).length;
await post(token, { text: "should never land in the other space", request_id: `req-${stamp}-x` });
check("capture cannot reach another user's space",
  (await listNotes(B, bSpace, 50)).length === bNotesBefore);

const tokens = await listCaptureTokens(A);
check("token is listed for its owner", tokens.some((t) => t.name === "Smoke shortcut"));
check("token records last used", tokens.find((t) => t.name === "Smoke shortcut")?.lastUsedAt !== null);
check("other user sees no tokens", (await listCaptureTokens(B)).length === 0);

await revokeCaptureToken(A, tokens.find((t) => t.name === "Smoke shortcut")!.id);
check("revoked token is rejected", (await post(token, { text: "after revoke" })).status === 401);

console.log(failures === 0 ? "\ncapture smoke: all checks passed" : `\ncapture smoke: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
