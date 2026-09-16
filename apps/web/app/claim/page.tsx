import { redirect } from "next/navigation";
import { asUser, claimAnonSession, listNotes } from "@jotacular/domain";
import { auth } from "@/auth";

/**
 * The handoff from the apex. ADR-039, ADR-040.
 *
 * The marketing hero sends the draft token here; this claims the space for
 * whoever is signed in and drops them on what they actually wrote. Landing on
 * `/` instead would show their default space and read as though the draft had
 * been lost.
 */

/**
 * A PAGE, not a route handler, and that is the whole point. Issue 006.
 *
 * Sign-in happens in a server action, and a server action's redirect is
 * re-fetched by the client router as an RSC navigation. A route handler cannot
 * answer one, so the router threw and the error boundary told a person whose
 * note had just been saved that something went wrong.
 */
export const dynamic = "force-dynamic";

export default async function Claim(
  { searchParams }: { searchParams: Promise<{ t?: string }> },
) {
  const token = (await searchParams).t ?? "";

  const session = await auth();
  if (!session?.user?.id) {
    const back = `/claim?t=${encodeURIComponent(token)}`;
    redirect(`/signin?next=${encodeURIComponent(back)}`);
  }

  // Never inside the try: redirect() works by throwing, and catching it here
  // would swallow the navigation and render a blank page instead.
  redirect(await landing(asUser(session.user.id), token));
}

/** Where the claim leaves them. Their own note if there is one, else the canvas. */
async function landing(actor: ReturnType<typeof asUser>, token: string): Promise<string> {
  try {
    const spaceId = await claimAnonSession(actor, token);
    const recent = await listNotes(actor, spaceId, 1);
    return recent[0] ? `/n/${recent[0].id}` : "/";
  } catch {
    // Spent, swept, or never issued. The app is still where they meant to go,
    // and an error page here would be the worst possible first screen.
    return "/";
  }
}
