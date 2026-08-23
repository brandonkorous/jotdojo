"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { billing, type PaidPlan } from "@jotacular/billing";
import {
  createNote, saveNote, listNotes, searchNotes, defaultSpaceId, setToolbarSide,
  createCaptureToken, listCaptureTokens, revokeCaptureToken, listSpaces,
  listConnections, revokeConnection, setTriage, listNoteComments, resolveComment,
  ensureInkBlock, appendStrokes, getInk, correctTranscript,
  assertAnonRoom, assertAnonInkRoom, AnonLimit, ANON_MAX_CHARS,
  startCheckout, billingPortal,
  RevisionConflict, type NoteSummary, type CaptureTokenSummary,
} from "@jotacular/domain";
import { requireActor, captureActor } from "@/lib/session";
import { appOrigin } from "@/lib/hosts";

export type SaveResult =
  | { ok: true; revision: number; title: string | null }
  | { ok: false; reason: "conflict"; currentRevision: number }
  | { ok: false; reason: "limit"; message: string }
  | { ok: false; reason: "error"; message: string };

/**
 * Save the canvas.
 *
 * Never throws to the client. The capture contract says a failed save must
 * fail loudly and recoverably -- the caller keeps the text and retries, so a
 * structured result beats an exception here.
 */
export async function saveNoteAction(
  noteId: string, body: string, expectedRevision: number,
): Promise<SaveResult> {
  const { actor, draft } = await captureActor();
  try {
    // A ceiling, not an accounting system: a draft already at the limit is
    // refused, and no single body may exceed the limit on its own. ADR-039.
    if (draft) {
      await assertAnonRoom(draft);
      if (body.length > ANON_MAX_CHARS) {
        throw new AnonLimit("Sign in to keep writing — this draft is full", "anon_char_limit");
      }
    }
    const note = await saveNote(actor, noteId, body, expectedRevision);
    return { ok: true, revision: note.revision, title: note.title };
  } catch (err) {
    if (err instanceof RevisionConflict) {
      return { ok: false, reason: "conflict", currentRevision: err.currentRevision };
    }
    if (err instanceof AnonLimit) {
      return { ok: false, reason: "limit", message: err.message };
    }
    return { ok: false, reason: "error", message: (err as Error).message };
  }
}

export async function createNoteAction(body = ""): Promise<{ id: string; revision: number }> {
  const actor = await requireActor();
  const spaceId = await defaultSpaceId(actor);
  const note = await createNote(actor, spaceId, body);
  revalidatePath("/");
  return { id: note.id, revision: note.revision };
}

export async function listNotesAction(): Promise<NoteSummary[]> {
  const actor = await requireActor();
  return listNotes(actor, await defaultSpaceId(actor));
}

export async function searchNotesAction(query: string): Promise<NoteSummary[]> {
  const actor = await requireActor();
  return searchNotes(actor, await defaultSpaceId(actor), query);
}

export async function setToolbarSideAction(side: "auto" | "left" | "right") {
  const actor = await requireActor();
  await setToolbarSide(actor, side);
  revalidatePath("/");
}

// --- capture tokens (iOS Shortcuts) -------------------------------------
// docs/09-shortcuts.md

export async function createCaptureTokenAction(
  formData: FormData,
): Promise<{ token: string; name: string }> {
  const actor = await requireActor();
  const name = String(formData.get("name") ?? "").trim() || "Shortcut";
  const spaceId = String(formData.get("spaceId") ?? "") || (await defaultSpaceId(actor));
  const { token } = await createCaptureToken(actor, spaceId, name);
  revalidatePath("/account");
  // Returned to the caller once and never stored in plaintext -- the UI must
  // make clear it cannot be shown again.
  return { token, name };
}

export async function listCaptureTokensAction(): Promise<CaptureTokenSummary[]> {
  return listCaptureTokens(await requireActor());
}

export async function revokeCaptureTokenAction(tokenId: string): Promise<void> {
  await revokeCaptureToken(await requireActor(), tokenId);
  revalidatePath("/account");
}

