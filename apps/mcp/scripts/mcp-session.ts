import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createHash, randomBytes } from "node:crypto";
import {
  upsertUserFromGoogle, asUser, createNote, defaultSpaceId,
  createInkBlock, appendStrokes,
  registerClient, issueAuthCode, exchangeAuthCode,
  type Actor, type Point, type Stroke,
} from "@jotacular/domain";

/**
 * Standing up a real agent against a real server.
 *
 * Split out of smoke-mcp.ts at the size limit, and it is a genuine seam: this
 * is the OAuth dance and the fixtures, which every suite here needs and none of
 * them is about. What the tools then SAY is the suites' job.
 */

export const MCP_URL = process.env.MCP_RESOURCE ?? "http://localhost:3402/mcp";
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";

export const text = (result: unknown) => {
  const content = (result as { content?: Array<{ text?: string }> }).content ?? [];
  return content.map((c) => c.text ?? "").join("\n");
};

/** The image blocks in a tool result. `view_note` is the only tool that returns
 *  one, and the transport carrying it is what no unit test can prove. */
export const images = (result: unknown) =>
  ((result as { content?: Array<{ type?: string; data?: string; mimeType?: string }> }).content ?? [])
    .filter((c) => c.type === "image");

export type Session = {
  actor: Actor;
  space: string;
  /** A typed note with something findable in it. */
  note: { id: string };
  /** A note with handwriting, for view_note. ADR-068. */
  drawn: { id: string };
  /** A note whose ink layer exists and is empty -- the case that must come back
   *  as a sentence rather than a 1x1 image. */
  blank: { id: string };
  grant: (scopes: string[]) => Promise<string>;
  connect: (token: string) => Promise<Client>;
  /** What the registered client is called. Attribution is asserted against
   *  this rather than a literal, so renaming the session cannot fail a check
   *  about whether comments are attributed at all. */
  clientName: string;
};

export async function openSession(label: string): Promise<Session> {
  const stamp = Date.now();
  const user = await upsertUserFromGoogle({
    googleSub: `${label}-${stamp}`, email: `${label}-${stamp}@example.test`, displayName: "M",
  });
  const actor = asUser(user.id);
  const space = await defaultSpaceId(actor);

  const note = await createNote(actor, space,
    "Napkin idea\n\nBundle onboarding with the subscription. Ask Dana about margins.");

  const point = (x: number, y: number): Point => [x, y, 0, 0.5, 0, 0];
  const drawn = await createNote(actor, space, "The diagram one");
  const ink = await createInkBlock(actor, drawn.id, { w: 800, h: 600 });
  await appendStrokes(actor, ink.blockId, 0, [{
    id: "d1", tool: "pen", color: "#1F2933", width: 3,
    pts: [point(20, 20), point(120, 90), point(220, 20)],
  } satisfies Stroke]);

  const blank = await createNote(actor, space, "Nothing drawn here");
  await createInkBlock(actor, blank.id, { w: 800, h: 600 });

  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const clientName = `Claude (${label})`;
  const client = await registerClient({ client_name: clientName, redirect_uris: [REDIRECT] });

  const grant = async (scopes: string[]) => {
    const code = await issueAuthCode({
      actor, clientId: client.client_id, redirectUri: REDIRECT, codeChallenge: challenge,
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

  return { actor, space, note, drawn, blank, grant, connect, clientName };
}
