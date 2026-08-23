import { NextResponse, type NextRequest } from "next/server";
import { asUser, claimAnonSession, listNotes } from "@jotacular/domain";
import { auth } from "@/auth";
import { appOrigin } from "@/lib/hosts";

/**
 * The handoff from the apex. ADR-039, ADR-040.
 *
 * The marketing hero sends the draft token here; this claims the space for
 * whoever is signed in and drops them on what they actually wrote. Landing on
 * `/` instead would show their default space and read as though the draft had
 * been lost.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const app = appOrigin();
  const token = req.nextUrl.searchParams.get("t") ?? "";

  const session = await auth();
  if (!session?.user?.id) {
    const back = `/claim?t=${encodeURIComponent(token)}`;
    return NextResponse.redirect(new URL(`/signin?next=${encodeURIComponent(back)}`, app));
  }

  const actor = asUser(session.user.id);
  try {
    const spaceId = await claimAnonSession(actor, token);
    const recent = await listNotes(actor, spaceId, 1);
    return NextResponse.redirect(new URL(recent[0] ? `/n/${recent[0].id}` : "/", app));
  } catch {
    // Spent, swept, or never issued. The app is still where they meant to go,
    // and an error page here would be the worst possible first screen.
    return NextResponse.redirect(new URL("/", app));
  }
}
