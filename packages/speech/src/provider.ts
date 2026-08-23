/**
 * The only place in jotacular that sends audio to a model.
 *
 * In-app recording is for long form -- a meeting, a rant in the car. Short
 * voice capture should go through Shortcuts dictation instead, which is faster
 * for the person and free for us (docs/02). This seam exists for the recordings
 * that are too long for that.
 *
 * Word-level timestamps are kept whenever a provider gives them, because
 * playback sync needs them later and re-transcribing an hour of audio to get
 * them back would cost real money. docs/07.
 */

export type Word = { word: string; start: number; end: number };

export type Transcription = {
  text: string;
  /** 0..1. Derived from the provider's own signal where there is one. */
  confidence: number;
  words?: Word[];
  language?: string;
};

export type Transcriber = {
  readonly model: string;
  transcribe(audio: Uint8Array<ArrayBuffer>, mimeType: string): Promise<Transcription>;
};

export class TranscriptionError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = "TranscriptionError";
  }
}

const FILENAMES: Record<string, string> = {
  "audio/webm": "audio.webm", "audio/mp4": "audio.m4a", "audio/mpeg": "audio.mp3",
  "audio/wav": "audio.wav", "audio/ogg": "audio.ogg",
};

/**
 * Whisper reports `avg_logprob` per segment, not a confidence.
 *
 * Mapping it is a judgement call, so it is written down rather than buried: it
 * is a mean log-probability per token, typically about -0.1 for clean speech
 * and below -0.8 for something the model was guessing at. exp() maps that to
 * (0, 1] with roughly the right shape, and the value is displayed to people and
 * sent over MCP, so it has to mean something rather than being decorative.
 */
export function confidenceFromLogprob(segments: Array<{ avg_logprob?: number }>): number {
  const values = segments.map((s) => s.avg_logprob).filter((v): v is number => Number.isFinite(v));
  if (values.length === 0) return 0.5;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.min(1, Math.max(0, Math.exp(mean)));
}

// ------------------------------------------------------------ whisper-ish --

/**
 * OpenAI and Azure OpenAI both expose Whisper at the same multipart endpoint
 * and differ only in URL shape and auth header.
 *
 * `verbose_json` with word granularity, because the default response throws the
 * timestamps away and getting them back means paying to transcribe the audio a
 * second time.
 */
export function whisperTranscriber(config: {
  endpoint: string; apiKey: string; model: string; azure: boolean;
}): Transcriber {
  return {
    model: config.model,
    async transcribe(audio, mimeType) {
      const type = mimeType.split(";")[0]!.trim().toLowerCase();
      const form = new FormData();
      // Uint8Array<ArrayBuffer>, not the default Uint8Array<ArrayBufferLike>:
      // BlobPart excludes SharedArrayBuffer-backed views, and a plain
      // Uint8Array is not provably one or the other to the type checker.
      form.append("file", new Blob([audio], { type }), FILENAMES[type] ?? "audio.bin");
      if (!config.azure) form.append("model", config.model);
      form.append("response_format", "verbose_json");
      form.append("timestamp_granularities[]", "word");
      form.append("timestamp_granularities[]", "segment");

      const res = await fetch(config.endpoint, {
        method: "POST",
        headers: config.azure
          ? { "api-key": config.apiKey }
          : { authorization: `Bearer ${config.apiKey}` },
        body: form,
        // Generous: an hour of audio is a real upload and a real inference.
        signal: AbortSignal.timeout(600_000),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new TranscriptionError(
          `speech provider returned ${res.status}: ${body.slice(0, 300)}`,
          res.status === 429 || res.status >= 500,
        );
      }

      const json = await res.json() as {
        text?: string;
        language?: string;
        segments?: Array<{ avg_logprob?: number }>;
        words?: Array<{ word: string; start: number; end: number }>;
      };

      if (typeof json.text !== "string") {
        throw new TranscriptionError("the provider returned no text", false);
      }

      return {
        text: json.text.trim(),
        confidence: confidenceFromLogprob(json.segments ?? []),
        words: json.words?.map((w) => ({ word: w.word, start: w.start, end: w.end })),
        language: json.language,
      };
    },
  };
}

// ------------------------------------------------------------------ fake --

/**
 * Offline transcriber for tests. It cannot hear anything.
 *
 * It proves the pipeline -- job claimed, bytes fetched from storage, transcript
 * stored with word timings, block moved to ready, MCP surfaces it -- and
 * proves nothing at all about accuracy. Nothing in the suite claims otherwise.
 */
export function fakeTranscriber(text = "remember to call the landlord"): Transcriber {
  return {
    model: "fake-transcriber-v1",
    async transcribe(audio) {
      if (audio.byteLength === 0) return { text: "", confidence: 1 };
      const parts = text.split(/\s+/).filter(Boolean);
      return {
        text,
        confidence: 0.79,
        // Evenly spaced, so anything consuming timings has plausible shapes to
        // work with rather than an empty array that hides a bug.
        words: parts.map((word, i) => ({ word, start: i * 0.4, end: i * 0.4 + 0.35 })),
        language: "en",
      };
    },
  };
}
