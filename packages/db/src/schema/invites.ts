/** Invitations into a shared space. migrations/0014_shared_spaces.sql, ADR-035. */
import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { spaces, users } from "./identity";

export const spaceInvites = pgTable("space_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  spaceId: uuid("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
  /** The address it was sent to. The invite is bound to it: a forwarded link
   *  must not hand a family's notes to whoever opened the mail. */
  email: text("email").notNull(),
  role: text("role").notNull().default("member"),
  /** SHA-256 of the token, never the token. A leaked backup should not be a
   *  pile of working invitations. */
  tokenHash: text("token_hash").notNull().unique(),
  invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  acceptedBy: uuid("accepted_by").references(() => users.id, { onDelete: "set null" }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (t) => [index("space_invites_space_idx").on(t.spaceId, t.createdAt)]);
