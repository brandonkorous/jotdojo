/**
 * Drizzle table definitions.
 *
 * These mirror the SQL in migrations/, which is the source of truth --
 * migrations are hand-written because the RLS policies are the tenancy
 * boundary and must be reviewed as SQL. Keep the two in step.
 *
 * Split by responsibility (ADR-030) and re-exported here, so `@jotdojo/db`
 * still hands out every table from one place.
 */
export * from "./schema/_columns";
export * from "./schema/identity";
export * from "./schema/content";
export * from "./schema/pipeline";
export * from "./schema/presence";
export * from "./schema/capture";
export * from "./schema/agents";
export * from "./schema/invites";
export * from "./schema/billing";

/** Row types, inferred from the tables above. */
import { users, spaces } from "./schema/identity";
import { notes, blocks, comments } from "./schema/content";

export type User = typeof users.$inferSelect;
export type Space = typeof spaces.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Block = typeof blocks.$inferSelect;
export type Comment = typeof comments.$inferSelect;
