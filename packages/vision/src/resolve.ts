import {
  anthropicRecognizer, openAiRecognizer, fakeRecognizer, type Recognizer,
} from "./provider";

/**
 * Pick a recognizer from the environment.
 *
 * Returns null when nothing is configured, and that is deliberately not fatal:
 * ink still captures, still stores, still renders and still syncs. What stops
 * is the transcript, and the block sits at transcript_state 'pending' until a
 * provider exists — at which point every page ever drawn becomes readable,
 * because the strokes were kept. That is the whole argument for storing vectors
 * rather than rasters (docs/08).
 */
export function resolveRecognizer(env = process.env): Recognizer | null {
  const provider = env.VISION_PROVIDER?.trim().toLowerCase();

  if (provider === "fake") {
    // ADR-052. The CI flag is the ONLY exemption, and release.yml cannot
    // forward it: the container env is built solely from vault entries on
    // its allow-lists, and this name is deliberately absent from both.
    if (env.NODE_ENV === "production" && env.JOTACULAR_FAKE_PROVIDERS_OK !== "1") {
      throw new Error(
        "VISION_PROVIDER=fake is a test double and must never run in production",
      );
    }
    return fakeRecognizer(env.VISION_FAKE_TEXT);
  }

  if (provider === "anthropic") {
    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("VISION_PROVIDER=anthropic needs ANTHROPIC_API_KEY");
    return anthropicRecognizer({
      apiKey,
      model: env.VISION_MODEL ?? "claude-sonnet-5",
      baseUrl: env.ANTHROPIC_BASE_URL,
    });
  }

  if (provider === "azure") {
    const endpoint = env.AZURE_OPENAI_ENDPOINT;
    const key = env.AZURE_OPENAI_API_KEY;
    const deployment = env.AZURE_OPENAI_VISION_DEPLOYMENT;
    const version = env.AZURE_OPENAI_API_VERSION ?? "2024-10-21";
    if (!endpoint || !key || !deployment) {
      throw new Error(
        "VISION_PROVIDER=azure needs AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY "
        + "and AZURE_OPENAI_VISION_DEPLOYMENT",
      );
    }
    return openAiRecognizer({
      endpoint: `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}`
        + `/chat/completions?api-version=${version}`,
      apiKey: key,
      model: env.VISION_MODEL ?? deployment,
      azure: true,
    });
  }

  if (provider === "openai") {
    const key = env.OPENAI_API_KEY;
    if (!key) throw new Error("VISION_PROVIDER=openai needs OPENAI_API_KEY");
    return openAiRecognizer({
      endpoint: env.OPENAI_BASE_URL
        ? `${env.OPENAI_BASE_URL.replace(/\/$/, "")}/chat/completions`
        : "https://api.openai.com/v1/chat/completions",
      apiKey: key,
      model: env.VISION_MODEL ?? "gpt-4o",
      azure: false,
    });
  }

  if (provider) throw new Error(`Unknown VISION_PROVIDER: ${provider}`);
  return null;
}

let cached: Recognizer | null | undefined;

export function recognizer(): Recognizer | null {
  if (cached === undefined) cached = resolveRecognizer();
  return cached;
}
