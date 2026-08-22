import {
  anthropicReasoner, openAiReasoner, fakeReasoner, type Reasoner,
} from "./provider";

/**
 * Pick a reasoner from the environment.
 *
 * Null means the triage agent does not run. Unlike a missing vision provider,
 * nothing is left waiting to be filled in later: a proposal about a note from
 * three weeks ago is not worth reading, so there is no backlog to drain the day
 * a key is added. Triage starts from the moment it is switched on.
 *
 * It is also the first of the four seams that is OFF by default in the example
 * environment, because it is the only one that speaks to people unprompted.
 */
export function resolveReasoner(env = process.env): Reasoner | null {
  const provider = env.TRIAGE_PROVIDER?.trim().toLowerCase();

  if (provider === "fake") {
    // ADR-052. The CI flag is the ONLY exemption, and release.yml cannot
    // forward it: the container env is built solely from vault entries on
    // its allow-lists, and this name is deliberately absent from both.
    if (env.NODE_ENV === "production" && env.JOTDOJO_FAKE_PROVIDERS_OK !== "1") {
      throw new Error(
        "TRIAGE_PROVIDER=fake is a test double and must never run in production",
      );
    }
    return fakeReasoner(env.TRIAGE_FAKE_COMMENT);
  }

  if (provider === "anthropic") {
    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("TRIAGE_PROVIDER=anthropic needs ANTHROPIC_API_KEY");
    return anthropicReasoner({
      apiKey,
      model: env.TRIAGE_MODEL ?? "claude-sonnet-5",
      baseUrl: env.ANTHROPIC_BASE_URL,
    });
  }

  if (provider === "azure") {
    const endpoint = env.AZURE_OPENAI_ENDPOINT;
    const key = env.AZURE_OPENAI_API_KEY;
    const deployment = env.AZURE_OPENAI_TRIAGE_DEPLOYMENT;
    const version = env.AZURE_OPENAI_API_VERSION ?? "2024-10-21";
    if (!endpoint || !key || !deployment) {
      throw new Error(
        "TRIAGE_PROVIDER=azure needs AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY "
        + "and AZURE_OPENAI_TRIAGE_DEPLOYMENT",
      );
    }
    return openAiReasoner({
      endpoint: `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}`
        + `/chat/completions?api-version=${version}`,
      apiKey: key,
      model: env.TRIAGE_MODEL ?? deployment,
      azure: true,
    });
  }

  if (provider === "openai") {
    const key = env.OPENAI_API_KEY;
    if (!key) throw new Error("TRIAGE_PROVIDER=openai needs OPENAI_API_KEY");
    return openAiReasoner({
      endpoint: env.OPENAI_BASE_URL
        ? `${env.OPENAI_BASE_URL.replace(/\/$/, "")}/chat/completions`
        : "https://api.openai.com/v1/chat/completions",
      apiKey: key,
      model: env.TRIAGE_MODEL ?? "gpt-4o-mini",
      azure: false,
    });
  }

  if (provider) throw new Error(`Unknown TRIAGE_PROVIDER: ${provider}`);
  return null;
}

let cached: Reasoner | null | undefined;

export function reasoner(): Reasoner | null {
  if (cached === undefined) cached = resolveReasoner();
  return cached;
}
