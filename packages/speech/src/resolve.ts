import { whisperTranscriber, fakeTranscriber, type Transcriber } from "./provider";

/**
 * Pick a transcriber from the environment.
 *
 * Null is not fatal. Audio still records, still uploads and is still kept --
 * only the transcript is missing, and because the ORIGINAL is retained
 * indefinitely (docs/04) every recording ever made becomes searchable the day a
 * provider is configured. Same argument as keeping ink as vectors.
 */
export function resolveTranscriber(env = process.env): Transcriber | null {
  const provider = env.SPEECH_PROVIDER?.trim().toLowerCase();

  if (provider === "fake") {
    if (env.NODE_ENV === "production") {
      throw new Error(
        "SPEECH_PROVIDER=fake is a test double and must never run in production",
      );
    }
    return fakeTranscriber(env.SPEECH_FAKE_TEXT);
  }

  if (provider === "azure") {
    const endpoint = env.AZURE_OPENAI_ENDPOINT;
    const key = env.AZURE_OPENAI_API_KEY;
    const deployment = env.AZURE_OPENAI_SPEECH_DEPLOYMENT;
    const version = env.AZURE_OPENAI_API_VERSION ?? "2024-10-21";
    if (!endpoint || !key || !deployment) {
      throw new Error(
        "SPEECH_PROVIDER=azure needs AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY "
        + "and AZURE_OPENAI_SPEECH_DEPLOYMENT",
      );
    }
    return whisperTranscriber({
      endpoint: `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}`
        + `/audio/transcriptions?api-version=${version}`,
      apiKey: key,
      model: env.SPEECH_MODEL ?? deployment,
      azure: true,
    });
  }

  if (provider === "openai") {
    const key = env.OPENAI_API_KEY;
    if (!key) throw new Error("SPEECH_PROVIDER=openai needs OPENAI_API_KEY");
    return whisperTranscriber({
      endpoint: env.OPENAI_BASE_URL
        ? `${env.OPENAI_BASE_URL.replace(/\/$/, "")}/audio/transcriptions`
        : "https://api.openai.com/v1/audio/transcriptions",
      apiKey: key,
      model: env.SPEECH_MODEL ?? "whisper-1",
      azure: false,
    });
  }

  if (provider) throw new Error(`Unknown SPEECH_PROVIDER: ${provider}`);
  return null;
}

let cached: Transcriber | null | undefined;

export function transcriber(): Transcriber | null {
  if (cached === undefined) cached = resolveTranscriber();
  return cached;
}
