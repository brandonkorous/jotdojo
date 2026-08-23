# 03 — Architecture

## The governing rule

**One domain core, three thin adapters.**

    PWA        -->  BFF / tRPC      \
    REST v1    -->  REST adapter     >--> domain services --> Postgres + pgvector
    Agents     -->  MCP adapter     /                          Blob storage

The MCP server is a thin adapter over the same domain services the web app uses. It never has its own SQL, its own permission checks, or its own data path. If an agent can do a thing, it is because a domain method allowed it and the web UI could do the same thing through the same method.

Every agent-native product that gets this wrong ends up with two divergent permission models and, eventually, an incident. This is the most important structural decision in the project.

## Services

Four deployables. Keep it at four as long as possible.

| Service | Stack | Responsibility |
|---|---|---|
| **web** | Next.js (App Router), React, TypeScript | PWA, BFF, all rendering. Installable, offline-*capable*, never offline-authoritative |
| **api** | Node + Fastify, TypeScript | REST v1 for Shortcuts and third parties, domain services library |
| **mcp** | Node, TypeScript, MCP SDK | Streamable HTTP transport, OAuth 2.1 resource server, tool surface |
| **worker** | Node, TypeScript | Recognition pipeline, embeddings, triage agent, outbox drain |

`api`, `mcp`, and `worker` all import the same `@jotacular/domain` package. That package owns authorization, validation, and persistence. Nothing else talks to Postgres.

## Repo layout

    jotacular/
      apps/
        web/            Next.js PWA + BFF
        api/            Fastify REST
        mcp/            MCP server
        worker/         Async pipeline
      packages/
        domain/         Entities, services, authorization. The core.
        db/             Schema, migrations, typed queries (Drizzle)
        embeddings/     Embedding providers behind one interface
        vision/         Vision models: handwriting and photographs
        speech/         Whisper transcription with word timestamps
        reason/         Text in, one short remark or silence out (the triage agent)
        ink-render/     Strokes -> SVG -> PNG, for the vision model
        storage/        The blob seam: Azure SAS and a local driver (ADR-028)
      infra/
        docker/         One Dockerfile per service. Built from the repo root
        k8s/            Namespace, ConfigMap, and a Deployment+Service per app
      docs/

There is no `packages/ui`: the design system is Silica UI, consumed from
`@wizeworks/silicaui` (ADR-011). Shared TypeScript config is `tsconfig.base.json`
at the root rather than a package. The five modality packages above are separate
on purpose -- they share one queue and one set of fields, not one dependency
tree, so a deploy without a speech provider does not drag Whisper's client in
(ADR-029).

Monorepo with pnpm workspaces + Turborepo. One language (TypeScript) end to end, because there is one developer.

## Azure topology

| Concern | Choice | Notes |
|---|---|---|
| Compute | **AKS** | Already available. Keep workloads as plain containers with no AKS-specific coupling |
| Database | **Azure Postgres Flexible Server** | With `pgvector` and `pg_trgm`. Single database, RLS for tenancy |
| Object storage | **Azure Blob** | Audio, images, rendered ink previews. SAS URLs, never proxied through the API |
| Secrets | **Key Vault** + CSI driver | With AKS Workload Identity. No secrets in env vars or images |
| Terraform | **in the sparx repo** | `terraform/envs/azure/jotacular.tf`, one file, so deleting it removes Jotacular's whole Azure footprint |
| Ingress | **the shared Caddy**, on-demand TLS | Not ours. It lives in the sparx repo and routes cross-namespace; adding a hostname is a two-repo change. See [infra/README.md](../infra/README.md) |
| Queue | **Postgres outbox** first | Azure Service Bus only if the outbox actually becomes a bottleneck. Not Kafka. Ever. |
| Observability | OpenTelemetry to Azure Monitor | One trace ID across web, api, mcp, worker |

### Cost reality check

AKS plus an HA Postgres Flexible Server plus Front Door is a $200 to $400 per month floor before a single user signs up. If AKS were not already paid for, the correct answer for this stage would be Azure Container Apps.

