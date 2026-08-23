import { fakeEmbedder, openAiEmbedder, type Embedder } from "./provider";

/**
 * Pick an embedder from the environment, once per process.
 *
 * Returns null when nothing is configured. That is a deliberate,
 * *non-fatal* outcome: semantic search degrades to lexical plus trigram, which
 * still works, and capture keeps working regardless. Search is allowed to get
 * worse when a provider is missing. Nothing is allowed to stop accepting notes
 * because of it (ADR-007).
 */
/**
 * Cosine distance beyond which a neighbour is not worth returning.
 *
 * 0.65 is a starting point for OpenAI's text-embedding-3 family, where
 * unrelated English text usually lands between 0.75 and 0.95 and related text
 * below 0.6. It is a dial, not a law: raise it if search feels forgetful,
 * lower it if it feels like it is free-associating. Whatever you pick, pick it
 * by looking at real distances from your own notes -- see the numbers in
 * fakeEmbedder() for how that measurement is done.
 */
function maxDistance(env: NodeJS.ProcessEnv): number {
  const raw = env.EMBEDDING_MAX_DISTANCE;
  if (!raw) return 0.65;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 2) {
    throw new Error(`EMBEDDING_MAX_DISTANCE must be a number in (0, 2], got ${raw}`);
  }
  return parsed;
}

export function resolveEmbedder(env = process.env): Embedder | null {
  const provider = env.EMBEDDING_PROVIDER?.trim().toLowerCase();

  if (provider === "fake") {
    // ADR-052. The CI flag is the ONLY exemption, and release.yml cannot
    // forward it: the container env is built solely from vault entries on
    // its allow-lists, and this name is deliberately absent from both.
    if (env.NODE_ENV === "production" && env.JOTACULAR_FAKE_PROVIDERS_OK !== "1") {
      // Loud, not silent. A production deployment running the hash embedder
      // would return confident nonsense from search forever, and nothing about
      // its behaviour would look broken.
      throw new Error(
        "EMBEDDING_PROVIDER=fake is a test double and must never run in production",
      );
    }
    return fakeEmbedder();
  }

  if (provider === "azure") {
    const endpoint = env.AZURE_OPENAI_ENDPOINT;
    const key = env.AZURE_OPENAI_API_KEY;
    const deployment = env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT;
    const version = env.AZURE_OPENAI_API_VERSION ?? "2024-10-21";
    if (!endpoint || !key || !deployment) {
      throw new Error(
        "EMBEDDING_PROVIDER=azure needs AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY " +
          "and AZURE_OPENAI_EMBEDDING_DEPLOYMENT",
      );
    }
    return openAiEmbedder({
      endpoint:
        `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}` +
        `/embeddings?api-version=${version}`,
      apiKey: key,
      model: env.EMBEDDING_MODEL ?? deployment,
      azure: true,
      maxDistance: maxDistance(env),
    });
  }

  if (provider === "openai") {
    const key = env.OPENAI_API_KEY;
    if (!key) throw new Error("EMBEDDING_PROVIDER=openai needs OPENAI_API_KEY");
    return openAiEmbedder({
      endpoint: env.OPENAI_BASE_URL
        ? `${env.OPENAI_BASE_URL.replace(/\/$/, "")}/embeddings`
        : "https://api.openai.com/v1/embeddings",
      apiKey: key,
      // 1536 is text-embedding-3-small's native size, which is why the column
      // is vector(1536). -3-large works too via the `dimensions` parameter.
      model: env.EMBEDDING_MODEL ?? "text-embedding-3-small",
      azure: false,
      maxDistance: maxDistance(env),
    });
  }

  if (provider) throw new Error(`Unknown EMBEDDING_PROVIDER: ${provider}`);
  return null;
}

let cached: Embedder | null | undefined;

/** Memoised so config errors surface once, at first use, not per request. */
export function embedder(): Embedder | null {
  if (cached === undefined) cached = resolveEmbedder();
  return cached;
}
