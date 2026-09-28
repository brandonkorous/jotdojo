import {
  getToolbarSide, listCaptureTokens, listConnections, listSpaces,
  listTriageSettings, type Actor,
} from "@jotacular/domain";
import { ownedPlans, payingSpace } from "./plans-view";
import { peopleBySpace } from "./people-view";

/**
 * Everything the account page shows, fetched once. Beside `plans-view.ts` and
 * `people-view.ts`, which it calls, and for the same reason they exist: the
 * page stays a view.
 *
 * Split out when ADR-119 edited the page and its one function was 93 lines
 * against a limit of 50. Seven awaits and the one thing derived from them is a
 * different job from laying out ten sections.
 */
export async function accountView(actor: Actor) {
  const [side, tokens, spaces, connections, triage, plans, people] = await Promise.all([
    getToolbarSide(actor),
    listCaptureTokens(actor),
    listSpaces(actor),
    listConnections(actor),
    listTriageSettings(actor),
    ownedPlans(actor),
    peopleBySpace(actor),
  ]);
  // Which space is paying, if any. The plan rows and the "make a shared space"
  // control both need it, and neither may guess. ADR-119.
  return { side, tokens, spaces, connections, triage, plans, people, payer: payingSpace(plans) };
}