export async function listSpacesAction() {
  return listSpaces(await requireActor());
}

// --- connected agents ----------------------------------------------------
// docs/13-security-and-privacy.md

export async function listConnectionsAction() {
  return listConnections(await requireActor());
}

export async function revokeConnectionAction(clientId: string): Promise<void> {
  await revokeConnection(await requireActor(), clientId);
  revalidatePath("/account");
}

// --- money ----------------------------------------------------------------
// docs/01-audience-and-pricing.md, ADR-038. Owners only, enforced in the
// domain layer -- these two just carry the browser to the provider and back.

export async function startCheckoutAction(spaceId: string, plan: PaidPlan): Promise<never> {
  const { url } = await startCheckout(billing(), await requireActor(), spaceId, plan, {
    // Back to the same page either way. The plan does not change on return --
    // it changes when the WEBHOOK lands, which may be a second later.
    successUrl: `${appOrigin()}/account?bought=${plan}`,
    cancelUrl: `${appOrigin()}/account`,
  });
  redirect(url);
}

export async function billingPortalAction(spaceId: string): Promise<never> {
  const { url } = await billingPortal(
    billing(), await requireActor(), spaceId, `${appOrigin()}/account`,
  );
  redirect(url);
}

// --- the triage agent -----------------------------------------------------
// docs/07-capture-pipeline.md, ADR-048. Owners only, and it is off until
// somebody turns it on.

export async function setTriageAction(spaceId: string, on: boolean): Promise<void> {
  await setTriage(await requireActor(), spaceId, on);
  revalidatePath("/account");
}

export async function listNoteCommentsAction(noteId: string) {
  return listNoteComments(await requireActor(), noteId);
}

export async function resolveCommentAction(commentId: string): Promise<void> {
  await resolveComment(await requireActor(), commentId);
  revalidatePath("/n", "layout");
}

// --- ink ------------------------------------------------------------------
// docs/08-ink.md

export type AppendResult =
  | { ok: true; strokeCount: number; version: number }
  // The client is ahead of the server. It has to resend from `serverCount`,
  // and it can only do that if we say where we actually are.
  | { ok: false; reason: "gap"; serverCount: number }
  | { ok: false; reason: "error"; message: string };

/** The note's ink layer, created on first use. NEVER a second one: that is how
 *  a page of handwriting stops being drawn. ADR-047. */
export async function inkLayerAction(noteId: string, canvas: { w: number; h: number }) {
  const { actor } = await captureActor();
  const block = await ensureInkBlock(actor, noteId, canvas);
  // The version comes back too, because the canvas has to know where the page
  // WAS before it can tell whether a live event is news. ADR-058.
  return {
    blockId: block.blockId, strokeCount: block.strokeCount,
    hasText: block.textCount > 0, version: block.version,
  };
}

/**
 * Never throws to the client.
 *
 * The caller is holding strokes that exist nowhere else yet. An exception here
 * would be caught by a boundary that has no idea it is sitting on the only copy
 * of somebody's handwriting, so the result is structured and the client keeps
 * its queue until it hears otherwise.
 */
export async function appendStrokesAction(
  blockId: string, seq: number, strokes: unknown,
): Promise<AppendResult> {
  try {
    const { actor, draft } = await captureActor();
    if (draft) await assertAnonInkRoom(draft, Array.isArray(strokes) ? strokes.length : 0);
    const { strokeCount, version } = await appendStrokes(actor, blockId, seq, strokes);
    return { ok: true, strokeCount, version };
  } catch (err) {
    const e = err as { code?: string; message: string };
    if (e.code === "stroke_gap") {
      const at = /resend from (\d+)/.exec(e.message);
      return { ok: false, reason: "gap", serverCount: Number(at?.[1] ?? 0) };
    }
    return { ok: false, reason: "error", message: e.message };
  }
}

export async function getInkAction(blockId: string) {
  return getInk((await captureActor()).actor, blockId);
}

export async function correctTranscriptAction(blockId: string, text: string) {
  await correctTranscript(await requireActor(), blockId, text);
  revalidatePath("/");
}
