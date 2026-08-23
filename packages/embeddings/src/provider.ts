/**
 * The only place in jotacular that talks to an embedding provider.
 *
 * Same rule as @jotacular/db and Postgres: one seam, so swapping providers or
 * models is a change in one file, and so nothing else in the codebase has to
 * know an API key exists. Re-embedding after a model change is a worker job,
 * not a migration (docs/04-data-model.md).
 */

/** vector(1536) in 0000_init.sql. Changing this is a migration and a backfill. */
export const EMBEDDING_DIMENSIONS = 1536;

export type Embedder = {
  /** Stored on every row so a model change is detectable without guessing. */
  readonly model: string;
  /**
   * Cosine distance beyond which this model's vectors are not meaningfully
   * related, used as a floor on semantic recall.
   *
   * Without a floor, vector search always returns its k nearest neighbours no
   * matter how far away they are -- so searching for "xylophone hovercraft"
   * returns your entire notebook, ranked. Fusion does not save you: a note
   * recalled by nothing but a distant vector still appears.
   *
   * It belongs on the provider because it is a property of the model's
   * geometry, not of the search code. Every model puts "unrelated" somewhere
   * different, and a single constant in search.ts would be wrong for all but
   * one of them.
   */
  readonly maxDistance: number;
  /** Batched: embedding calls are cheap but chatty (docs/07). */
  embed(texts: readonly string[]): Promise<number[][]>;
};

export class EmbeddingError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = "EmbeddingError";
  }
}

// ------------------------------------------------------------------ fake --

/**
 * A deterministic, offline embedder for tests and local development.
 *
 * It is a hashing bag-of-words projection, not a language model: it has no
 * semantics whatsoever. It exists so the smoke suite can prove the *plumbing*
 * -- outbox drained, vector stored, fusion ranked, tenancy held -- without a
 * network call or an API key, the same way every other suite in this repo runs
 * hermetically.
 *
 * It must never be mistaken for the real thing, so it is only selectable by
 * setting EMBEDDING_PROVIDER=fake explicitly, and `resolveEmbedder` refuses it
 * outright in production.
 */
export function fakeEmbedder(): Embedder {
  return {
    model: "fake-hash-v1",
    // Measured, not guessed. Unrelated strings land at exactly 1.0 because
    // they share no dimensions; a single shared word gives ~0.71. 0.90 sits
    // between those and also excludes the ~0.906 that hash collisions produce
    // between genuinely unrelated short strings.
    maxDistance: 0.9,
    async embed(texts) {
      return texts.map((text) => {
        const v = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
        for (const word of text.toLowerCase().match(/[a-z0-9']+/g) ?? []) {
          // FNV-1a, so the same word always lands in the same dimensions.
          let h = 0x811c9dc5;
          for (let i = 0; i < word.length; i++) {
            h ^= word.charCodeAt(i);
            h = Math.imul(h, 0x01000193) >>> 0;
          }
          v[h % EMBEDDING_DIMENSIONS]! += 1;
          v[(h >>> 8) % EMBEDDING_DIMENSIONS]! += 0.5;
        }
        const norm = Math.hypot(...v) || 1;
        return v.map((x) => x / norm);
      });
    },
  };
}

// -------------------------------------------------------- openai-shaped --

type OpenAiConfig = {
  endpoint: string;
  apiKey: string;
  model: string;
  /** Azure OpenAI authenticates with `api-key`; OpenAI uses `Authorization`. */
  azure: boolean;
  maxDistance: number;
};

/**
 * Works against OpenAI and Azure OpenAI, which speak the same request body and
 * differ only in URL shape and auth header. Azure is the deployment target
 * (docs/03-architecture.md), OpenAI is what most people have a key for.
 */
export function openAiEmbedder(config: OpenAiConfig): Embedder {
  return {
    model: config.model,
    maxDistance: config.maxDistance,
    async embed(texts) {
      if (texts.length === 0) return [];

      const res = await fetch(config.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(config.azure
            ? { "api-key": config.apiKey }
            : { authorization: `Bearer ${config.apiKey}` }),
        },
        body: JSON.stringify({
          input: texts,
          model: config.model,
          dimensions: EMBEDDING_DIMENSIONS,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        // 429 and 5xx are worth another attempt; 400 and 401 are not, and
        // retrying them just burns the queue's backoff budget.
        const retryable = res.status === 429 || res.status >= 500;
        throw new EmbeddingError(
          `embedding provider returned ${res.status}: ${body.slice(0, 300)}`,
          retryable,
        );
      }

      const json = (await res.json()) as { data?: Array<{ embedding: number[]; index: number }> };
      const data = json.data;
      if (!Array.isArray(data) || data.length !== texts.length) {
        throw new EmbeddingError("embedding provider returned an unexpected shape", false);
      }

      // The API documents index order but does not promise it, and a silently
      // transposed batch would attach every vector to the wrong note.
      const out = new Array<number[]>(texts.length);
      for (const row of data) {
        if (row.embedding?.length !== EMBEDDING_DIMENSIONS) {
          throw new EmbeddingError(
            `expected ${EMBEDDING_DIMENSIONS} dimensions, got ${row.embedding?.length}`,
            false,
          );
        }
        out[row.index] = row.embedding;
      }
      if (out.some((r) => !r)) {
        throw new EmbeddingError("embedding provider skipped an input", false);
      }
      return out;
    },
  };
}
