/** The async half: embeddings, the outbox drain, and the audit trail. */
import { pgTable, uuid, text, integer, timestamp, jsonb, bigserial, primaryKey, index } from "drizzle-orm/pg-core";
import { vector1536 } from "./_columns";
import { mcpClients } from "./agents";
import { blocks } from "./content";
import { spaces, users } from "./identity";

export const blockEmbeddings = pgTable("block_embeddings", {
  blockId: uuid("block_id").primaryKey().references(() => blocks.id, { onDelete: "cascade" }),
  spaceId: uuid("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
  embedding: vector1536("embedding").notNull(),
  model: text("model").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const outbox = pgTable("outbox", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  topic: text("topic").notNull(),
  payload: jsonb("payload").notNull(),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
  attempts: integer("attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  lastError: text("last_error"),
});

export const auditLog = pgTable("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  spaceId: uuid("space_id").references(() => spaces.id, { onDelete: "cascade" }),
  actorType: text("actor_type").notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  mcpClientId: uuid("mcp_client_id").references(() => mcpClients.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  targetId: uuid("target_id"),
  toolName: text("tool_name"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("audit_log_space_idx").on(t.spaceId, t.createdAt)]);
