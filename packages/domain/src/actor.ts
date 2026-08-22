/**
 * Who is doing something.
 *
 * An agent is never an independent principal: it always carries the id of the
 * user who granted its token, and it holds a subset of that user's rights,
 * never a superset. Row-level security therefore keys on `userId` for both
 * kinds, and the audit log records which client did it. See docs/06-auth.md.
 */
export type Actor =
  | { type: "user"; userId: string }
  /**
   * A capture token from an iOS Shortcut. It is the user, holding exactly one
   * privilege: create a note in one named space. It cannot read, list or
   * search, and it cannot reach any other space. docs/09-shortcuts.md.
   */
  | { type: "capture"; userId: string; tokenId: string; spaceId: string }
  | {
      type: "agent";
      /** The user who granted the token. RLS runs as this person. */
      userId: string;
      /**
       * oauth_clients.client_id -- identifies the APPLICATION, e.g.
       * "jd_client_204af...". Used for display and rate limiting.
       */
      clientId: string;
      /**
       * mcp_clients.id -- a uuid identifying THIS USER'S connection to that
       * application. This is what attribution columns reference, so revoking
       * one person's Claude never orphans another person's comments.
       */
      clientRecordId: string;
      /** Best effort, e.g. "claude-opus-5". */
      model?: string;
      scopes: readonly string[];
      /**
       * The spaces this grant reaches. Grants are per client PER SPACE
       * (docs/06-auth.md), so an agent connected for your personal space must
       * not see the family one. RLS cannot express this -- it only knows the
       * user is a member of both -- so the domain layer enforces it.
       */
      spaceIds: readonly string[];
    };

export const asUser = (userId: string): Actor => ({ type: "user", userId });

export function hasScope(actor: Actor, scope: string): boolean {
  // A signed-in person is not scope-limited; scopes constrain credentials.
  if (actor.type === "user") return true;
  if (actor.type === "capture") return scope === "capture:write";
  return actor.scopes.includes(scope);
}

/** Attribution columns for whichever of the two kinds this actor is. */
export function attribution(actor: Actor) {
  // A capture is the PERSON writing, just through a different door, so it is
  // attributed to them rather than to the token.
  return actor.type === "agent"
    ? { authorType: "agent" as const, authorUserId: null, agentClientId: actor.clientRecordId, agentModel: actor.model ?? null }
    : { authorType: "user" as const, authorUserId: actor.userId, agentClientId: null, agentModel: null };
}

/**
 * Can this actor reach this space?
 *
 * For a person, membership decides, and RLS has already enforced it. For an
 * agent there is a second, narrower gate: the grant. This is the check RLS
 * cannot make for us.
 */
export function canReachSpace(actor: Actor, spaceId: string): boolean {
  if (actor.type === "agent") return actor.spaceIds.includes(spaceId);
  if (actor.type === "capture") return actor.spaceId === spaceId;
  return true;
}
