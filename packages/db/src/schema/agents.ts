/** OAuth 2.1 and the MCP client registry. Two client identifiers, kept distinct (ADR-021). */
import { pgTable, uuid, text, timestamp, jsonb, primaryKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import { spaces, users } from "./identity";

export const mcpClients = pgTable("mcp_clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientName: text("client_name"),
  clientId: text("client_id").notNull(),
  registrationSource: text("registration_source"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const mcpGrants = pgTable("mcp_grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  mcpClientId: uuid("mcp_client_id").notNull()
    .references(() => mcpClients.id, { onDelete: "cascade" }),
  spaceId: uuid("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
  scopes: text("scopes").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (t) => [uniqueIndex("mcp_grants_client_space_idx").on(t.mcpClientId, t.spaceId)]);

export const oauthClients = pgTable("oauth_clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: text("client_id").notNull().unique(),
  clientName: text("client_name"),
  redirectUris: text("redirect_uris").array().notNull().default([]),
  registrationSource: text("registration_source").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const oauthAuthCodes = pgTable("oauth_auth_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  codeHash: text("code_hash").notNull().unique(),
  clientId: text("client_id").notNull(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  redirectUri: text("redirect_uri").notNull(),
  codeChallenge: text("code_challenge").notNull(),
  scopes: text("scopes").array().notNull().default([]),
  spaceIds: uuid("space_ids").array().notNull().default([]),
  /** RFC 8707 resource indicator, re-checked at the token endpoint. */
  resource: text("resource").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const oauthTokens = pgTable("oauth_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull().unique(),
  kind: text("kind").notNull(),
  clientId: text("client_id").notNull(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scopes: text("scopes").array().notNull().default([]),
  spaceIds: uuid("space_ids").array().notNull().default([]),
  audience: text("audience").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  rotatedFrom: uuid("rotated_from"),
  familyId: uuid("family_id").notNull(),
  /** mcp_clients.id -- this user's connection to the application. */
  mcpClientId: uuid("mcp_client_id"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("oauth_tokens_user_idx").on(t.userId, t.kind),
  index("oauth_tokens_family_idx").on(t.familyId),
]);

export type OAuthClient = typeof oauthClients.$inferSelect;
