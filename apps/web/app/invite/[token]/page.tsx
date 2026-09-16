import Link from "next/link";
import { redirect } from "next/navigation";
import { acceptInvite, DomainError } from "@jotacular/domain";
import { requireActor } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * The other end of an invite link. Issue 001.
 *
 * `acceptInvite` had no caller before this page: an owner could mint a token
 * and there was nowhere on earth to spend it.
 */
const WHY: Record<string, string> = {
  invite_unknown: "That link is not one of ours. Ask for a fresh one.",
  invite_revoked: "That invite was taken back. Ask whoever sent it.",
  invite_used: "That invite has already been used. If it was you, you are in already.",
  invite_expired: "That invite ran out. Ask for a fresh one — they last a fortnight.",
  invite_wrong_account:
    "That invite was sent to a different address. Sign in as the one it was sent to.",
  space_full: "That space is full. The invite was fine; somebody took the last seat first.",
};

export default async function AcceptInvite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // requireActor sends a signed-out person to /signin and back here, so the
  // link works whether or not they already had an account.
  const actor = await requireActor();

  let problem: string | null = null;
  try {
    await acceptInvite(actor, token);
  } catch (err) {
    const code = (err as DomainError).code ?? "";
    problem = WHY[code] ?? "That invite could not be used.";
  }
  if (!problem) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-md px-5 py-16 text-center">
      <h1 className="font-head text-2xl">That invite did not work</h1>
      <p className="mt-3 jd-quiet">{problem}</p>
      <Link href="/" className="btn btn-primary btn-sm mt-6">Go to your notes</Link>
    </main>
  );
}
