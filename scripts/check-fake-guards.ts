/**
 * The six fake-provider guards must behave IDENTICALLY. ADR-052.
 *
 * Each provider package is a leaf with no dependencies -- deliberately, so
 * nothing in that layer can reach the database or another provider -- which
 * leaves no shared module to hold a safety predicate. Six copies of a rule is
 * how one of them quietly drifts, so this exercises all six rather than
 * trusting that they were edited together.
 *
 * Run from the repo root; imports are relative because a root script belongs to
 * no workspace package and must not pretend otherwise.
 */
import { resolveBilling } from "../packages/billing/src/resolve";
import { resolveEmbedder } from "../packages/embeddings/src/resolve";
import { resolveReasoner } from "../packages/reason/src/resolve";
import { resolveTranscriber } from "../packages/speech/src/resolve";
import { resolveStorage } from "../packages/storage/src/resolve";
import { resolveRecognizer } from "../packages/vision/src/resolve";

type Env = Record<string, string | undefined>;

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
};

/** The AUTH_SECRET is there for the two drivers that sign something. */
const SEAMS = [
  { name: "billing", resolve: resolveBilling, env: { BILLING_PROVIDER: "fake", AUTH_SECRET: "x" } },
  { name: "embeddings", resolve: resolveEmbedder, env: { EMBEDDING_PROVIDER: "fake" } },
  { name: "reason", resolve: resolveReasoner, env: { TRIAGE_PROVIDER: "fake" } },
  { name: "speech", resolve: resolveTranscriber, env: { SPEECH_PROVIDER: "fake" } },
  { name: "storage", resolve: resolveStorage, env: { STORAGE_PROVIDER: "local", AUTH_SECRET: "x" } },
  { name: "vision", resolve: resolveRecognizer, env: { VISION_PROVIDER: "fake" } },
] as const;

/** Whether the driver came back, threw, or declined -- without which is which
 *  being decided by the caller's optimism. */
function attempt(resolve: (e: Env) => unknown, env: Env): "built" | "threw" | "null" {
  try {
    return resolve(env) ? "built" : "null";
  } catch {
    return "threw";
  }
}

console.log("\na fake refuses a real deployment");
for (const seam of SEAMS) {
  const got = attempt(seam.resolve as (e: Env) => unknown, { ...seam.env, NODE_ENV: "production" });
  check(`${seam.name} refuses under NODE_ENV=production`, got === "threw", got);
}

console.log("\n...and CI is the one exemption, so it can test what ships");
for (const seam of SEAMS) {
  const got = attempt(seam.resolve as (e: Env) => unknown, {
    ...seam.env, NODE_ENV: "production", JOTACULAR_FAKE_PROVIDERS_OK: "1",
  });
  check(`${seam.name} builds with JOTACULAR_FAKE_PROVIDERS_OK`, got === "built", got);
}

console.log("\nnothing changed for a developer");
for (const seam of SEAMS) {
  const got = attempt(seam.resolve as (e: Env) => unknown, { ...seam.env, NODE_ENV: "development" });
  check(`${seam.name} builds in development`, got === "built", got);
}

// A value that is not exactly "1" must not open the door. The flag reaching a
// container at all is the thing release.yml prevents; this is the second lock.
console.log("\nthe flag is exact, not truthy");
for (const value of ["0", "true", "yes", ""]) {
  const got = attempt(resolveBilling as (e: Env) => unknown, {
    BILLING_PROVIDER: "fake", AUTH_SECRET: "x",
    NODE_ENV: "production", JOTACULAR_FAKE_PROVIDERS_OK: value,
  });
  check(`billing still refuses when the flag is ${JSON.stringify(value)}`, got === "threw", got);
}

console.log(failures === 0
  ? "\nfake-guard check: all checks passed"
  : `\nfake-guard check: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
