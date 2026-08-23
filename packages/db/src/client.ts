import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Opened on FIRST USE, not on import: a build must never need a live
 * DATABASE_URL, and `next build` imports every route module. ADR-031.
 */
function connect(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  }

  // Per-process pool. The shared server caps max_connections at 50 and
  // infra/k8s sets 5/5/3/3 across the four services. ADR-031.
  const poolMax = Number(process.env.DB_POOL_MAX ?? 10);
  if (!Number.isInteger(poolMax) || poolMax < 1) {
    throw new Error(
      `DB_POOL_MAX must be a positive integer; received ${JSON.stringify(process.env.DB_POOL_MAX)}.`,
    );
  }

  // One pool per process. Next.js dev reloads the module graph, so stash it on
  // globalThis to avoid leaking a pool on every hot reload.
  const globalForDb = globalThis as unknown as { __jotacularSql?: postgres.Sql };
  const client = globalForDb.__jotacularSql ?? postgres(url, { max: poolMax });
  if (process.env.NODE_ENV !== "production") globalForDb.__jotacularSql = client;

  return drizzle(client, { schema });
}

let connection: Db | undefined;

/**
 * A stand-in that becomes the real client on first access, so every existing
 * call site is unchanged. Methods bind because drizzle's builders use `this`.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, property, receiver) {
    connection ??= connect();
    const value = Reflect.get(connection as object, property, receiver);
    return typeof value === "function" ? value.bind(connection) : value;
  },
  has(_target, property) {
    connection ??= connect();
    return Reflect.has(connection as object, property);
  },
});

/**
 * Run work as a specific user, inside a transaction that row-level security
 * can see.
 *
 * Every policy in 0000_init.sql reads `app.actor_id`; without this wrapper the
 * setting is empty, `app_actor_id()` returns NULL, and every policy denies.
 * That failure mode is deliberate -- a query that forgets to say who it is for
 * returns nothing rather than everything.
 *
 * `set_config(..., true)` scopes the setting to the transaction, so it cannot
 * leak to the next borrower of a pooled connection.
 */
export async function withActor<T>(actorId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.actor_id', ${actorId}, true)`);
    return fn(tx);
  });
}

/**
 * Escape hatch for the two things that legitimately run before an actor exists:
 * resolving a Google sign-in to a user row, and creating that user. Everything
 * else must go through withActor.
 */
export async function withoutActor<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(fn);
}
