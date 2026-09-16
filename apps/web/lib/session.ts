import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { currentDraft } from "@/lib/draft";
import { PATH_HEADER } from "@/lib/here";
import { actorExists, asUser, type Actor, type AnonSession } from "@jotacular/domain";

/**
 * The signed-in actor, or a redirect to sign-in.
 *
 * Both halves of "signed in" are checked here, because a signed cookie only
 * proves the first: that somebody once signed in, and that we minted the token.
 * It says nothing about whether the user it names is still there. ADR-105.
 */
export async function requireActor(): Promise<Actor> {
  const session = await auth();
  if (!session?.user?.id) redirect(await signInUrl());

  const actor = asUser(session.user.id);
  if (!(await actorExists(actor))) redirect(await signInUrl({ stale: true }));
  return actor;
}

/**
 * Sign in, and come back HERE. Issue 025.
 *
 * `/` is left off deliberately: it is where sign-in lands anyway, and carrying
 * it would put a `?next=%2F` on the address of everybody who simply opened the
 * app. `safeNext` on the sign-in page is what stops this being a redirector.
 */
async function signInUrl(opts: { stale?: boolean } = {}): Promise<string> {
  const here = (await headers()).get(PATH_HEADER);
  const query = new URLSearchParams();
  if (here && here !== "/") query.set("next", here);
  if (opts.stale) query.set("stale", "1");
  const q = query.toString();
  return q ? `/signin?${q}` : "/signin";
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
  if (session?.user?.id) {
    // A session whose user is gone is not an identity. Fall through to the
    // draft rather than refusing: this path is somebody trying to write.
    const actor = asUser(session.user.id);
    if (await actorExists(actor)) return { actor, draft: null };
  }

  const draft = await currentDraft();
  if (draft) return { actor: draft.actor, draft };

  redirect(await signInUrl());
}
