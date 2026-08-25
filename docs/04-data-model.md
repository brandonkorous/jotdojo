# 04 — Data model

Illustrative DDL. The migrations in `packages/db` are authoritative once they exist.

## Identity and tenancy

    users
      id              uuid pk
      google_sub      text unique not null      -- Google OAuth subject
      email           citext unique not null
      display_name    text
      avatar_url      text
      created_at      timestamptz not null default now()

    spaces
      id              uuid pk
      name            text not null
      kind            text not null             -- personal | family | team
      plan            text not null default 'free'
      triage_enabled  boolean not null default false   -- off until an owner says so
      triage_last_run_at timestamptz               -- how far the agent has read
      created_by      uuid references users(id)
      created_at      timestamptz not null default now()

    space_members
      space_id        uuid references spaces(id) on delete cascade
      user_id         uuid references users(id) on delete cascade
      role            text not null             -- owner | member
      joined_at       timestamptz not null default now()
      primary key (space_id, user_id)

Roles are two. Resist a third until a paying customer demands it.

## Notes and blocks

    notes
      id              uuid pk
      space_id        uuid not null references spaces(id) on delete cascade
      title           text                       -- inferred if null
      title_source    text                       -- user | inferred
      revision        integer not null default 1 -- optimistic concurrency
      pinned          boolean not null default false
      archived_at     timestamptz
      deleted_at      timestamptz                -- soft delete, always
      created_by      uuid references users(id)
      created_at      timestamptz not null default now()
      updated_at      timestamptz not null default now()

    blocks
      id              uuid pk
      note_id         uuid not null references notes(id) on delete cascade
      space_id        uuid not null              -- denormalized for RLS
      position        integer not null
      kind            text not null              -- text | ink | audio | image

      -- the universal four fields
      body            text                       -- text blocks: the content itself
      artifact_id     uuid references media_assets(id)
      transcript      text                       -- recognized text, all modalities
      transcript_source text                     -- user | scribble | htr:vlm
                                                 -- htr:myscript | asr:azure
                                                 -- ocr:azure | caption:vlm
      confidence      real                       -- 0..1, null for user-authored
      transcript_coverage real                   -- how much of the surface was read
                                                 -- null = whole, or nobody measured
                                                 -- < 1 = partial, and callers must say so
      transcript_state text not null default 'ready'
                                                 -- pending | ready | failed | deferred

      created_at      timestamptz not null default now()

`blocks (note_id, position)` is a plain INDEX, not a unique constraint. This document
claimed a `unique … deferrable initially deferred` for months and `0000_init.sql` never
created one — corrected here rather than added, because reading order is derived from
position now (ADR-065) and a constraint that does not exist is worse than one that never
existed: it is a rule people write code against.

**The ink layer holds two arrays, not one.** `media_assets.strokes` is
`{v, canvas, strokes[], texts[]}` — handwriting and typed boxes on the same plane, sharing
one `strokes_version`, one subscription and one delta protocol (ADR-058, ADR-065). They are
kept apart inside the document on purpose: the recogniser renders `strokes` only, so typed
text cannot reach a vision model and come back as a confidence-scored guess about words
somebody had already typed.

Canvas text gets a companion `blocks` row (`kind='text'`, `artifact_id` → the layer) holding
the boxes flattened in reading order, so `searchable`, embeddings, `inferTitle` and
`renderBlock` all work with no new paths. `readBody` filters to `artifact_id IS NULL` so
that copy never reaches the typing surface.

**The four universal fields are the architecture.** Every modality collapses to them, which is why adding video later is a new recognizer and not a schema change.

A `transcript_state` of `deferred` means the user hit a plan limit. The block exists, the raw artifact is safe, recognition is queued for the next cycle. Capture never fails for billing reasons.

## Raw artifacts

    media_assets
      id              uuid pk
      space_id        uuid not null
      kind            text not null              -- ink | audio | image
      blob_url        text                       -- Azure Blob, for audio/image
      strokes         jsonb                      -- ink only, see below
      mime_type       text
      byte_size       bigint
      duration_ms     integer                    -- audio
      width, height   integer                    -- image / ink canvas
      preview_url     text                       -- rendered raster or thumbnail
      created_at      timestamptz not null default now()

Ink strokes live in `jsonb` in Postgres, not Blob — they are small, they are queried, and they get re-recognized. Audio and images go to Blob with SAS URLs; never proxy bytes through the API.

**Raw artifacts are retained indefinitely.** That is what lets us re-run recognition against better models and have every old note silently improve.

### Stroke format

    {
      "v": 1,
      "canvas": { "w": 1024, "h": 1366 },
      "strokes": [
        {
          "tool": "pen",
          "color": "#1A1817",
          "width": 2.0,
          "pts": [[x, y, t, pressure, tiltX, tiltY]]
        }
      ]
    }

Flat numeric arrays, not an object per point — a page of handwriting is thousands of points and the payload difference is large. `t` is milliseconds relative to stroke start.

