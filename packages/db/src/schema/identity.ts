/** Users, spaces and membership. The tenancy boundary starts here. */
import { pgTable, uuid, text, boolean, timestamp, primaryKey, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  googleSub: text("google_sub").notNull().unique(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  /** Which side the tool rail sits on: 'auto' | 'left' | 'right'. ADR-012. */
  toolbarSide: text("toolbar_side").notNull().default("auto"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const spaces = pgTable("spaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("personal"),
  plan: text("plan").notNull().default("free"),
  /** The triage agent, off until an owner turns it on. ADR-048. */
  triageEnabled: boolean("triage_enabled").notNull().default(false),
  triageLastRunAt: timestamp("triage_last_run_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const spaceMembers = pgTable("space_members", {
  spaceId: uuid("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.spaceId, t.userId] }),
  index("space_members_user_idx").on(t.userId),
]);
