import { RecognitionError, STRUCTURE_MARKER, type Page, type Recognizer } from "./provider";

/**
 * What is DRAWN on a page, as opposed to what is written on it. ADR-066.
 *
 * The second question we ask a vision model, and a different one: a transcript
 * carries words, and an arrow from one box to another is not a word. A hand-
 * drawn diagram read only for its text comes back as
 * `[handwritten, nothing legible on it]` -- true, and useless.
 *
 * Separate from provider.ts because that file is the TRANSPORT: how to reach
 * three different APIs and get a string back. This is one of the two things we
 * say into it.
 */

export type Shape = {
  kind: "rectangle" | "circle" | "diamond" | "arrow" | "line" | "text" | "other";
  /** In the same document units the strokes are in, so a caller can point at
   *  the thing on the page rather than describing it. */
  bounds: { x: number; y: number; w: number; h: number };
  /** Words written inside or beside it, when there are any. */
  label?: string;
  /** For arrows and connectors: the index, in this array, of what it joins.
   *  This is the whole reason structure is worth reading at all. */
  from?: number;
  to?: number;
};

export type Structure = { shapes: Shape[]; confidence: number };

/** Loose on purpose. A model that invents a shape name should not fail a whole
 *  page; the name is carried through as `other` and the bounds still mean
 *  something. */
const KINDS = new Set(["rectangle", "circle", "diamond", "arrow", "line", "text", "other"]);

/**
 * The instruction.
 *
 * The marker in the first line is load bearing: `fakeRecognizer` keys on it to
 * know which of the two questions it is being asked, and it is a shared
 * constant rather than a phrase either side hopes the other uses.
 */
export const STRUCTURE_PROMPT = `[${STRUCTURE_MARKER}]
You are reading a hand-drawn DIAGRAM from a notes app.

Return ONLY a JSON object: {"shapes": Shape[], "confidence": number}

A Shape is {"kind", "bounds": {"x","y","w","h"}, "label"?, "from"?, "to"?} where
kind is one of: rectangle, circle, diamond, arrow, line, text, other.

Rules:
- Report LAYOUT, not prose. Boxes, circles, arrows, connectors, brackets, tables.
- bounds are in the image's own pixel coordinates, top-left origin.
- For an arrow or connector, set "from" and "to" to the INDEX in your shapes array
  of the shapes it joins. This is the most valuable thing you can report; a diagram
  is its connections.
- "label" is text written inside or immediately beside a shape. Transcribe it exactly.
- If the page is prose, a list, or ordinary handwriting with no diagram on it,
  return {"shapes": [], "confidence": 1}. That is a correct and common answer.
- Do NOT invent structure to be helpful. An empty array is better than a guess.
- confidence is your own honest estimate from 0 to 1. Be harsh.`;

export async function readStructure(
  recognizer: Recognizer, pages: Page[],
): Promise<Structure> {
  if (pages.length === 0) return { shapes: [], confidence: 1 };
  return parseStructure(await recognizer.ask(pages, STRUCTURE_PROMPT));
}

/** Tolerant of a model that wrapped its JSON in prose or a code fence, exactly
 *  like parseReading -- and for the same reason: they all do it sometimes. */
export function parseStructure(raw: string): Structure {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(raw)?.[1];
  const candidate = (fenced ?? raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new RecognitionError("the model did not return JSON", false);
  }

  let parsed: { shapes?: unknown; confidence?: unknown };
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new RecognitionError("the model returned malformed JSON", false);
  }
  if (!Array.isArray(parsed.shapes)) {
    throw new RecognitionError("the model returned no shapes array", false);
  }

  const confidence = Number(parsed.confidence);
  return {
    shapes: parsed.shapes.flatMap(shapeOf),
    // A missing or absurd confidence becomes 0.5 rather than a lie in either
    // direction. It is stored and shown.
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.5,
  };
}

/**
 * One shape, or nothing.
 *
 * A malformed entry is DROPPED rather than failing the page. The alternative
 * is that one bad box costs somebody the whole reading of their diagram, and
 * these go into a jsonb column that MCP will hand to another model.
 */
function shapeOf(raw: unknown): Shape[] {
  const s = raw as Partial<Shape>;
  if (!s || typeof s !== "object") return [];
  const b = s.bounds as Partial<Shape["bounds"]> | undefined;
  if (!b) return [];
  const nums = [b.x, b.y, b.w, b.h];
  if (nums.some((n) => typeof n !== "number" || !Number.isFinite(n))) return [];
  if (b.w! <= 0 || b.h! <= 0) return [];

  return [{
    kind: KINDS.has(String(s.kind)) ? s.kind as Shape["kind"] : "other",
    bounds: { x: b.x!, y: b.y!, w: b.w!, h: b.h! },
    ...(typeof s.label === "string" && s.label.trim() ? { label: s.label.slice(0, 500) } : {}),
    ...(Number.isInteger(s.from) ? { from: s.from } : {}),
    ...(Number.isInteger(s.to) ? { to: s.to } : {}),
  }];
}
