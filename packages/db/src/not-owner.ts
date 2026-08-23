import { sql } from "drizzle-orm";
import { db } from "./client";

/**
 * The application must not connect as a role that owns its tables. ADR-057.
 *
 * 0001 wanted FORCE ROW LEVEL SECURITY for this: it removes the table owner's
 * exemption, so an application pointed at the owner's connection string would
 * still be bound by every policy. The intent was right and the mechanism could
 * not work here -- that same exemption is what every SECURITY DEFINER function
 * in this schema depends on (ADR-024), so FORCE broke account creation, anon
 * drafts, transcripts and metering instead.
 *
 * This is the direct version of the same check, and a better one: it names the
 * actual hazard rather than hoping a flag catches it, and it fails on the first
 * connection instead of silently serving every tenant's rows to every other.
 */

/** Tables whose owner must never be the application's login role. */
const OWNED = ["notes", "blocks", "users", "spaces"] as const;

export type OwnershipCheck = {
  ok: boolean;
  role: string;
  /** The tables from OWNED that this role owns. Empty when ok. */
  owns: string[];
};

export async function checkNotOwner(): Promise<OwnershipCheck> {
  const rows = await db.execute(sql`
    SELECT current_user AS role,
           coalesce(
             (SELECT array_agg(tablename)
                FROM pg_tables
               WHERE schemaname = 'public'
                 AND tablename = ANY(${sql.raw(`ARRAY[${OWNED.map((t) => `'${t}'`).join(",")}]`)})
                 AND tableowner = current_user),
             '{}'
           ) AS owns
  `) as unknown as Array<{ role: string; owns: string[] }>;

  const row = rows[0];
  const owns = row?.owns ?? [];
  return { ok: owns.length === 0, role: String(row?.role ?? "unknown"), owns };
}

/**
 * Refuse to run rather than run without a tenancy boundary.
 *
 * Throwing is the point. An application that can read every space is not a
 * degraded application, it is a different product, and it must not start.
 */
export async function assertNotOwner(): Promise<void> {
  const result = await checkNotOwner();
  if (result.ok) return;
  throw new Error(
    `DATABASE_URL connects as "${result.role}", which owns ${result.owns.join(", ")}. `
    + "A table owner is exempt from row-level security, so every tenancy policy "
    + "would be inert while still reading as though it were enforced. Point "
    + "DATABASE_URL at the restricted application role (jotacular_app) and keep "
    + "the owner for DATABASE_ADMIN_URL and migrations only. ADR-057.",
  );
}
