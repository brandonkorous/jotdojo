import { sql } from "drizzle-orm";
import { withActor, type Tx } from "@jotacular/db";
import { embedder, EmbeddingError } from "@jotacular/embeddings";
import { canReachSpace, type Actor } from "./actor";
import { Forbidden } from "./errors";
import { assertMember } from "./spaces";
import { lexical, fuzzy, semantic, type Ranked } from "./search-strategies";
import { type TimeWindow } from "./time-window";
import type { NoteSummary } from "./notes";

/**
 * Hybrid retrieval: three recall strategies, fused.
 *
 * HOW each strategy recalls is search-strategies.ts. This is how three answers
 * become one, which is a different job and changes for different reasons.
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

export type SearchHit = NoteSummary & {
  /** Which strategies found it. Surfaced so "why did I get this?" is answerable. */
  matchedBy: Array<"lexical" | "semantic" | "fuzzy">;
};

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

export type SearchOptions = TimeWindow & { limit?: number };

/**
 * Search a space.
 *
 * Every strategy is scoped to `space_id` in its own WHERE clause *and* runs
 * inside withActor, so RLS is the real boundary and the explicit predicate is
 * belt and braces. That property is why search stayed inside Postgres -- see
 * ADR-023.
 *
 * NOTE: this returns ARCHIVED notes, where listNotes does not. Archiving is
 * "I am done with this", not "hide it from me when I go looking".
 */
export async function searchNotes(
  actor: Actor, spaceId: string, query: string, options: SearchOptions | number = {},
): Promise<SearchHit[]> {
  // A number is the old signature. Kept working rather than chased through
  // every caller in one commit; the object form is what new code should use.
  const opts: SearchOptions = typeof options === "number" ? { limit: options } : options;
  const limit = opts.limit ?? 25;

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
    //
    // The window goes INTO each strategy for the same reason. Filtering the
    // fused list afterwards would spend this headroom on rows it then threw
    // away, and return fewer than `limit` whenever a date was given. ADR-063.
    const recall = limit * 4;

    const [lex, fuz, sem] = await Promise.all([
      lexical(tx, spaceId, trimmed, recall, opts),
      fuzzy(tx, spaceId, trimmed, recall, opts),
      queryVector
        ? semantic(tx, spaceId, queryVector.vector, queryVector.maxDistance, recall, opts)
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
