/** Who has a note open right now. Migration 0029, ADR-058. */
import { pgTable, uuid, text, timestamp, primaryKey, index } from "drizzle-orm/pg-core";
import { notes } from "./content";
import { spaces, users } from "./identity";

export const notePresence = pgTable("note_presence", {
  noteId: uuid("note_id").notNull().references(() => notes.id, { onDelete: "cascade" }),
  spaceId: uuid("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** Per device, not per person: one account on a tablet and a laptop is the
   *  commonest case this exists for, and collapsing them hides the collision. */
  deviceId: text("device_id").notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  /** A few seconds ahead while somebody is actually writing, so "here" and
   *  "writing right now" stay different claims. */
  writingUntil: timestamp("writing_until", { withTimezone: true }),
}, (t) => [
  primaryKey({ columns: [t.noteId, t.userId, t.deviceId] }),
  index("note_presence_seen_idx").on(t.lastSeenAt),
]);
