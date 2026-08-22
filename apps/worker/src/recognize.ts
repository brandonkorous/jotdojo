import sharp from "sharp";
import {
  claimRecognizeJobs, storeTranscript, failTranscript, finishJob, recordRecognition,
  type RecognizeJob,
} from "@jotdojo/domain";
import { toSvg, bands } from "@jotdojo/ink-render";
import { storage } from "@jotdojo/storage";
import { RecognitionError, type Recognizer, type Page } from "@jotdojo/vision";
import { TranscriptionError, type Transcriber } from "@jotdojo/speech";
import { sourceFor } from "./sources";

export type RecognizeResult = { claimed: number; read: number; failed: number };

/** A page taller than this is split, so the model does not skim the middle. */
const BAND_HEIGHT = 700;
/** Enough bands for a very long page; beyond this the cost stops being worth it. */
const MAX_BANDS = 8;

/**
 * Rasterise strokes for the model.
 *
 * SVG through sharp rather than a canvas: the worker has no DOM, and librsvg
 * is already there. PNG rather than JPEG because handwriting is thin high
 * contrast lines and JPEG ringing around them is exactly the artefact that
 * turns an l into a 1.
 */
async function render(job: RecognizeJob): Promise<Page[]> {
  if (job.kind === "ink") {
    if (!job.document) return [];
    const pages = bands(job.document, BAND_HEIGHT).slice(0, MAX_BANDS);
    return Promise.all(pages.map(async (band) => ({
      mediaType: "image/png",
      base64: (await sharp(Buffer.from(toSvg(band, { mode: "recognition" })))
        .png({ compressionLevel: 6 })
        .toBuffer()).toString("base64"),
    })));
  }

  if (job.kind === "image") {
    const store = storage();
    if (!store || !job.blobUrl) throw new RecognitionError("no storage for this image", false);
    const raw = Buffer.from(await store.read(job.blobUrl));

    /**
     * Normalised before it reaches the model, and each step earns its place.
     *
     * `rotate()` with no argument applies the EXIF orientation -- a phone photo
     * is very often stored sideways with a tag saying so, and a model handed a
     * rotated napkin reads almost nothing off it.
     *
     * Resized because a 12-megapixel photo costs several times the tokens of a
     * 2000px one and reads no better; HEIC and friends become JPEG because that
     * is what the vision APIs accept.
     */
    return [{
      mediaType: "image/jpeg",
      base64: (await sharp(raw)
        .rotate()
        .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer()).toString("base64"),
    }];
  }

  // Audio is not an image and cannot go to a vision model. It has its own
  // recognizer; runRecognitionCycle refuses to send it here.
  throw new RecognitionError(`cannot render ${job.kind} as an image`, false);
}

/**
 * One recognition cycle.
 *
 * Per job rather than per batch, unlike embedding: a vision call is expensive
 * and slow, and batching several people's pages into one request would mean one
 * bad page costs everyone their transcript. Claiming several and handling them
 * one at a time keeps the failure blast radius at one note.
 */
export async function runRecognitionCycle(
  recognizer: Recognizer | null, transcriber: Transcriber | null, batch = 4,
): Promise<RecognizeResult> {
  const jobs = await claimRecognizeJobs(batch);
  if (jobs.length === 0) return { claimed: 0, read: 0, failed: 0 };

  let read = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      // Two different models for two different senses. A block whose provider
      // is missing is failed explicitly rather than left claimed -- a job that
      // silently completes strands the artifact as permanently unread with
      // nothing saying why, and one that is left claimed spins the queue.
      const reading = job.kind === "audio"
        ? await transcribe(job, transcriber)
        : await caption(job, recognizer);

      // An empty reading is a real answer -- a page of doodles has no text on
      // it. Storing it as 'ready' with an empty transcript stops the block
      // being re-read forever, which is what 'pending' would do.
      // The source names WHAT read it and HOW, because "who said this" is a
      // question people and agents both ask of a transcript. docs/04. Shared
      // with the re-reading pass, which compares against it. ADR-046.
      const source = sourceFor(job.kind, {
        vision: recognizer?.model, speech: transcriber?.model,
      });
      await storeTranscript(job.blockId, reading.text, source, reading.confidence);
      await recordRecognition(job.blockId, unitsFor(job.kind, reading));
      await finishJob(job.jobId);
      read++;
    } catch (err) {
      failed++;
      const retryable = err instanceof RecognitionError || err instanceof TranscriptionError
        ? err.retryable
        : true;
      // The strokes are safe either way; only the reading failed. Marking the
      // block 'failed' lets the UI offer "read this again" instead of showing
      // a spinner that never resolves.
      if (!retryable) await failTranscript(job.blockId);
      await finishJob(job.jobId, (err as Error).message);
    }
  }

  return { claimed: jobs.length, read, failed };
}

/**
 * What one reading cost, in the units ADR-007 meters.
 *
 * A page and a photo are one each. Audio is charged by STARTED MINUTE, derived
 * from the last word's timestamp rather than the file size -- a long silence
 * is not work, and a compressed codec is not a discount.
 */
function unitsFor(kind: string, reading: object): number {
  if (kind !== "audio") return 1;
  // Only a Transcription carries word timings; a vision Reading has none, and
  // the kind check above is what guarantees which one this is.
  const words = (reading as { words?: { end: number }[] }).words;
  return Math.max(1, Math.ceil((words?.at(-1)?.end ?? 0) / 60));
}

/** Ink and images: rendered to an image and read by a vision model. */
async function caption(job: RecognizeJob, recognizer: Recognizer | null) {
  if (!recognizer) {
    throw new RecognitionError("no VISION_PROVIDER is configured", false);
  }
  return recognizer.read(await render(job));
}

/**
 * Audio: fetched from storage and sent to a speech model.
 *
 * The bytes are streamed from the blob rather than held anywhere by us. An hour
 * of recording is tens of megabytes, and the worker may be handling several
 * jobs -- reading them into a long-lived structure is how a background process
 * quietly acquires a memory ceiling.
 */
async function transcribe(job: RecognizeJob, transcriber: Transcriber | null) {
  if (!transcriber) {
    throw new TranscriptionError("no SPEECH_PROVIDER is configured", false);
  }
  const store = storage();
  if (!store || !job.blobUrl) {
    throw new TranscriptionError("no storage for this recording", false);
  }

  const bytes = await store.read(job.blobUrl);
  const result = await transcriber.transcribe(
    new Uint8Array(bytes), job.mimeType ?? "audio/webm",
  );
  return { text: result.text, confidence: result.confidence };
}
