import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { currentDraft } from "@/lib/draft";
import { asUser, type Actor, type AnonSession } from "@jotdojo/domain";

/** The signed-in actor, or a redirect to sign-in. */
export async function requireActor(): Promise<Actor> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  return asUser(session.user.id);
}

export async function currentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export type Capture = { actor: Actor; draft: AnonSession | null };

/**
 * The actor for a CAPTURE path -- writing a note, drawing a stroke.
 *
 * Signed in if there is a session, otherwise the anonymous draft the visitor is
 * holding. That is what lets the marketing hero reach Postgres before there is
 * an account, without a second copy of the note and ink code.
 *
 * Deliberately NOT used by the account page, capture tokens or OAuth consent. A
 * draft is somewhere to write, not an identity, and the shadow user behind it
 * must never be offered anything that looks like one. ADR-039.
 */
export async function captureActor(): Promise<Capture> {
  const session = await auth();
  if (session?.user?.id) return { actor: asUser(session.user.id), draft: null };

  const draft = await currentDraft();
  if (draft) return { actor: draft.actor, draft };

  redirect("/signin");
}
