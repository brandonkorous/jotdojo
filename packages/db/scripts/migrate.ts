/**
 * Plain SQL migration runner.
 *
 * We hand-write migrations rather than generating them, because the row-level
 * security policies in 0000_init.sql are the tenancy boundary and must be
 * reviewed as SQL — not diffed out of a schema by a tool. See
 * docs/04-data-model.md.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
// Migrations are DDL, so they run as the owner -- not as the restricted
// jotdojo_app role the application uses. See migrations/0001_app_role.sql.
const url = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_ADMIN_URL is not set. Copy .env.example to .env.");

const sql = postgres(url, { max: 1, onnotice: () => {} });

await sql`
  CREATE TABLE IF NOT EXISTS _migrations (
    name        text PRIMARY KEY,
    applied_at  timestamptz NOT NULL DEFAULT now()
  )
`;

const applied = new Set(
  (await sql<{ name: string }[]>`SELECT name FROM _migrations`).map((r) => r.name),
);

const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
let ran = 0;

for (const file of files) {
  if (applied.has(file)) continue;
  const body = await readFile(join(dir, file), "utf8");
  process.stdout.write(`applying ${file} ... `);
  await sql.begin(async (tx) => {
    await tx.unsafe(body);
    await tx`INSERT INTO _migrations (name) VALUES (${file})`;
  });
  process.stdout.write("ok\n");
  ran++;
}

console.log(ran === 0 ? "already up to date" : `applied ${ran} migration(s)`);
await sql.end();
