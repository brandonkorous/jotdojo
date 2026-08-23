import { findInkBlock, getInk, type Actor } from "@jotacular/domain";
import { contentBounds } from "@jotacular/ink-render";
import { toPng } from "@jotacular/ink-render/raster";

/**
 * Handing an agent the page itself. ADR-068.
 *
 * A transcript is words and nothing else. Arrows, boxes, a crossed-out line, a
 * freehand table, a sketch of a room -- all of it comes back from recognition
 * as `[handwritten, nothing legible on it]`, which is true and useless. We keep
 * the strokes and can redraw them at any size, so we can show the page. Nobody
 * holding a photograph of it can.
 *
 * Separate from tools.ts because that file is a registry: what each tool is
 * called and what it takes. This is what one of them MEANS.
 */

/** Big enough to read handwriting, small enough not to spend a page of context
 *  on a shopping list. Tiling is recognition's problem, not a viewer's. */
const VIEW_EDGE = 1400;

export type ViewResult = {
  content: Array<
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
  >;
};

const text = (body: string): ViewResult => ({ content: [{ type: "text", text: body }] });

export async function viewNote(actor: Actor, noteId: string): Promise<ViewResult> {
  const layer = await findInkBlock(actor, noteId);
  // Said plainly. An agent told nothing here concludes the tool is broken and
  // goes looking for another way to see a page that has no handwriting on it.
  if (!layer) {
    return text(`Note ${noteId} has no handwriting on it. get_note has all of it.`);
  }

  const { document } = await getInk(actor, layer.blockId);
  // NULL by design for a blank page, and every caller has to handle it: a 1x1
  // transparent image presented as somebody's page is worse than a sentence
  // saying the page is empty.
  if (!contentBounds(document)) {
    return text(`Note ${noteId} has an ink layer with nothing drawn on it yet.`);
  }

  // `text: true` -- the typed boxes on the plane are part of the page, and an
  // agent looking at a diagram with labels needs the labels. ADR-065.
  const png = await toPng(document, { mode: "viewing", maxEdge: VIEW_EDGE, text: true });
  return {
    content: [
      { type: "text", text: caption(noteId, layer) },
      { type: "image", data: png.toString("base64"), mimeType: "image/png" },
    ],
  };
}

/**
 * What the picture is, and how it stands next to the words.
 *
 * An image arriving with no frame around it is one an agent describes as though
 * somebody had sent a photograph. This says what it is and, more importantly,
 * which of the two things in front of it is the record and which is a guess --
 * the same honesty renderBlock applies to a transcript, applied to a page.
 *
 * Exported for smoke-render.ts: the framing round an image is exactly the part
 * that can be silently wrong.
 */
export function caption(noteId: string, layer: {
  strokeCount: number;
  transcript: string | null;
  transcriptState: string;
  transcriptSource: string | null;
  confidence: number | null;
}): string {
  const lines = [
    `The handwriting on note ${noteId}: ${layer.strokeCount} `
    + `${layer.strokeCount === 1 ? "stroke" : "strokes"}, redrawn from what the person `
    + "actually drew rather than photographed. THIS IS THE RECORD. Anything below is a "
    + "machine reading of it, and where they disagree the page wins.",
  ];

  if (layer.transcriptState === "pending") {
    lines.push("Nothing has read it back into text yet, so the image is all there is.");
  } else if (layer.transcriptState === "failed") {
    lines.push("A reading was attempted and failed. The strokes are intact; only the reading is missing.");
  } else if (!layer.transcript?.trim()) {
    // The case this tool exists for. A recognizer finding no words on a diagram
    // is correct, and an agent that stops there reports a blank page.
    lines.push(
      "A reader found no words on it. That is often RIGHT and not a failure -- a diagram, "
      + "a sketch or a table has layout rather than sentences. Describe what you can see.",
    );
  } else if (layer.transcriptSource === "user") {
    // Not a guess, so no confidence figure. Attaching one would invite a hedge
    // about the one thing on the page that is certain.
    lines.push(`The author typed this out themselves: ${layer.transcript}`);
  } else {
    const sure = layer.confidence === null ? "unmeasured confidence" : `confidence ${layer.confidence.toFixed(2)}`;
    lines.push(`A model read it as (${sure}): ${layer.transcript}`);
  }

  return lines.join("\n\n");
}
