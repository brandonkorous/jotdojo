import { sql } from "drizzle-orm";
import { type Tx } from "@jotacular/db";
import { windowSql, type TimeWindow } from "./time-window";

/**
 * The three ways of finding a note. ADR-063.
 *
 * Split from search.ts at the size limit, and the seam is real: this file is
 * how each strategy RECALLS, and search.ts is how three answers become one.
 * They change for different reasons -- a new index here, a new fusion rule
 * there.
 *
 *   lexical   -- the words you actually typed, stemmed (tsvector + GIN)
 *   semantic  -- the meaning you had in mind (pgvector + HNSW)
 *   fuzzy     -- the word you meant to type (pg_trgm)
 *
 * EVERY ONE OF THEM TAKES THE WINDOW. Filtering after fusion instead would
 * quietly return fewer than `limit` results whenever a date was supplied, and
 * would look like a ranking quirk rather than a bug. See time-window.ts.
 */

export type Ranked = { id: string; rank: number };

/** Below this, trigram matches are noise -- shared prefixes that mean nothing. */
const TRIGRAM_THRESHOLD = 0.35;

export function rowsToRanked(rows: unknown): Ranked[] {
  return (rows as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    rank: Number(r.rank),
  }));
}

export async function lexical(
  tx: Tx, spaceId: string, q: string, limit: number, when?: TimeWindow,
): Promise<Ranked[]> {
  const rows = await tx.execute(sql`
    SELECT n.id,
           row_number() OVER (
             ORDER BY ts_rank(b.searchable, websearch_to_tsquery('english', ${q})) DESC
           ) AS rank
      FROM notes n
      JOIN blocks b ON b.note_id = n.id
     WHERE n.space_id = ${spaceId}
       AND n.deleted_at IS NULL
       AND b.searchable @@ websearch_to_tsquery('english', ${q})
       ${windowSql(when)}
     LIMIT ${limit}
  `);
  return rowsToRanked(rows);
}

export async function fuzzy(
  tx: Tx, spaceId: string, q: string, limit: number, when?: TimeWindow,
): Promise<Ranked[]> {
  const rows = await tx.execute(sql`
    SELECT scored.id, row_number() OVER (ORDER BY scored.sim DESC) AS rank
      FROM (
        SELECT n.id,
               max(greatest(
                 word_similarity(${q}, coalesce(b.body, b.transcript, '')),
                 word_similarity(${q}, coalesce(n.title, ''))
               )) AS sim
          FROM notes n
          JOIN blocks b ON b.note_id = n.id
         WHERE n.space_id = ${spaceId}
           AND n.deleted_at IS NULL
           ${windowSql(when)}
         GROUP BY n.id
      ) scored
     WHERE scored.sim >= ${TRIGRAM_THRESHOLD}
     ORDER BY scored.sim DESC
     LIMIT ${limit}
  `);
  return rowsToRanked(rows);
}

export async function semantic(
  tx: Tx, spaceId: string, vector: number[], maxDistance: number, limit: number,
  when?: TimeWindow,
): Promise<Ranked[]> {
  // pgvector's text input format, passed as a bound parameter -- the numbers
  // come from the provider, not from anything a user typed.
  const literal = `[${vector.join(",")}]`;
  const rows = await tx.execute(sql`
    SELECT best.id, row_number() OVER (ORDER BY best.distance) AS rank
      FROM (
        SELECT DISTINCT ON (n.id)
               n.id,
               e.embedding <=> ${literal}::vector AS distance
          FROM block_embeddings e
          JOIN blocks b ON b.id = e.block_id
          JOIN notes  n ON n.id = b.note_id
         WHERE n.space_id = ${spaceId}
           AND n.deleted_at IS NULL
           ${windowSql(when)}
         ORDER BY n.id, distance
      ) best
     -- The floor, without which vector search returns its k nearest
     -- neighbours no matter how far away they are, and every query looks
     -- like it found something. See Embedder.maxDistance.
     WHERE best.distance <= ${maxDistance}
     ORDER BY best.distance
     LIMIT ${limit}
  `);
  return rowsToRanked(rows);
}
