/**
 * The MCP server, exercised with a real MCP client over real HTTP, holding a
 * real OAuth token.
 *
 * The domain suite proves the logic and the HTTP suite proves the OAuth wiring.
 * This proves the thing a user actually experiences: Claude connects, sees the
 * tools, and can only do what it was granted.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createHash, randomBytes } from "node:crypto";
import {
  upsertUserFromGoogle, asUser, createNote, defaultSpaceId,
  applyBillingEvent,
  registerClient, issueAuthCode, exchangeAuthCode,
} from "@jotdojo/domain";

const MCP_URL = process.env.MCP_RESOURCE ?? "http://localhost:3402/mcp";
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
};

const text = (result: unknown) => {
  const content = (result as { content?: Array<{ text?: string }> }).content ?? [];
  return content.map((c) => c.text ?? "").join("\n");
};

// --- set up a user with a note, and a granted token ----------------------

const stamp = Date.now();
const u = await upsertUserFromGoogle({
  googleSub: `mcp-${stamp}`, email: `mcp-${stamp}@example.test`, displayName: "M",
});
const A = asUser(u.id);
const space = await defaultSpaceId(A);
const note = await createNote(A, space, "Napkin idea\n\nBundle onboarding with the subscription. Ask Dana about margins.");

const verifier = randomBytes(32).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");
const client = await registerClient({ client_name: "Claude (smoke)", redirect_uris: [REDIRECT] });

const grant = async (scopes: string[]) => {
  const code = await issueAuthCode({
    actor: A, clientId: client.client_id, redirectUri: REDIRECT, codeChallenge: challenge,
    scopes: scopes as never, spaceIds: [space], resource: MCP_URL,
  });
  const tokens = await exchangeAuthCode({
    code, codeVerifier: verifier, clientId: client.client_id,
    redirectUri: REDIRECT, resource: MCP_URL,
  });
  return tokens.access_token;
};

const connect = async (token: string) => {
  const c = new Client({ name: "smoke", version: "1.0.0" });
  await c.connect(new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: { headers: { authorization: `Bearer ${token}` } },
  }));
  return c;
};

// --- discovery -----------------------------------------------------------

const prm = await fetch(MCP_URL.replace(/\/mcp$/, "") + "/.well-known/oauth-protected-resource");
check("RFC 9728 protected resource metadata is served", prm.ok, String(prm.status));
const prmDoc = await prm.json() as { resource?: string; authorization_servers?: string[] };
check("metadata names this resource", prmDoc.resource === MCP_URL);
check("metadata points at the authorization server",
  Array.isArray(prmDoc.authorization_servers) && prmDoc.authorization_servers.length === 1);

const noAuth = await fetch(MCP_URL, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
check("an unauthenticated request is 401", noAuth.status === 401);
check("...and the 401 points at the metadata (how a client discovers where to authorize)",
  (noAuth.headers.get("www-authenticate") ?? "").includes("resource_metadata="));

const wrongAudience = await fetch(MCP_URL, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: "Bearer nonsense" },
  body: "{}",
});
check("a token this server did not issue is 401", wrongAudience.status === 401);

// --- the granted connection ---------------------------------------------

const readClient = await connect(await grant(["notes:read", "notes:comment"]));

const tools = (await readClient.listTools()).tools;
check(`exposes a small tool surface (${tools.length} tools, budget is under 12)`, tools.length < 12, String(tools.length));
// ADR-016. Every name carries a jotdojo noun, and none collides with a tool
// kanninja already owns -- an agent doing our flow holds both servers at once.
const KANNINJA_TOOLS = [
  "list_boards", "get_board", "list_tasks", "get_task", "get_my_work", "search",
  "list_comments", "list_checklist", "list_labels", "create_task", "update_task",
  "move_task", "add_comment", "assign_task", "set_due_date",
];
check("every tool name carries a jotdojo noun",
  tools.every((t) => /(note|space)/.test(t.name)),
  tools.filter((t) => !/(note|space)/.test(t.name)).map((t) => t.name).join(", "));
check("NO tool name collides with one kanninja already owns",
  tools.every((t) => !KANNINJA_TOOLS.includes(t.name)),
  tools.filter((t) => KANNINJA_TOOLS.includes(t.name)).map((t) => t.name).join(", "));

const found = text(await readClient.callTool({ name: "search_notes", arguments: { query: "onboarding" } }));
check("search_notes finds the note by meaning", found.includes("Napkin idea"), found.slice(0, 80));

const got = text(await readClient.callTool({ name: "get_note", arguments: { note_id: note.id } }));
check("get_note returns the body", got.includes("Ask Dana about margins"));
check("get_note states provenance (revision and id)", got.includes("revision") && got.includes(note.id));

const spaces = text(await readClient.callTool({ name: "list_spaces", arguments: {} }));
check("list_spaces returns the granted space", spaces.includes(space));

// --- free reads, paid writes. ADR-042 ------------------------------------
//
// The fence the whole pricing model rests on. It is checked at USE time, so it
// has to be exercised here rather than at the consent screen.
const onFree = await readClient.callTool({
  name: "comment_on_note", arguments: { note_id: note.id, body: "while unpaid" },
});
check("an agent write is REFUSED while the space is on the free plan", onFree.isError === true);
check("...and the refusal says why", text(onFree).includes("free plan"), text(onFree).slice(0, 80));

await applyBillingEvent({
  kind: "subscription",
  spaceId: space,
  subscription: {
    customerId: "cus_mcp_smoke", subscriptionId: "sub_mcp_smoke",
    plan: "solo", status: "active",
    currentPeriodEnd: new Date(Date.now() + 30 * 864e5),
  },
}, "smoke");


const commented = text(await readClient.callTool({
  name: "comment_on_note", arguments: { note_id: note.id, body: "Three tasks in here." },
}));
check("comment_on_note succeeds with the comment scope", commented.includes("Comment added"));

const comments = text(await readClient.callTool({ name: "list_note_comments", arguments: { note_id: note.id } }));
check("the comment is attributed to an agent, by name", comments.includes("agent") && comments.includes("Claude (smoke)"));

// --- what it was NOT granted ---------------------------------------------

const refusedEdit = await readClient.callTool({
  name: "update_note", arguments: { note_id: note.id, text: "overwritten", expected_revision: 1 },
});
check("update_note is REFUSED without the edit scope", refusedEdit.isError === true);

const refusedAppend = await readClient.callTool({
  name: "append_to_note", arguments: { note_id: note.id, text: "sneaky" },
});
check("append_to_note is REFUSED without the append scope", refusedAppend.isError === true);

const stillIntact = text(await readClient.callTool({ name: "get_note", arguments: { note_id: note.id } }));
check("the note is untouched after both refusals", stillIntact.includes("Ask Dana about margins") && !stillIntact.includes("overwritten"));

// --- a connection that WAS granted more ----------------------------------

const writeClient = await connect(await grant(["notes:read", "notes:comment", "notes:append"]));
const appended = text(await writeClient.callTool({
  name: "append_to_note", arguments: { note_id: note.id, text: "Follow up Thursday." },
}));
check("append_to_note succeeds WITH the append scope", appended.includes("Appended"));

const after = text(await writeClient.callTool({ name: "get_note", arguments: { note_id: note.id } }));
check("append is non-destructive - the original text survives",
  after.includes("Ask Dana about margins") && after.includes("Follow up Thursday."));

await readClient.close();
await writeClient.close();

console.log(failures === 0 ? "\nmcp smoke: all checks passed" : `\nmcp smoke: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
