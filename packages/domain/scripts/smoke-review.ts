/**
 * The review inbox. docs/02-product-spec.md, ADR-004, ADR-037.
 *
 * A safety control wearing a product feature's clothes. Prompt injection
 * through note content cannot be prevented, so what has to be true instead is
 * that every agent write is attributed, visible, and reversible by a person.
 *
 * The agent here is a REAL agent actor, minted through the OAuth path with a
 * real `notes:append` grant -- not a hand-built object. What is under test is
 * the attribution that arrives with a genuine token.
 *
 * Appending is the only way an agent touches a note now (ADR-070), so it is
 * what the inbox has to catch.
 */
import { randomBytes, createHash } from "node:crypto";
import {
  upsertUserFromGoogle, asUser, createNote, getNote, appendToNote, defaultSpaceId,
  registerClient, issueAuthCode, exchangeAuthCode, verifyAccessToken,
  listAgentChanges, revertRevision,
  applyBillingEvent,
} from "../src/index";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

async function refused(label: string, code: string, fn: () => Promise<unknown>) {
  let got = "nothing was thrown";
  try {
    await fn();
  } catch (err) {
    got = (err as { code?: string }).code ?? `an error with no code: ${(err as Error).message}`;
  }
  check(label, got === code, `expected code "${code}", got "${got}"`);
}

const RESOURCE = "https://mcp.jotdojo.com/mcp";
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const verifier = randomBytes(32).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");

const stamp = Date.now();
const u = await upsertUserFromGoogle({
  googleSub: `rev-${stamp}`, email: `rev-${stamp}@example.test`, displayName: "Reviewer",
});
const person = asUser(u.id);
const space = await defaultSpaceId(person);

const other = await upsertUserFromGoogle({
  googleSub: `rev-o-${stamp}`, email: `rev-o-${stamp}@example.test`, displayName: "Other",
});
const stranger = asUser(other.id);

// A real connection, with the append scope granted for this space.
const client = await registerClient({ client_name: "Claude (review)", redirect_uris: [REDIRECT] });
const code = await issueAuthCode({
  actor: person, clientId: client.client_id, redirectUri: REDIRECT, codeChallenge: challenge,
  scopes: ["notes:read", "notes:append"], spaceIds: [space], resource: RESOURCE,
});
const tokens = await exchangeAuthCode({
  code, codeVerifier: verifier, clientId: client.client_id,
  redirectUri: REDIRECT, resource: RESOURCE,
});
const agent = await verifyAccessToken(tokens.access_token, RESOURCE);
if (!agent || agent.type !== "agent") throw new Error("could not mint an agent actor");

// Agent writes are a paid-plan capability (ADR-042), and this suite is about
// what happens AFTER a write, so the space is put on one first.
await applyBillingEvent({
  kind: "subscription",
  spaceId: space,
  subscription: {
    customerId: "cus_review", subscriptionId: "sub_review",
    plan: "solo", status: "active",
    currentPeriodEnd: new Date(Date.now() + 30 * 864e5),
  },
}, "smoke");


console.log("\nan agent adds to a note");
const note = await createNote(person, space, "milk, eggs, bread");
const beforeBody = (await getNote(person, note.id)).body;
const edited = await appendToNote(agent, note.id, "and a pony");
check("the addition lands", edited.body.includes("pony"));
check("...without disturbing what the person wrote", edited.body.startsWith(beforeBody));
check("the note's revision advanced", edited.revision === note.revision + 1);

console.log("\nit shows up in the inbox, attributed");
const inbox = await listAgentChanges(person, { spaceId: space });
const entry = inbox.find((c) => c.noteId === note.id);
check("the change is listed", Boolean(entry));
check("...attributed to an agent by name", entry?.agentName === "Claude (review)", String(entry?.agentName));
check("...at the revision it made", entry?.revision === edited.revision);
check("...and not yet reverted", entry?.revertedAt === null);

console.log("\nonly a person reviews");
await refused("an agent cannot read the inbox", "forbidden",
  () => listAgentChanges(agent, { spaceId: space }));
await refused("an agent cannot revert", "forbidden",
  () => revertRevision(agent, entry!.revisionId));
await refused("someone outside the space sees no such change", "not_found",
  () => revertRevision(stranger, entry!.revisionId));
check("...and their inbox is empty of it",
  !(await listAgentChanges(stranger)).some((c) => c.noteId === note.id));

console.log("\nreverting");
const reverted = await revertRevision(person, entry!.revisionId);
check("the body goes back to what the person wrote", reverted.body === beforeBody,
  `${JSON.stringify(reverted.body)} vs ${JSON.stringify(beforeBody)}`);
check("the note agrees", (await getNote(person, note.id)).body === beforeBody);
check("...via a NEW revision, not by rewriting history",
  reverted.revision === edited.revision + 1);

const after = await listAgentChanges(person, { spaceId: space });
const settled = after.find((c) => c.revisionId === entry!.revisionId);
check("the agent's change is still listed", Boolean(settled));
check("...now marked reverted", Boolean(settled?.revertedAt));
await refused("it cannot be reverted twice", "forbidden",
  () => revertRevision(person, entry!.revisionId));

console.log("\nreverting an agent's FIRST write empties the note");
const fresh = await createNote(person, space, "");
const written = await appendToNote(agent, fresh.id, "an agent wrote this from nothing");
const firstEntry = (await listAgentChanges(person, { spaceId: space }))
  .find((c) => c.noteId === fresh.id && c.revision === written.revision);
check("that change is listed too", Boolean(firstEntry));
const undone = await revertRevision(person, firstEntry!.revisionId);
check("the note goes back to empty rather than erroring", undone.body === "",
  JSON.stringify(undone.body));

console.log(failures === 0
  ? "\nreview smoke: all checks passed"
  : `\nreview smoke: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
