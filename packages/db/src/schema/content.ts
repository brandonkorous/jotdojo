/** Notes and everything that hangs off one. */
import { pgTable, uuid, text, integer, boolean, timestamp, real, jsonb, bigint, primaryKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import { tsvector } from "./_columns";
import { mcpClients } from "./agents";
import { spaces, users } from "./identity";

export const notes = pgTable("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  spaceId: uuid("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
  title: text("title"),
  titleSource: text("title_source").notNull().default("inferred"),
  revision: integer("revision").notNull().default(1),
  pinned: boolean("pinned").notNull().default(false),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("notes_space_updated_idx").on(t.spaceId, t.updatedAt)]);

export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  spaceId: uuid("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  blobUrl: text("blob_url"),
  strokes: jsonb("strokes"),
  mimeType: text("mime_type"),
  byteSize: bigint("byte_size", { mode: "number" }),
  durationMs: integer("duration_ms"),
  width: integer("width"),
  height: integer("height"),
  previewUrl: text("preview_url"),
  /** Bumped by every write to an ink page. A whole-page replacement states the
   *  version it believed in, so a stale one is refused rather than applied over
   *  the top of somebody else's strokes. Migration 0029, ADR-058. */
  strokesVersion: integer("strokes_version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const blocks = pgTable("blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  noteId: uuid("note_id").notNull().references(() => notes.id, { onDelete: "cascade" }),
  spaceId: uuid("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  kind: text("kind").notNull(),
  // The universal four fields -- see docs/07-capture-pipeline.md.
  body: text("body"),
  artifactId: uuid("artifact_id").references(() => mediaAssets.id, { onDelete: "set null" }),
  transcript: text("transcript"),
  transcriptSource: text("transcript_source"),
  confidence: real("confidence"),
  /** How much of the surface was read. NULL = whole or unmeasured; < 1 = the
   *  caller must say so rather than presenting it as complete. ADR-056. */
  transcriptCoverage: real("transcript_coverage"),
  transcriptState: text("transcript_state").notNull().default("ready"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  searchable: tsvector("searchable"),
}, (t) => [index("blocks_note_position_idx").on(t.noteId, t.position)]);

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  noteId: uuid("note_id").notNull().references(() => notes.id, { onDelete: "cascade" }),
  spaceId: uuid("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  /** 'user' | 'agent'. Drives permissions AND the ink colour. ADR-011. */
  authorType: text("author_type").notNull(),
  authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
  agentClientId: uuid("agent_client_id").references(() => mcpClients.id, { onDelete: "set null" }),
  agentModel: text("agent_model"),
  inReplyTo: uuid("in_reply_to"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("comments_note_idx").on(t.noteId, t.createdAt)]);

export const noteRevisions = pgTable("note_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  noteId: uuid("note_id").notNull().references(() => notes.id, { onDelete: "cascade" }),
  spaceId: uuid("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull(),
  snapshot: jsonb("snapshot").notNull(),
  authorType: text("author_type").notNull(),
  authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
  agentClientId: uuid("agent_client_id").references(() => mcpClients.id, { onDelete: "set null" }),
  agentModel: text("agent_model"),
  summary: text("summary"),
  revertedAt: timestamp("reverted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("note_revisions_note_rev_idx").on(t.noteId, t.revision)]);
