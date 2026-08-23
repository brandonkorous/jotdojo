/**
 * LOCAL DEVELOPMENT ONLY.
 *
 * Gives jotacular_app a password so it can connect over TCP against the docker
 * Postgres. Production sets this out of band -- the password belongs in Key
 * Vault, not in a migration that is replayed everywhere.
 */
import postgres from "postgres";

if (process.env.NODE_ENV === "production") {
  throw new Error("dev-role is not for production. Set the password from Key Vault.");
}

const adminUrl = process.env.DATABASE_ADMIN_URL;
if (!adminUrl) throw new Error("DATABASE_ADMIN_URL is not set.");

const sql = postgres(adminUrl, { max: 1, onnotice: () => {} });
await sql.unsafe(`ALTER ROLE jotacular_app LOGIN PASSWORD 'jotacular'`);
console.log("jotacular_app password set for local development");
await sql.end();