Since it is available, use it — but **the containers must stay portable**. No AKS-specific APIs in application code, no service-mesh dependency, no operator-managed CRDs in the request path. If the economics ever demand a move to Container Apps or a single VM, it should be a re-run of the Dockerfiles, not a rewrite (ADR-026 — no Helm).

Start with one small node pool and a burstable Postgres tier. Scale when there is something to scale for.

## Data flow: capture

    client
      -> POST /v1/notes/:id/blocks        (raw artifact + metadata)
      -> domain: persist block, write outbox row, return 201   [under 1s, always]

    worker
      -> drain outbox
      -> recognizer by modality -> transcript
      -> embed transcript -> pgvector
      -> mark block ready, notify any open client over the live channel (ADR-058)

The response to the client never waits on the worker. See [07-capture-pipeline.md](07-capture-pipeline.md).

## Data flow: agent read

    Claude -> MCP streamable HTTP
           -> OAuth bearer token, validated for audience + scope
           -> domain.searchNotes(actor, query)      [same call the web app makes]
           -> markdown + provenance + confidence

## Sync model

**Server is the source of truth. IndexedDB is a cache, never a store.**

Safari evicts script-writable storage under pressure and after periods of disuse, and caps the Cache API around 50MB. Any design where the local copy is authoritative will eventually lose someone's notes, and that day the product dies.

Concretely:
- Optimistic concurrency on a per-note `revision` integer. `If-Match` semantics; on conflict, duplicate the losing version and flag it rather than merging or discarding.
- Upload eagerly and incrementally — stroke batches, audio chunks, keystroke debounce. Never hold a completed artifact only in local storage.
- Request `navigator.storage.persist()` for what cache we do keep, and treat a denial as normal.
- **No CRDTs in v1.** Yjs or Loro can come later if concurrent editing of the *same paragraph* becomes a demonstrated need. It is a large complexity tax, and ADR-058 got live multi-device updates without paying it.

## Live updates

Open on two devices and each sees the other change. Strokes, typed text, and readings
coming back from the worker. ADR-058, and it is one page of rules:

- **A live event is a POINTER** — which note, which block, how far along it now is — and
  never content. Receivers read the row themselves, through the same RLS as any other
  read, so the stream cannot leak a note to somebody who lost access between the write
  and the delivery.
- **The stream is a hint, not a source of truth.** Postgres `LISTEN/NOTIFY` down to the
  web pods, SSE from there to the browser. Neither is durable, and neither needs to be: a
  duplicate event costs a wasted read and a lost one costs a delay. **Anything that must
  happen goes in the outbox instead.**
- **Erase, move and recolour are DELTAS naming strokes by id**, not fresh copies of the
  page. That is what lets one device rub something out while another draws, and it is why
  a stroke has an `id` at all.
- **Typed text follows when clean.** A device with nothing unsaved adopts what another
  wrote; one mid-sentence keeps its sentence and the revision conflict still applies.
- **Presence** says who is here and who is writing — the honest substitute for a merge
  algorithm, since you can see the collision coming.

sparx solves this with NATS JetStream and socket.io. ADR-058 says why Jotacular does not,
and what would change that.

## Multi-tenancy

Single database, single schema. Every tenant-scoped table carries `space_id`. **Postgres row-level security is enabled and keyed to space membership**, so an application-layer bug produces an error rather than a data leak. The domain layer sets `SET LOCAL app.actor_id` per transaction.

This is cheap insurance and it gets much more expensive to add later.

## Technology rationale

| Decision | Why | What would change it |
|---|---|---|
| TypeScript everywhere | One developer, one mental model, shared types across four services | A second developer who hates it |
| Next.js for the PWA | Best-in-class installable web app story, and the BFF comes free | — |
| Postgres for everything | Notes, vectors, queue, and full-text in one managed thing to operate | Vector scale beyond ~10M blocks |
| Drizzle over Prisma | Lighter, SQL-transparent, plays well with RLS | — |
| Markdown as the note format | Agents read it natively, and it makes export credible | Never. This is load-bearing |
| Outbox over a broker | One fewer thing to run; Postgres is already there | Sustained recognition backlog |
