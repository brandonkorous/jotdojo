/**
 * The MCP server, exercised with a real MCP client over real HTTP, holding a
 * real OAuth token.
 *
 * The domain suite proves the logic and the HTTP suite proves the OAuth wiring.
 * This proves the thing a user actually experiences: Claude connects, sees the
 * tools, and can only do what it was granted.
 *
 * Standing the agent up is mcp-session.ts. What it is TOLD is here.
 */
import { openSession, text, images, MCP_URL } from "./mcp-session.js";
import { applyBillingEvent } from "@jotdojo/domain";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
};

const { actor: A, space, note, drawn, blank, grant, connect, clientName } = await openSession("mcp");


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

/**
 * What a directory reviewer sees, over the wire. ADR-069.
 *
 * `mcp:tools` checks the declarations; this checks that they survive the SDK
 * and arrive on a real `tools/list` response, which is the thing Anthropic's
 * submission portal actually syncs.
 */
const unannotated = tools.filter((t) => !t.annotations?.title
  || typeof t.annotations?.readOnlyHint !== "boolean");
check("every tool arrives annotated, as both app directories require",
  unannotated.length === 0, unannotated.map((t) => t.name).join(", "));

// ADR-070. Not "refused without a scope" -- absent, so there is nothing to
// grant and nothing to confirm.
const destructive = tools.filter((t) => t.annotations?.destructiveHint === true);
check("NO tool can overwrite what a person wrote",
  destructive.length === 0, destructive.map((t) => t.name).join(", "));
check("...and no edit tool is on the surface at all",
  !tools.some((t) => t.name === "update_note"));

const found = text(await readClient.callTool({ name: "search_notes", arguments: { query: "onboarding" } }));
check("search_notes finds the note by meaning", found.includes("Napkin idea"), found.slice(0, 80));

const got = text(await readClient.callTool({ name: "get_note", arguments: { note_id: note.id } }));
check("get_note returns the body", got.includes("Ask Dana about margins"));
check("get_note states provenance (revision and id)", got.includes("revision") && got.includes(note.id));

const spaces = text(await readClient.callTool({ name: "list_spaces", arguments: {} }));
check("list_spaces returns the granted space", spaces.includes(space));

// --- when, and what changed. ADR-063 -------------------------------------

const future = text(await readClient.callTool({
  name: "list_notes", arguments: { since: "2099-01-01" },
}));
check("a since in the future finds nothing", future.includes("No notes"), future.slice(0, 80));
check("...and says what it was empty about", future.includes("2099"), future.slice(0, 80));

const recent = text(await readClient.callTool({
  name: "list_notes", arguments: { since: "2020-01-01" },
}));
check("a since in the past still finds the note", recent.includes("Napkin idea"));

const searched = text(await readClient.callTool({
  name: "search_notes", arguments: { query: "onboarding", since: "2099-01-01" },
}));
check("search takes the window too", searched.includes("No notes match"), searched.slice(0, 80));

// A date the parser cannot read must REFUSE. Treating it as "no filter" would
// answer "notes since last Tuesday" with the whole notebook, which reads as a
// working filter returning a lot of results.
const nonsense = await readClient.callTool({
  name: "list_notes", arguments: { since: "last tuesday" },
});
check("an unreadable date is refused, not ignored",
  JSON.stringify(nonsense).includes("not a date I can read"), JSON.stringify(nonsense).slice(0, 140));

const changes = text(await readClient.callTool({ name: "changes_notes", arguments: {} }));
check("changes_notes reports the note being created", changes.includes("created"), changes.slice(0, 200));
check("...naming it rather than its id", changes.includes("Napkin idea"), changes.slice(0, 200));
// get_note has been called several times above. If reads leaked into the feed
// they would already outnumber everything else in it.
check("...and NOT the reads", !changes.includes("note.read"), changes.slice(0, 300));

// --- looking at a page. ADR-068 ------------------------------------------
//
// The image block is the only non-text thing this server returns, and it has to
// survive a real transport. A unit test on the renderer passes whether or not
// the SDK ever puts these bytes on the wire.

const view = await readClient.callTool({ name: "view_note", arguments: { note_id: drawn.id } });
const drawing = images(view)[0];
check("view_note comes back as an image block", drawing !== undefined, JSON.stringify(view).slice(0, 120));
check("...that is a PNG", drawing?.mimeType === "image/png", String(drawing?.mimeType));
check("...with bytes in it", (drawing?.data?.length ?? 0) > 1000, String(drawing?.data?.length));
check("...really PNG bytes",
  Buffer.from(drawing?.data ?? "", "base64").subarray(0, 4).toString("hex") === "89504e47");
// The caption is what stops an agent treating the picture as a photograph
// somebody sent, and the transcript as the more authoritative of the two.
const framing = text(view);
check("...framed as the record", framing.includes("THIS IS THE RECORD"), framing.slice(0, 120));

const empty = await readClient.callTool({ name: "view_note", arguments: { note_id: blank.id } });
check("a page with nothing on it is a SENTENCE, not a blank image",
  images(empty).length === 0 && text(empty).includes("nothing drawn on it"), text(empty));

const typed = await readClient.callTool({ name: "view_note", arguments: { note_id: note.id } });
check("a note with no handwriting says so and points at get_note",
  images(typed).length === 0 && text(typed).includes("get_note"), text(typed));

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
check("the comment is attributed to an agent, by name",
  comments.includes("agent") && comments.includes(clientName), comments.slice(0, 120));

// --- what it was NOT granted ---------------------------------------------

const refusedCreate = await readClient.callTool({
  name: "create_note", arguments: { text: "sneaky" },
});
check("create_note is REFUSED without the append scope", refusedCreate.isError === true);

const refusedAppend = await readClient.callTool({
  name: "append_to_note", arguments: { note_id: note.id, text: "sneaky" },
});
check("append_to_note is REFUSED without the append scope", refusedAppend.isError === true);

const stillIntact = text(await readClient.callTool({ name: "get_note", arguments: { note_id: note.id } }));
check("the note is untouched after both refusals",
  stillIntact.includes("Ask Dana about margins") && !stillIntact.includes("sneaky"));

// --- a connection that WAS granted more ----------------------------------

const writeClient = await connect(await grant(["notes:read", "notes:comment", "notes:append"]));
const appended = text(await writeClient.callTool({
  name: "append_to_note", arguments: { note_id: note.id, text: "Follow up Thursday." },
}));
check("append_to_note succeeds WITH the append scope", appended.includes("Appended"));

// ADR-070. This threw Forbidden for every agent that ever called it, because
// it demanded a scope no OAuth client can be granted. A tool that cannot
// succeed is an automatic directory rejection.
const created = text(await writeClient.callTool({
  name: "create_note", arguments: { text: "Written by an agent." },
}));
check("create_note succeeds WITH the append scope", created.includes("Created note"), created.slice(0, 120));

const after = text(await writeClient.callTool({ name: "get_note", arguments: { note_id: note.id } }));
check("append is non-destructive - the original text survives",
  after.includes("Ask Dana about margins") && after.includes("Follow up Thursday."));

await readClient.close();
await writeClient.close();

console.log(failures === 0 ? "\nmcp smoke: all checks passed" : `\nmcp smoke: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
