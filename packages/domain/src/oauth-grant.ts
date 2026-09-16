/**
 * What a person agreed to: one short-lived code, naming the scopes and spaces
 * they picked on the consent screen. Split out of oauth.ts, ADR-117.
 */

import { randomBytes } from "node:crypto";
import { withActor, oauthAuthCodes } from "@jotacular/db";
import type { Actor } from "./actor";
import { Forbidden } from "./errors";
import { listSpaces } from "./spaces";
import { CODE_TTL_MS, sha256, type Scope } from "./oauth";

export async function issueAuthCode(input: {
  actor: Actor;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: Scope[];
  spaceIds: string[];
  resource: string;
}): Promise<string> {
  if (input.actor.type !== "user") throw new Forbidden("Only a signed-in person can grant access");

  // You can only grant what you have. The consent form's space list is
  // client-supplied, so a tampered submission could otherwise mint a grant for
  // a space the user does not belong to -- RLS would not catch it, because
  // space_ids is just an array column on the code row, not a foreign key the
  // policies see.
  const reachable = new Set((await listSpaces(input.actor)).map((s) => s.id));
  for (const spaceId of input.spaceIds) {
    if (!reachable.has(spaceId)) {
      throw new Forbidden("You are not a member of one of those spaces");
    }
  }

  const code = randomBytes(32).toString("base64url");
  const userId = input.actor.userId;

  await withActor(userId, async (tx) => {
    await tx.insert(oauthAuthCodes).values({
      codeHash: sha256(code),
      clientId: input.clientId,
      userId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      scopes: input.scopes,
      spaceIds: input.spaceIds,
      resource: input.resource,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    });
  });

  return code;
}
