import { CaptureTokens } from "./CaptureTokens";
import { Connections } from "./Connections";
import { ConnectToClaude } from "./ConnectToClaude";
import { ExportSection } from "./ExportSection";

/**
 * Everything that can reach your notes from outside the app, and the way out.
 *
 * An agent you connected, the agents already connected, the tokens a phone
 * captures with, and the export that takes it all somewhere else. Four
 * sections and one question: who else is holding a key.
 *
 * Split out of the account page when ADR-119 edited it and its one function
 * was 93 lines against a limit of 50.
 */
export function AccountReach(
  { mayWrite, connections, tokens, spaces }: {
    mayWrite: boolean;
    connections: React.ComponentProps<typeof Connections>["connections"];
    tokens: React.ComponentProps<typeof CaptureTokens>["tokens"];
    spaces: React.ComponentProps<typeof ExportSection>["spaces"];
  },
) {
  const apiUrl = process.env.API_URL ?? "http://localhost:3401";
  const mcpUrl = process.env.MCP_RESOURCE ?? "http://localhost:3402/mcp";

  return (
    <>
      <div className="mb-10">
        <ConnectToClaude mcpUrl={mcpUrl} mayWrite={mayWrite} />
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
    </>
  );
}
