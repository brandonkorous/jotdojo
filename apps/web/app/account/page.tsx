import Link from "next/link";
import {
  getToolbarSide, listCaptureTokens, listConnections, listSpaces,
  listTriageSettings,
} from "@jotacular/domain";
import { CaptureTokens } from "@/components/CaptureTokens";
import { TriageSwitch } from "@/components/TriageSwitch";
import { PlanSection } from "@/components/PlanSection";
import { ownedPlans } from "@/lib/plans-view";
import { Connections } from "@/components/Connections";
import { ConnectToClaude } from "@/components/ConnectToClaude";
import { ExportSection } from "@/components/ExportSection";
import { requireActor, currentUser } from "@/lib/session";
import { setToolbarSideAction } from "@/app/actions";
import { signOut } from "@/auth";

export const dynamic = "force-dynamic";

export default async function Account() {
  const actor = await requireActor();
  const user = await currentUser();
  const [side, tokens, spaces, connections, triage, plans] = await Promise.all([
    getToolbarSide(actor),
    listCaptureTokens(actor),
    listSpaces(actor),
    listConnections(actor),
    listTriageSettings(actor),
    ownedPlans(actor),
  ]);
  const apiUrl = process.env.API_URL ?? "http://localhost:3401";
  const mcpUrl = process.env.MCP_RESOURCE ?? "http://localhost:3402/mcp";

  return (
    <main className="mx-auto max-w-xl px-5 py-10">
      <header className="mb-8 flex items-baseline gap-4">
        <h1 className="font-head text-3xl">Account</h1>
        <Link href="/" className="btn btn-ghost btn-sm ml-auto">Back to the canvas</Link>
      </header>

      <p className="mb-8 opacity-70">{user?.email}</p>

      <section className="mb-10">
        <h2 className="font-head text-xl">Toolbar position</h2>
        <p className="mb-3 mt-1 text-sm opacity-60">
          Where the chrome sits along the top of the canvas. Auto centres it.
          Pick a side if you write with a pencil and want it clear of your hand.
        </p>
        <div className="flex gap-2">
          {(["auto", "left", "right"] as const).map((option) => (
            <form key={option} action={setToolbarSideAction.bind(null, option)}>
              <button
                type="submit"
                className={`btn btn-sm ${side === option ? "btn-primary" : "btn-ghost"}`}
              >
                {option[0]!.toUpperCase() + option.slice(1)}
              </button>
            </form>
          ))}
        </div>
      </section>

      <div className="mb-10">
        <PlanSection plans={plans} />
      </div>

      <div className="mb-10">
        <TriageSwitch settings={triage} />
      </div>

      <div className="mb-10">
        <ConnectToClaude mcpUrl={mcpUrl} />
      </div>

      <div className="mb-10">
        <Connections connections={connections} />
      </div>

      <div className="mb-10">
        <CaptureTokens tokens={tokens} spaces={spaces} apiUrl={apiUrl} />
      </div>

      <div className="mb-10">
        <ExportSection spaces={spaces} />
      </div>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/signin" });
        }}
      >
        <button type="submit" className="btn btn-ghost btn-sm">Sign out</button>
      </form>
    </main>
  );
}
