import {
  claimStructureJobs, storeStructure, finishJob, recordRecognition,
  type StructureJob,
} from "@jotacular/domain";
import { tiles, bounds } from "@jotacular/ink-render";
import { toPng } from "@jotacular/ink-render/raster";
import { readStructure, RecognitionError, type Recognizer } from "@jotacular/vision";
import { structureSourceFor } from "./sources";

/**
 * Reading a page for what is DRAWN on it. ADR-066.
 *
 * The other half of a diagram. `runRecognitionCycle` asks what the page SAYS
 * and gets words; this asks what is on it and gets boxes, arrows and the
 * connections between them -- which is what makes a hand-drawn diagram
 * something an agent can reason over rather than look at.
 *
 * Separate from recognize.ts on purpose: same queue shape, different question,
 * different staleness key, different metering row. Folding it in would put two
 * prompts and two result shapes in one cycle function.
 */

export type StructureResult = { claimed: number; read: number; failed: number };

/** ONE image, not tiles. A diagram's meaning is in the relationships between
 *  its parts, and a model handed a quarter of it at a time cannot see them. */
const MAX_EDGE = 2000;

/**
 * Structure is priced like a page, because it is one model call over one page.
 * Cheaper than transcription in tiles and never free -- docs/01 lists model
 * calls as cost of goods.
 */
const UNITS = 1;

export async function runStructureCycle(
  recognizer: Recognizer | null, batch = 2,
): Promise<StructureResult> {
  if (!recognizer) return { claimed: 0, read: 0, failed: 0 };

  const jobs = await claimStructureJobs(batch);
  if (jobs.length === 0) return { claimed: 0, read: 0, failed: 0 };

  let read = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      await readOne(recognizer, job);
      await finishJob(job.jobId);
      read++;
    } catch (err) {
      failed++;
      // No `failTranscript` equivalent, and deliberately: structure is an
      // ADDITION to a page, so a page whose structure could not be read is a
      // page with a transcript and no diagram -- which is exactly what most
      // pages are anyway. Nothing to mark, nothing to apologise for.
      await finishJob(job.jobId, (err as Error).message);
    }
  }

  return { claimed: jobs.length, read, failed };
}

async function readOne(recognizer: Recognizer, job: StructureJob): Promise<void> {
  const box = bounds(job.document);
  // Nothing drawn. Storing an empty result is still worth doing: it is the
  // difference between "looked, no diagram" and "never looked", and a reader
  // that cannot tell those apart reports a blank page as a considered answer.
  if (!box) {
    await storeStructure(job.blockId, [], structureSourceFor(recognizer.model), 1);
    return;
  }

  // `text: false` -- the DEFAULT, and it matters here as much as it does for a
  // transcript. Typed boxes on the plane are not drawn shapes, and a model
  // handed them would report the note's own paragraphs as diagram nodes.
  // ADR-065.
  const whole = tiles(job.document, { tilePx: { w: MAX_EDGE, h: MAX_EDGE }, bounds: box })[0];
  if (!whole) return;

  const png = await toPng(whole.doc, {
    mode: "recognition", bounds: box, maxEdge: MAX_EDGE,
  });

  const found = await readStructure(recognizer, [{
    mediaType: "image/png", base64: png.toString("base64"),
  }]);

  await storeStructure(
    job.blockId, found.shapes, structureSourceFor(recognizer.model), found.confidence,
  );
  // Charged AFTER the model answered, never before: a call that failed cost us
  // nothing worth billing. ADR-007.
  await recordRecognition(job.blockId, UNITS, "structure");
}

/** Re-exported so index.ts does not have to know which error class this is. */
export { RecognitionError };
