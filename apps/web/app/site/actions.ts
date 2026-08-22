"use server";

import { redirect } from "next/navigation";
import { createNote, listNotes, getNote, hasInk, type Actor } from "@jotdojo/domain";
import { currentDraft, ensureDraft } from "@/lib/draft";
import { appOrigin } from "@/lib/hosts";

export type Draft = { noteId: string; body: string; revision: number; hasInk: boolean };

/**
 * Mint the draft on the first keystroke. docs/16-web-presence.md.
 *
 * Called from the hero, not from the page render: a crawler and a passer-by
 * must not each leave a row behind, and a server component cannot set the
 * cookie this needs anyway.
 */
export async function startDraftAction(): Promise<Draft> {
  const session = await ensureDraft();
  return open(session.actor, session.spaceId);
}

/** The draft a visitor is already holding, or null. Read-only. */
export async function resumeDraftAction(): Promise<Draft | null> {
  const session = await currentDraft();
  if (!session) return null;
  return open(session.actor, session.spaceId);
}

async function open(actor: Actor, spaceId: string): Promise<Draft> {
  const recent = await listNotes(actor, spaceId, 1);
  const note = recent[0]
    ? await getNote(actor, recent[0].id)
    : await createNote(actor, spaceId, "");
  return {
    noteId: note.id, body: note.body, revision: note.revision, hasInk: hasInk(note),
  };
}

/**
 * Hand the draft to the app.
 *
 * The token travels in the URL because the cookie is host-only, which is the
 * same reason docs/16 gives for the localStorage version. The cookie is left
 * alone afterwards: once the draft is claimed the token stops resolving, and
 * the next visit to the apex reads as a fresh start on its own.
 */
export async function keepDraftAction(): Promise<void> {
  const session = await currentDraft();
  redirect(session
    ? `${appOrigin()}/claim?t=${encodeURIComponent(session.token)}`
    : appOrigin());
}
