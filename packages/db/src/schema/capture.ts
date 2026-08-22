/** Capture tokens and their idempotency ledger. docs/07. */
import { pgTable, uuid, text, timestamp, primaryKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import { notes } from "./content";
import { spaces, users } from "./identity";

export const captureTokens = pgTable("capture_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  spaceId: uuid("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** SHA-256 of the token. The plaintext is shown once and never stored. */
  tokenHash: text("token_hash").notNull().unique(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (t) => [index("capture_tokens_user_idx").on(t.userId)]);

export const captureRequests = pgTable("capture_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenId: uuid("token_id").notNull()
    .references(() => captureTokens.id, { onDelete: "cascade" }),
  requestId: text("request_id").notNull(),
  noteId: uuid("note_id").references(() => notes.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("capture_requests_token_request_idx").on(t.tokenId, t.requestId),
  index("capture_requests_rate_idx").on(t.tokenId, t.createdAt),
]);

export type CaptureToken = typeof captureTokens.$inferSelect;
