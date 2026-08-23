/**
 * Photos, end to end: reserve -> upload -> finalise -> recognise -> searchable.
 *
 * This is M4's exit criterion in miniature -- photograph a bar napkin and have
 * an agent read back what was written on it -- minus a real model.
 *
 * It hosts its OWN API on a spare port rather than borrowing whatever is
 * running. The local storage driver's signed URLs point at API_URL, so a test
 * that depended on an external server would silently sign URLs for the wrong
 * process the moment anyone's .env differed.
 */
process.env.STORAGE_PROVIDER = "local";
process.env.STORAGE_LOCAL_ROOT = process.env.STORAGE_LOCAL_ROOT ?? ".media-smoke";
process.env.API_URL = "http://127.0.0.1:3403";

import { rm } from "node:fs/promises";
import Fastify from "fastify";
import sharp from "sharp";
import { fakeRecognizer } from "@jotacular/vision";
import { fakeTranscriber, confidenceFromLogprob } from "@jotacular/speech";
import { registerMediaRoutes } from "../../api/src/media";
import {
  upsertUserFromGoogle, asUser, createNote, defaultSpaceId, searchNotes, getNote,
  createMediaBlock, finalizeMedia, mediaUrl,
} from "@jotacular/domain";
import { runRecognitionCycle } from "../src/recognize";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

async function refused(label: string, code: string, fn: () => Promise<unknown>) {
  let got = "nothing was thrown";
  try { await fn(); } catch (err) {
    got = (err as { code?: string }).code ?? `uncoded: ${(err as Error).message}`;
  }
  check(label, got === code, `expected "${code}", got "${got}"`);
}

const app = Fastify({ logger: false });
registerMediaRoutes(app);
await app.listen({ port: 3403, host: "127.0.0.1" });

/** A small JPEG standing in for a photo of a napkin. */
const photo = await sharp({
  create: { width: 900, height: 600, channels: 3, background: "#ffffff" },
}).jpeg().toBuffer();

const stamp = Date.now();
const alice = await upsertUserFromGoogle({
  googleSub: `med-a-${stamp}`, email: `ma-${stamp}@example.test`, displayName: "Alice",
});
const bob = await upsertUserFromGoogle({
  googleSub: `med-b-${stamp}`, email: `mb-${stamp}@example.test`, displayName: "Bob",
});
const A = asUser(alice.id);
const B = asUser(bob.id);
const space = await defaultSpaceId(A);
const note = await createNote(A, space, "");

console.log("\nreserve");

const slot = await createMediaBlock(A, note.id, "image", "image/jpeg");
check("a block is reserved before any bytes exist", Boolean(slot.blockId));
check("...and we are handed somewhere to PUT them", slot.url.includes("/v1/media/"));
check("the key is derived from the space, never from the client",
  slot.url.includes(space), slot.url);
check("the block starts as pending",
  (await getNote(A, note.id)).blocks?.some(
    (b) => b.id === slot.blockId && b.transcriptState === "pending") === true);

await refused("an unsupported type is REFUSED", "bad_media_type",
  () => createMediaBlock(A, note.id, "image", "image/tiff"));
await refused("audio smuggled in as an image is REFUSED", "bad_media_type",
  () => createMediaBlock(A, note.id, "image", "audio/webm"));
await refused("bob cannot attach media to alice's note", "not_found",
  () => createMediaBlock(B, note.id, "image", "image/jpeg"));

console.log("\nupload");

const put = await fetch(slot.url, { method: "PUT", headers: slot.headers, body: new Uint8Array(photo) });
check("the bytes upload against the signed URL", put.status === 201, `status ${put.status}`);

const tampered = slot.url.replace(/sig=[^&]+/, "sig=obviouslywrong");
check("a tampered signature is REFUSED",
  (await fetch(tampered, { method: "PUT", headers: slot.headers, body: new Uint8Array(photo) })).status === 403);

const expired = slot.url.replace(/expires=\d+/, "expires=1");
check("an expired link is REFUSED",
  (await fetch(expired, { method: "PUT", headers: slot.headers, body: new Uint8Array(photo) })).status === 403);

const unsigned = slot.url.split("?")[0]!;
check("an unsigned PUT is REFUSED",
  (await fetch(unsigned, { method: "PUT", headers: slot.headers, body: new Uint8Array(photo) })).status === 403);

console.log("\nfinalise and read");

await refused("an implausible size is REFUSED", "media_too_large",
  () => finalizeMedia(A, slot.blockId, { byteSize: 999_999_999 }));
await refused("bob cannot finalise alice's block", "not_found",
  () => finalizeMedia(B, slot.blockId, { byteSize: photo.length }));

await finalizeMedia(A, slot.blockId, { byteSize: photo.length, width: 900, height: 600 });

