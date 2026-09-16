/**
 * What a person can see on their account, and take back. Split out of
 * oauth.ts, ADR-117.
 */

import { and, eq, inArray, isNull } from "drizzle-orm";
import { withActor, oauthClients, oauthTokens, spaces } from "@jotacular/db";
import type { Actor } from "./actor";
import { Forbidden } from "./errors";

export type Connection = {
  clientId: string;
  clientName: string | null;
  scopes: string[];
  spaceIds: string[];
  /** Resolved so the page can say "your family notes", not a uuid. */
  spaceNames: string[];
  lastUsedAt: Date | null;
  createdAt: Date;
};

/**
 * What the account page shows: every agent that can reach your notes.
 *
 * docs/13-security-and-privacy.md promises people can see and revoke this. A
 * promise with no page behind it is not a control, so this is the query that
 * page runs.
 *
 * Grouped by client, because refresh rotation issues a new token on every use
 * and one connection would otherwise appear as a long list of itself. The
 * union of scopes and spaces across a client's live tokens is what that client
 * can actually reach, which is the honest thing to display.
 */
export async function listConnections(actor: Actor): Promise<Connection[]> {
  if (actor.type !== "user") throw new Forbidden();
  return withActor(actor.userId, async (tx) => {
    const rows = await tx.select({
      clientId: oauthTokens.clientId,
      clientName: oauthClients.clientName,
      scopes: oauthTokens.scopes,
      spaceIds: oauthTokens.spaceIds,
      lastUsedAt: oauthTokens.lastUsedAt,
      createdAt: oauthTokens.createdAt,
    })
      .from(oauthTokens)
      .leftJoin(oauthClients, eq(oauthClients.clientId, oauthTokens.clientId))
      .where(and(
        eq(oauthTokens.userId, actor.userId),
        eq(oauthTokens.kind, "refresh"),
        isNull(oauthTokens.revokedAt),
      ));

    const merged = new Map<string, Connection>();
    for (const row of rows) {
      const existing = merged.get(row.clientId);
      if (!existing) {
        merged.set(row.clientId, {
          clientId: row.clientId,
          clientName: row.clientName ?? null,
          scopes: [...(row.scopes ?? [])],
          spaceIds: [...(row.spaceIds ?? [])],
          spaceNames: [],
          lastUsedAt: row.lastUsedAt,
          createdAt: row.createdAt,
        });
        continue;
      }
      for (const scope of row.scopes ?? []) {
        if (!existing.scopes.includes(scope)) existing.scopes.push(scope);
      }
      for (const id of row.spaceIds ?? []) {
        if (!existing.spaceIds.includes(id)) existing.spaceIds.push(id);
      }
      // Oldest grant, newest use: "connected in March, last used an hour ago"
      // is the sentence someone auditing their account wants to read.
      if (row.createdAt < existing.createdAt) existing.createdAt = row.createdAt;
      if (row.lastUsedAt && (!existing.lastUsedAt || row.lastUsedAt > existing.lastUsedAt)) {
        existing.lastUsedAt = row.lastUsedAt;
      }
    }

    const connections = [...merged.values()];
    const wanted = [...new Set(connections.flatMap((c) => c.spaceIds))];
    if (wanted.length > 0) {
      // RLS scopes this to spaces the user is in, so a space id that somehow
      // does not belong to them resolves to nothing rather than leaking a name.
      const names = new Map(
        (await tx.select({ id: spaces.id, name: spaces.name }).from(spaces)
          .where(inArray(spaces.id, wanted)))
          .map((r) => [r.id, r.name]),
      );
      for (const c of connections) {
        c.spaceNames = c.spaceIds.map((id) => names.get(id) ?? "a space you have left");
      }
    }

    return connections.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  });
}

export async function revokeConnection(actor: Actor, clientId: string): Promise<void> {
  if (actor.type !== "user") throw new Forbidden();
  await withActor(actor.userId, async (tx) => {
    await tx.update(oauthTokens).set({ revokedAt: new Date() })
      .where(and(eq(oauthTokens.userId, actor.userId), eq(oauthTokens.clientId, clientId)));
  });
}
