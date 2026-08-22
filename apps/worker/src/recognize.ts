import sharp from "sharp";
import {
  claimRecognizeJobs, storeTranscript, failTranscript, finishJob, recordRecognition,
  type RecognizeJob,
} from "@jotdojo/domain";
import { toSvg, tiles, bounds } from "@jotdojo/ink-render";
import { storage } from "@jotdojo/storage";
import { RecognitionError, type Recognizer, type Page } from "@jotdojo/vision";
import { TranscriptionError, type Transcriber } from "@jotdojo/speech";
import { sourceFor } from "./sources";

export type RecognizeResult = { claimed: number; read: number; failed: number };

/** One image the model reads. Pixels, not document units -- see `tiles`. */
const TILE_PX = { w: 1600, h: 700 };
/** The ceiling on ONE surface's cost. Beyond it the read is partial and says so. */
const MAX_TILES = 32;
/** Images per request. A provider limit, not a cost decision. */
const IMAGES_PER_CALL = 8;
/** Rendered tiles that add up to one metered page. */
const TILES_PER_UNIT = 4;

/** What a reading cost and how much of the surface it actually covered. */
type Read = {
  text: string;
  confidence: number;
  units: number;
  /** 1 when the whole surface was read; below 1 when tiles were dropped. */
  coverage: number;
};

type Rendered = { pages: Page[]; produced: number; rendered: number };

/**
 * Rasterise strokes for the model.
 *
 * SVG through sharp rather than a canvas: the worker has no DOM, and librsvg
 * is already there. PNG rather than JPEG because handwriting is thin high
 * contrast lines and JPEG ringing around them is exactly the artefact that
 * turns an l into a 1.
 */
async function render(job: RecognizeJob): Promise<Rendered> {
  if (job.kind === "ink") {
    if (!job.document) return { pages: [], produced: 0, rendered: 0 };

    // The frame comes from the INK, never from the stored canvas -- that is a
    // viewport written once at creation, and ink has always been able to live
    // outside it. ADR-053.
    const box = bounds(job.document);
    if (!box) return { pages: [], produced: 0, rendered: 0 };

    const all = tiles(job.document, { tilePx: TILE_PX, bounds: box });
    const kept = all.slice(0, MAX_TILES);
    const pages = await Promise.all(kept.map(async (tile) => ({
      mediaType: "image/png",
      base64: (await sharp(Buffer.from(toSvg(tile.doc, {
        mode: "recognition", bounds: tile.rect,
      }))).png({ compressionLevel: 6 }).toBuffer()).toString("base64"),
    })));
    return { pages, produced: all.length, rendered: kept.length };
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
    return { produced: 1, rendered: 1, pages: [{
      mediaType: "image/jpeg",
      base64: (await sharp(raw)
        .rotate()
        .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer()).toString("base64"),
    }] };
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
      // Zero units for a surface with nothing on it: no model was called, so
      // there is nothing to charge for.
      if (reading.units > 0) await recordRecognition(job.blockId, reading.units);
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
 * Ink and images: rendered to images and read by a vision model.
 *
 * A surface can now be many images, so this is where several calls become one
 * reading. Confidence is the WORST of them -- a page is only as trustworthy as
 * the piece that was hardest to read.
 */
async function caption(job: RecognizeJob, recognizer: Recognizer | null): Promise<Read> {
  if (!recognizer) {
    throw new RecognitionError("no VISION_PROVIDER is configured", false);
  }

  const { pages, produced, rendered } = await render(job);
  // Nothing drawn. Do not send an empty image list to a provider that would
  // either bill for the turn or refuse it.
  if (pages.length === 0) return { text: "", confidence: 1, units: 0, coverage: 1 };

  const texts: string[] = [];
  let confidence = 1;
  for (let i = 0; i < pages.length; i += IMAGES_PER_CALL) {
    const reading = await recognizer.read(pages.slice(i, i + IMAGES_PER_CALL));
    if (reading.text) texts.push(reading.text);
    confidence = Math.min(confidence, reading.confidence);
  }

  const coverage = produced === 0 ? 1 : rendered / produced;
  if (coverage < 1) {
    console.warn(
      `[worker] partial read of ${job.blockId}: ${rendered} of ${produced} regions`,
    );
  }
  // One unit is one page-equivalent. Metering per BLOCK would let one endless
  // canvas cost thirty pages of tokens against a single unit of allowance.
  return {
    text: texts.join("\n"),
    confidence,
    units: Math.max(1, Math.ceil(rendered / TILES_PER_UNIT)),
    coverage,
  };
}

/**
 * Audio: fetched from storage and sent to a speech model.
 *
 * The bytes are streamed from the blob rather than held anywhere by us. An hour
 * of recording is tens of megabytes, and the worker may be handling several
 * jobs -- reading them into a long-lived structure is how a background process
 * quietly acquires a memory ceiling.
 */
async function transcribe(job: RecognizeJob, transcriber: Transcriber | null): Promise<Read> {
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
  // Charged by STARTED MINUTE, from the last word's timestamp rather than the
  // file size: a long silence is not work, and a compressed codec is no
  // discount. Audio is never partial -- the whole recording goes in one call.
  const end = result.words?.at(-1)?.end ?? 0;
  return {
    text: result.text,
    confidence: result.confidence,
    units: Math.max(1, Math.ceil(end / 60)),
    coverage: 1,
  };
}
