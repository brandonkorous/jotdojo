import Link from "next/link";
import { agentMayWrite } from "@jotacular/domain";
import { AccountPreferences } from "@/components/AccountPreferences";
import { AccountReach } from "@/components/AccountReach";
import { TriageSwitch } from "@/components/TriageSwitch";
import { PlanSection } from "@/components/PlanSection";
import { SpacePeople } from "@/components/SpacePeople";
import { NewSpace } from "@/components/NewSpace";
import { accountView } from "@/lib/account-view";
import { requireActor, currentUser } from "@/lib/session";
import { signOut } from "@/auth";

export const dynamic = "force-dynamic";

export default async function Account() {
  const actor = await requireActor();
  const user = await currentUser();
  const {
    side, tokens, spaces, connections, triage, plans, people, payer,
  } = await accountView(actor);

  return (
    <main className="mx-auto max-w-xl px-5 py-10">
      <header className="mb-8 flex items-baseline gap-4">
        <h1 className="font-head text-3xl">Account</h1>
        <Link href="/" className="btn btn-ghost btn-sm ml-auto">Back to the canvas</Link>
      </header>

      <p className="mb-8 break-words opacity-70">{user?.email}</p>

      <AccountPreferences side={side} />

      <div className="mb-10">
        <PlanSection plans={plans} payer={payer} />
      </div>

      <section className="mb-10">
        <h2 className="font-head text-xl">Who is in your spaces</h2>
        <p className="mb-3 mt-1 text-sm jd-quiet">
          A space is what you share. Invite somebody and you get a link to send
          them — it lasts a fortnight and only works for the address you typed.
        </p>
        {people.map((sp) => <SpacePeople key={sp.spaceId} {...sp} />)}
        {/* What the next one costs, said before it is made. Issue 051. */}
        <NewSpace covered={payer && { name: payer.name, plan: payer.plan }} />
      </section>

      <div className="mb-10">
        <TriageSwitch settings={triage} />
      </div>

      <AccountReach
        mayWrite={plans.some((p) => agentMayWrite(p.plan))}
        connections={connections}
        tokens={tokens}
        spaces={spaces}
      />

      <SignOut />
    </main>
  );
}

/** Its own component so the page's one function stays inside the 50-line rule
 *  -- an inline server action is eight lines of ceremony round one call. */
function SignOut() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/signin" });
      }}
    >
      <button type="submit" className="btn btn-ghost btn-sm">Sign out</button>
    </form>
  );
}
