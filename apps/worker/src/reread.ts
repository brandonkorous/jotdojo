import { countStale, requeueRecognition, type ReadKind } from "@jotdojo/domain";
import { resolveRecognizer } from "@jotdojo/vision";
import { resolveTranscriber } from "@jotdojo/speech";
import { sourceFor } from "./sources";

/**
 * Read old content again with the model configured now. M5, ADR-046.
 *
 * A COMMAND, not a background behaviour, and it reports before it spends. A
 * worker that noticed a changed VISION_MODEL on boot and re-read the corpus
 * would bill per page for a decision nobody made -- so this runs when somebody
 * runs it, and prints what it would do unless told to go ahead.
 *
 *     pnpm reread                          what is stale, and nothing else
 *     pnpm reread --apply                  queue it
 *     pnpm reread --apply --limit 50
 *     pnpm reread --space <uuid>           one space, which is what support wants
 */

export type RereadPlan = { kind: ReadKind; source: string; stale: number };

/** null means every space. A scoped pass costs one customer's pages; an
 *  unscoped one costs everybody's, and from a command line at 11pm the two look
 *  identical until the bill arrives. */
export type Scope = string | null;

/** Only the kinds a configured provider could actually re-read. With no vision
 *  provider there is no newer model to re-read ink WITH, and saying "1,200
 *  stale" would be an offer we cannot keep. */
export function plannedKinds(models: { vision?: string; speech?: string }): ReadKind[] {
  const kinds: ReadKind[] = [];
  if (models.vision) kinds.push("ink", "image");
  if (models.speech) kinds.push("audio");
  return kinds;
}

export async function surveyReread(
  models: { vision?: string; speech?: string }, space: Scope = null,
): Promise<RereadPlan[]> {
  return Promise.all(plannedKinds(models).map(async (kind) => {
    const source = sourceFor(kind, models);
    return { kind, source, stale: await countStale(kind, source, 100_000, space) };
  }));
}

export async function applyReread(
  plans: RereadPlan[], limit: number, space: Scope = null,
): Promise<number> {
  let queued = 0;
  for (const plan of plans) {
    if (plan.stale === 0) continue;
    // The budget is spent across kinds in order, so a run bounded at 50 queues
    // 50 pages total rather than 50 of each.
    const room = limit - queued;
    if (room <= 0) break;
    queued += await requeueRecognition(plan.kind, plan.source, room, space);
  }
  return queued;
}

const flag = (name: string) => process.argv.includes(`--${name}`);

const text = (name: string): string | null => {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? null : process.argv[at + 1] ?? null;
};

const number = (name: string, fallback: number) => {
  const at = process.argv.indexOf(`--${name}`);
  const raw = at === -1 ? null : process.argv[at + 1];
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

export async function main(): Promise<void> {
  const models = {
    vision: resolveRecognizer()?.model,
    speech: resolveTranscriber()?.model,
  };

  if (plannedKinds(models).length === 0) {
    console.log("No vision or speech provider is configured, so nothing can be re-read.");
    return;
  }

  const space = text("space");
  if (space) console.log(`Scoped to space ${space}.`);
  const plans = await surveyReread(models, space);
  for (const plan of plans) {
    console.log(`  ${plan.kind.padEnd(6)} ${String(plan.stale).padStart(7)} stale   (now: ${plan.source})`);
  }

  const total = plans.reduce((sum, p) => sum + p.stale, 0);
  if (total === 0) {
    console.log("\nEverything has been read by the current models.");
    return;
  }

  if (!flag("apply")) {
    console.log(`\n${total} block(s) would be re-read, and each one costs money.`);
    console.log("Nothing has been queued. Re-run with --apply to go ahead.");
    return;
  }

  const limit = number("limit", 500);
  const queued = await applyReread(plans, limit, space);
  console.log(`\nQueued ${queued} of ${total}. A space over its allowance still waits (ADR-036).`);
  if (queued < total) console.log(`Run it again for the next ${Math.min(limit, total - queued)}.`);
}
