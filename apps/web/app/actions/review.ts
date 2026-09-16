"use server";

import { revalidatePath } from "next/cache";
import { listAgentChanges, revertRevision, type AgentChange } from "@jotacular/domain";
import { requireActor } from "@/lib/session";

/**
 * The review inbox's two server actions. ADR-004, ADR-037.
 *
 * Split from `actions.ts`, which was already at the size limit, and the seam is
 * a real one: everything there is a person acting on their own notes, and this
 * is a person acting on what somebody else's software did to them.
 *
 * The domain has had both of these since ADR-037 with no caller but a smoke
 * script, which is what issue 029 was: the consent screen promised "nothing an
 * agent does to your notes is permanent" and there was no way to undo anything.
 */

export async function agentChangesAction(): Promise<AgentChange[]> {
  return listAgentChanges(await requireActor(), { limit: 100 });
}

export async function revertAction(revisionId: string): Promise<{ ok: boolean; why?: string }> {
  const actor = await requireActor();
  try {
    const { noteId } = await revertRevision(actor, revisionId);
    revalidatePath("/review");
    revalidatePath(`/n/${noteId}`);
    return { ok: true };
  } catch (err) {
    // Shown to the person, so it says what happened rather than which class
    // was thrown. Reverting twice is the one somebody will actually hit.
    return { ok: false, why: (err as Error).message };
  }
}