const cycle = await runRecognitionCycle(fakeRecognizer("Tuesday: ring the landlord"), null, 8);
check("the photo is claimed and read", cycle.claimed >= 1 && cycle.read >= 1);

const after = (await getNote(A, note.id)).blocks?.find((b) => b.id === slot.blockId);
check("the caption is stored", after?.transcript === "Tuesday: ring the landlord");
check("...attributed to a vision model, not to handwriting recognition",
  after?.transcriptSource?.startsWith("caption:vlm:") === true, after?.transcriptSource ?? "");
check("...and carries a confidence", after?.confidence === 0.82);

check("what was in the photo is now searchable",
  (await searchNotes(A, space, "landlord")).some((n) => n.id === note.id));

console.log("\nserving it back");

const url = await mediaUrl(A, slot.blockId);
const got = await fetch(url);
check("a signed read URL serves the original bytes",
  got.status === 200 && (await got.arrayBuffer()).byteLength === photo.length);

await refused("bob cannot get a URL for alice's photo", "not_found",
  () => mediaUrl(B, slot.blockId));

const traversal = `${process.env.API_URL}/v1/media/../../../etc/passwd?expires=${Date.now() + 60000}&sig=x`;
check("a traversal is REFUSED even before the signature",
  [400, 403, 404].includes((await fetch(traversal)).status));

console.log("\nvoice");

// Opaque bytes standing in for a recording. The fake transcriber cannot hear
// anything; what is under test is that audio takes a DIFFERENT model from ink
// and photos while travelling the same queue and landing in the same fields.
const recording = Buffer.from("not really webm, but bytes are bytes");

await refused("a video type is REFUSED as audio", "bad_media_type",
  () => createMediaBlock(A, note.id, "audio", "video/mp4"));

const clip = await createMediaBlock(A, note.id, "audio", "audio/webm");
const putClip = await fetch(clip.url, {
  method: "PUT", headers: clip.headers, body: new Uint8Array(recording),
});
check("the recording uploads", putClip.status === 201, `status ${putClip.status}`);

await finalizeMedia(A, clip.blockId, {
  byteSize: recording.length, durationMs: 42_000,
});

// A vision model must never be handed audio, and a speech model must never be
// handed a page of ink. The cycle takes both and dispatches on kind.
const voiceCycle = await runRecognitionCycle(
  fakeRecognizer("should not be used for audio"),
  fakeTranscriber("call the landlord about the lease"),
  8,
);
check("the recording is claimed and transcribed", voiceCycle.read >= 1);

const heard = (await getNote(A, note.id)).blocks?.find((b) => b.id === clip.blockId);
check("the transcript is stored", heard?.transcript === "call the landlord about the lease");
check("...attributed to speech recognition, not to a vision model",
  heard?.transcriptSource?.startsWith("asr:") === true, heard?.transcriptSource ?? "");
check("...and carries the provider's confidence", heard?.confidence === 0.79);
check("what was said is searchable",
  (await searchNotes(A, space, "lease")).some((n) => n.id === note.id));

console.log("\nwhen a provider is missing");

const orphan = await createMediaBlock(A, note.id, "audio", "audio/webm");
await fetch(orphan.url, {
  method: "PUT", headers: orphan.headers, body: new Uint8Array(recording),
});
await finalizeMedia(A, orphan.blockId, { byteSize: recording.length, durationMs: 1000 });

// No transcriber configured. The block must end up FAILED, not stuck pending
// forever -- a spinner that never resolves is indistinguishable from a bug,
// and the recording itself is perfectly safe.
const noProvider = await runRecognitionCycle(fakeRecognizer(), null, 8);
check("a recording with no speech provider is failed, not left pending",
  noProvider.failed >= 1);
const stranded = (await getNote(A, note.id)).blocks?.find((b) => b.id === orphan.blockId);
check("...and the block says so", stranded?.transcriptState === "failed",
  stranded?.transcriptState ?? "");
check("...while the audio itself is still there",
  (await fetch(await mediaUrl(A, orphan.blockId))).status === 200);

console.log("\nconfidence from whisper log-probabilities");
check("clean speech maps high", confidenceFromLogprob([{ avg_logprob: -0.1 }]) > 0.85);
check("guessed speech maps low", confidenceFromLogprob([{ avg_logprob: -1.5 }]) < 0.3);
check("no signal is not a claim of certainty", confidenceFromLogprob([]) === 0.5);

console.log("\nno schema change was needed");
check("blocks.kind already allowed 'image'", after?.kind === "image");
check("the note now mixes typed text and a photo",
  ((await getNote(A, note.id)).blocks?.length ?? 0) >= 2);

await app.close();
await rm(process.env.STORAGE_LOCAL_ROOT!, { recursive: true, force: true });

console.log(failures === 0 ? "\nmedia smoke: all checks passed" : `\nmedia smoke: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
