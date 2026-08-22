import { sql } from "drizzle-orm";
import { withActor, type Tx } from "@jotdojo/db";
import { embedder, EmbeddingError } from "@jotdojo/embeddings";
import { canReachSpace, type Actor } from "./actor";
import { Forbidden } from "./errors";
import { assertMember } from "./spaces";
import type { NoteSummary } from "./notes";

/**
 * Hybrid retrieval: three recall strategies, fused.
 *
 *   lexical   -- the words you actually typed, stemmed (tsvector + GIN)
 *   semantic  -- the meaning you had in mind (pgvector + HNSW)
 *   fuzzy     -- the word you meant to type (pg_trgm)
 *
 * Fused with Reciprocal Rank Fusion rather than by combining scores. RRF uses
 * only each strategy's *rank*, which matters because ts_rank, cosine distance
 * and trigram similarity are three incomparable scales -- any weighted sum of
 * them is a number with no meaning, tuned by superstition. RRF needs no
 * calibration and survives adding a fourth strategy later.
 *
 *   score(note) = sum over strategies of 1 / (K + rank)
 *
 * K=60 is the value from the original TREC work; it damps the top of each list
 * so one strategy's confident first result cannot outvote agreement between
 * the other two. See docs/04-data-model.md.
 */
const RRF_K = 60;

/** Below this, trigram matches are noise -- shared prefixes that mean nothing. */
const TRIGRAM_THRESHOLD = 0.35;

export type SearchHit = NoteSummary & {
  /** Which strategies found it. Surfaced so "why did I get this?" is answerable. */
  matchedBy: Array<"lexical" | "semantic" | "fuzzy">;
};

type Ranked = { id: string; rank: number };

function fuse(lists: Array<{ kind: SearchHit["matchedBy"][number]; hits: Ranked[] }>) {
  const scores = new Map<string, { score: number; matchedBy: SearchHit["matchedBy"] }>();
  for (const { kind, hits } of lists) {
    for (const hit of hits) {
      const entry = scores.get(hit.id) ?? { score: 0, matchedBy: [] };
      entry.score += 1 / (RRF_K + hit.rank);
      entry.matchedBy.push(kind);
      scores.set(hit.id, entry);
    }
  }
  return [...scores.entries()].sort((a, b) => b[1].score - a[1].score);
}

function rowsToRanked(rows: unknown): Ranked[] {
  return (rows as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    rank: Number(r.rank),
  }));
}

async function lexical(tx: Tx, spaceId: string, q: string, limit: number): Promise<Ranked[]> {
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
     LIMIT ${limit}
  `);
  return rowsToRanked(rows);
}

async function fuzzy(tx: Tx, spaceId: string, q: string, limit: number): Promise<Ranked[]> {
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
         GROUP BY n.id
      ) scored
     WHERE scored.sim >= ${TRIGRAM_THRESHOLD}
     ORDER BY scored.sim DESC
     LIMIT ${limit}
  `);
  return rowsToRanked(rows);
}

async function semantic(
  tx: Tx, spaceId: string, vector: number[], maxDistance: number, limit: number,
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

/**
 * Never let a provider outage break search.
 *
 * A failed embedding call costs semantic recall for that one query; lexical and
 * trigram still answer it. Throwing here would turn a degraded dependency into
 * a broken feature.
 */
async function embedQuery(
  query: string,
): Promise<{ vector: number[]; maxDistance: number } | null> {
  const provider = embedder();
  if (!provider) return null;
  try {
    const vector = (await provider.embed([query]))[0];
    return vector ? { vector, maxDistance: provider.maxDistance } : null;
  } catch (err) {
    const why = err instanceof EmbeddingError ? err.message : String(err);
    console.warn(`[search] semantic recall unavailable for this query: ${why}`);
    return null;
  }
}

async function hydrate(
  tx: Tx, fused: Array<[string, { matchedBy: SearchHit["matchedBy"] }]>,
): Promise<SearchHit[]> {
  const ids = fused.map(([id]) => id);
  const rows = await tx.execute(sql`
    SELECT n.id, n.title, n.pinned, n.updated_at, n.revision,
           coalesce(first_block.content, '') AS preview
      FROM notes n
      -- The first block with content, not position 0. See listNotes.
      LEFT JOIN LATERAL (
        SELECT coalesce(b.body, b.transcript) AS content
          FROM blocks b
         WHERE b.note_id = n.id AND coalesce(b.body, b.transcript, '') <> ''
         ORDER BY b.position LIMIT 1
      ) first_block ON true
     -- string_to_array rather than passing the JS array directly: drizzle
     -- binds an array parameter as a single scalar, and Postgres rejects it
     -- as a malformed array literal.
     WHERE n.id = ANY(string_to_array(${ids.join(",")}, ',')::uuid[])
  `);

  const byId = new Map(
    (rows as unknown as Array<Record<string, unknown>>).map((r) => [String(r.id), r]),
  );

  // Rebuilt in fusion order: the query above returns rows in whatever order the
  // planner likes, and losing the ranking here would silently undo all of it.
  return fused.flatMap(([id, { matchedBy }]) => {
    const r = byId.get(id);
    if (!r) return [];
    return [{
      id,
      title: (r.title as string | null) ?? null,
      preview: String(r.preview ?? "").replace(/\s+/g, " ").trim().slice(0, 180),
      pinned: Boolean(r.pinned),
      updatedAt: new Date(String(r.updated_at)),
      revision: Number(r.revision),
      matchedBy,
    }];
  });
}

/**
 * Search a space.
 *
 * Every strategy is scoped to `space_id` in its own WHERE clause *and* runs
 * inside withActor, so RLS is the real boundary and the explicit predicate is
 * belt and braces. That property is why search stayed inside Postgres -- see
 * ADR-023.
 */
export async function searchNotes(
  actor: Actor, spaceId: string, query: string, limit = 25,
): Promise<SearchHit[]> {
  if (!canReachSpace(actor, spaceId)) {
    throw new Forbidden("This connection cannot reach that space");
  }

  const trimmed = query.trim();
  if (!trimmed) return [];

  // Embedding the query is the one part of search that leaves the process, so
  // it happens before the transaction opens rather than holding a database
  // connection open across a network call.
  const queryVector = await embedQuery(trimmed);

  return withActor(actor.userId, async (tx) => {
    // Refused, not silently empty.
    //
    // RLS already guarantees a non-member gets no rows, so this changes no
    // data -- it changes what the caller is told. "Empty" and "you are not in
    // this space" are the same response to a client, which means a broken
    // grant, a stale space id, and a genuinely empty notebook are
    // indistinguishable in a log. That ambiguity is what hid ADR-020 for a
    // whole session.
    await assertMember(tx, actor, spaceId);

    // Each strategy recalls deeper than the final limit: fusion can only rank
    // what it was given, and a note that is 30th lexically but 2nd semantically
    // is exactly the result hybrid search exists to surface.
    const recall = limit * 4;

    const [lex, fuz, sem] = await Promise.all([
      lexical(tx, spaceId, trimmed, recall),
      fuzzy(tx, spaceId, trimmed, recall),
      queryVector
        ? semantic(tx, spaceId, queryVector.vector, queryVector.maxDistance, recall)
        : Promise.resolve([]),
    ]);

    const fused = fuse([
      { kind: "lexical", hits: lex },
      { kind: "semantic", hits: sem },
      { kind: "fuzzy", hits: fuz },
    ]).slice(0, limit);

    if (fused.length === 0) return [];
    return hydrate(tx, fused);
  });
}