## Comments and attribution

    comments
      id              uuid pk
      note_id         uuid not null references notes(id) on delete cascade
      space_id        uuid not null
      body            text not null
      author_type     text not null              -- user | agent
      author_user_id  uuid references users(id)
      agent_client_id uuid references mcp_clients(id)
      agent_model     text                       -- best effort, e.g. claude-opus-5
      in_reply_to     uuid references comments(id)
      anchor_id       text                       -- an object in the ink document, or null
      resolved_at     timestamptz
      created_at      timestamptz not null default now()

Agent comments are first-class, not a special case. `author_type` drives both the permission checks and the visual treatment — see the ink-colour rule in [10-design-system.md](10-design-system.md).

`anchor_id` names **one object on the page** — a text box, a photograph or a stroke — and null means the note as a whole. It is `text` rather than `uuid` because stroke ids are minted by clients, and it is **not** a foreign key, because the objects it names live inside a jsonb document. Erasing the object therefore leaves its comments standing, which is the intended behaviour: what somebody said about a note is often the only record that the note existed. ADR-107.

## Revisions

    note_revisions
      id              uuid pk
      note_id         uuid not null
      space_id        uuid not null
      revision        integer not null
      snapshot        jsonb not null             -- full block list at this revision
      author_type     text not null              -- user | agent
      author_user_id  uuid
      agent_client_id uuid
      agent_model     text
      summary         text                       -- "appended 2 blocks", for the inbox
      reverted_at     timestamptz
      created_at      timestamptz not null default now()

Append-only. Every mutation writes one. This is what makes agent edits reversible and what powers the review inbox.

## Agent access

    mcp_clients
      id              uuid pk
      user_id         uuid not null references users(id)
      client_name     text                       -- "Claude Desktop", from DCR/CIMD
      client_id       text not null
      registration_source text                   -- dcr | cimd | preregistered
      created_at      timestamptz not null default now()
      revoked_at      timestamptz

    mcp_grants
      id              uuid pk
      mcp_client_id   uuid not null references mcp_clients(id) on delete cascade
      space_id        uuid not null references spaces(id) on delete cascade
      scopes          text[] not null            -- see 05-mcp-server.md
      created_at      timestamptz not null default now()
      revoked_at      timestamptz
      unique (mcp_client_id, space_id)

**Grants are per client, per space.** Connecting Claude does not grant it every space, and revoking Claude does not touch ChatGPT. The user sees this list in settings and can kill any row.

    audit_log
      id              bigserial pk
      space_id        uuid
      actor_type      text not null              -- user | agent | system
      actor_user_id   uuid
      mcp_client_id   uuid
      action          text not null              -- note.read | note.append | ...
      target_id       uuid
      tool_name       text
      metadata        jsonb
      created_at      timestamptz not null default now()

Every MCP tool call writes a row. A security control now, and later a genuinely interesting product surface: "what has Claude been reading?"

## Search

    block_embeddings
      block_id        uuid pk references blocks(id) on delete cascade
      space_id        uuid not null
      embedding       vector(1536)
      model           text not null
      created_at      timestamptz not null default now()

Plus a generated `tsvector` column on `blocks` over `coalesce(body, transcript)` with a GIN index, and GIN trigram indexes over the same expression and over `notes.title`. Embeddings are indexed with HNSW.

Hybrid retrieval fuses all three with **reciprocal rank fusion** in the domain layer (`packages/domain/src/search.ts`), using only each strategy's rank — `ts_rank`, cosine distance and trigram similarity are three incomparable scales, and any weighted sum of them is a number with no meaning. Each strategy recalls four times deeper than the final limit, because fusion can only rank what it was given and a note that is 30th lexically but 2nd semantically is exactly what hybrid search exists to surface.

Re-embedding on a model change is a worker job, not a migration. The `model` column is what makes such a change detectable without guessing.

Writes to `block_embeddings` go through `app_store_embedding`, which reads the space from the block rather than trusting its caller — see ADR-024.

## The outbox

    outbox
      id              bigserial pk
      topic           text not null              -- block.recognize | block.embed | note.triage
      payload         jsonb not null
      available_at    timestamptz not null default now()
      attempts        integer not null default 0
      locked_until    timestamptz
      completed_at    timestamptz
      last_error      text

Written in the same transaction as the entity it describes, so a capture that commits always has its follow-up work queued. Workers claim rows with `FOR UPDATE SKIP LOCKED`.

## Row-level security

Enabled on every tenant-scoped table:

    ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

    CREATE POLICY notes_space_access ON notes
      USING (space_id IN (
        SELECT space_id FROM space_members
        WHERE user_id = current_setting('app.actor_id')::uuid
      ));

The domain layer opens every transaction by setting `app.actor_id`. For agent calls the actor is **the user who granted the token**, never the client — an agent always acts as a person, and the audit log records which client did it.

Workers legitimately operate across spaces, and they do it **without** a role that bypasses
RLS. That role was removed in ADR-024: the worker connects as the same restricted
`jotacular_app` role as everything else, and reaches across spaces only through named
`SECURITY DEFINER` functions — claim a job, store a result, meter it, close it, leave a
comment. A role that can silently switch tenancy off everywhere is worse than a door that
can only do one thing.

This is cheap insurance now and much more expensive to retrofit later.
