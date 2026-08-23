/**
 * The only place in jotdojo that sends an image to a model.
 *
 * Handwriting recognition, tier 2 of docs/08-ink.md: render the strokes to a
 * clean high-contrast PNG and ask a vision model to read it. Chosen over a
 * handwriting SDK because it needs no licence, no new infrastructure and no
 * per-seat cost, and frontier models read handwriting well. Do not buy an SDK
 * before there are users.
 */

export type Page = { mediaType: string; base64: string };

export type Reading = {
  text: string;
  /** 0..1, the model's own estimate. Always stored, always shown. */
  confidence: number;
};

export type Recognizer = {
  readonly model: string;
  /**
   * Ask the model a question about these images, and hand back what it said.
   *
   * RAW, and parameterised by prompt, because there are two questions now:
   * what does this page SAY (a transcript) and what is DRAWN on it (structure,
   * ADR-066). One transport, two questions, and the parsing belongs to
   * whoever asked -- the answers have different shapes.
   */
  ask(pages: Page[], prompt: string): Promise<string>;
  /** The transcript question, which is the common one. */
  read(pages: Page[]): Promise<Reading>;
};

/**
 * How a fake tells the two questions apart.
 *
 * A SHARED CONSTANT, not a phrase the fake hopes is in the prompt. The first
 * version keyed on the word "SHAPES" and the structural prompt never said it in
 * capitals, so the fake answered every structural request with a transcript and
 * the whole pipeline failed on a parse error -- in the one place a suite exists
 * to catch that. Both sides now name the same thing.
 */
export const STRUCTURE_MARKER = "STRUCTURE-QUESTION";

/** `read` in terms of `ask`, so no provider implements it twice. */
export const readWith = (ask: Recognizer["ask"]) => async (pages: Page[]): Promise<Reading> =>
  parseReading(await ask(pages, PROMPT));

export class RecognitionError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = "RecognitionError";
  }
}

/**
 * The instruction, in one place because it is the actual product surface.
 *
 * Two things it deliberately does NOT do: it does not ask the model to correct
 * spelling or tidy grammar, and it does not ask it to guess. A transcript that
 * silently improves on what someone wrote is worse than one with a gap in it,
 * because the person cannot tell which words are theirs.
 */
export const PROMPT = `You are transcribing handwriting from a notes app.

Return ONLY a JSON object: {"text": string, "confidence": number}

Rules:
- Transcribe exactly what is written. Do not correct spelling, grammar or punctuation.
- Preserve line breaks and list structure. Use markdown "- " for bulleted items.
- Where a word is genuinely illegible, write [?] rather than guessing.
- confidence is your own honest estimate from 0 to 1 that the whole transcript is
  correct. Be harsh. A page you mostly guessed at is not 0.9.
- If the image contains no handwriting at all, return {"text": "", "confidence": 1}.

When you are given more than one image, they are consecutive pieces of ONE surface
in reading order -- left to right, then top to bottom -- and they overlap slightly
at the edges. Transcribe them as a single continuous document, and do not repeat
text that appears in two of them.`;

/** Tolerant of a model that wrapped its JSON in prose or a code fence. */
export function parseReading(raw: string): Reading {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(raw)?.[1];
  const candidate = (fenced ?? raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new RecognitionError("the model did not return JSON", false);
  }
  let parsed: { text?: unknown; confidence?: unknown };
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new RecognitionError("the model returned malformed JSON", false);
  }
  if (typeof parsed.text !== "string") {
    throw new RecognitionError("the model returned no text", false);
  }
  const confidence = Number(parsed.confidence);
  return {
    text: parsed.text,
    // A missing or absurd confidence becomes 0.5 rather than a lie in either
    // direction. It is shown to people and sent over MCP; it has to mean
    // something.
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.5,
  };
}

// -------------------------------------------------------------- anthropic --

export function anthropicRecognizer(config: {
  apiKey: string; model: string; baseUrl?: string;
}): Recognizer {
  const ask: Recognizer["ask"] = async (pages, prompt) => {
    {
      const res = await fetch(`${config.baseUrl ?? "https://api.anthropic.com"}/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 4096,
          messages: [{
            role: "user",
            content: [
              ...pages.map((p) => ({
                type: "image",
                source: { type: "base64", media_type: p.mediaType, data: p.base64 },
              })),
              { type: "text", text: prompt },
            ],
          }],
        }),
        signal: AbortSignal.timeout(120_000),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new RecognitionError(
          `vision provider returned ${res.status}: ${body.slice(0, 300)}`,
          res.status === 429 || res.status >= 500,
        );
      }

      const json = await res.json() as { content?: Array<{ type: string; text?: string }> };
      const text = json.content?.filter((c) => c.type === "text").map((c) => c.text).join("");
      if (!text) throw new RecognitionError("the model returned no content", false);
      return text;
    }
  };
  return { model: config.model, ask, read: readWith(ask) };
}

// ------------------------------------------------------------ openai-like --

export function openAiRecognizer(config: {
  endpoint: string; apiKey: string; model: string; azure: boolean;
}): Recognizer {
  const ask: Recognizer["ask"] = async (pages, prompt) => {
    {
      const res = await fetch(config.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(config.azure
            ? { "api-key": config.apiKey }
            : { authorization: `Bearer ${config.apiKey}` }),
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 4096,
          messages: [{
            role: "user",
            content: [
              ...pages.map((p) => ({
                type: "image_url",
                image_url: { url: `data:${p.mediaType};base64,${p.base64}` },
              })),
              { type: "text", text: prompt },
            ],
          }],
        }),
        signal: AbortSignal.timeout(120_000),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new RecognitionError(
          `vision provider returned ${res.status}: ${body.slice(0, 300)}`,
          res.status === 429 || res.status >= 500,
        );
      }

      const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
      const text = json.choices?.[0]?.message?.content;
      if (!text) throw new RecognitionError("the model returned no content", false);
      return text;
    }
  };
  return { model: config.model, ask, read: readWith(ask) };
}

// ------------------------------------------------------------------ fake --

/**
 * Offline recognizer for tests.
 *
 * It cannot read handwriting -- it reports the number of strokes it was told
 * about via the image size and returns a fixed confidence. That is enough to
 * prove the pipeline (job claimed, page rendered, transcript stored, block
 * moved to ready, MCP surfaces it) and proves nothing whatsoever about
 * accuracy. Nothing in the suite claims otherwise.
 */
export function fakeRecognizer(text = "handwritten note"): Recognizer {
  const ask: Recognizer["ask"] = async (pages, prompt) => {
    if (pages.length === 0) return JSON.stringify({ text: "", confidence: 1 });
    // Answers whichever question it was asked, in the shape that question
    // expects. A fake that only knew about transcripts would make the
    // structural pipeline untestable without a model. ADR-066.
    if (prompt.includes(STRUCTURE_MARKER)) {
      return JSON.stringify({
        shapes: [{ kind: "rectangle", bounds: { x: 0, y: 0, w: 100, h: 60 }, label: text }],
        confidence: 0.8,
      });
    }
    return JSON.stringify({ text, confidence: 0.82 });
  };
  return { model: "fake-recognizer-v1", ask, read: readWith(ask) };
}
