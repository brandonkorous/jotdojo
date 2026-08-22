# jotdojo — project documentation

Everything needed to take jotdojo from empty repo to shipped product. Read in order the first time; after that, jump to what you need.

| Doc | What it settles |
|---|---|
| [00-vision.md](00-vision.md) | What we're building and why it isn't a notes app |
| [01-audience-and-pricing.md](01-audience-and-pricing.md) | Who pays, how much, what's metered |
| [02-product-spec.md](02-product-spec.md) | Objects, capture modes, feature scope |
| [03-architecture.md](03-architecture.md) | Services, Azure topology, repo layout |
| [04-data-model.md](04-data-model.md) | Schema, RLS, block format |
| [05-mcp-server.md](05-mcp-server.md) | Tool surface, scopes, agent safety |
| [06-auth.md](06-auth.md) | Google login + OAuth 2.1 server for MCP |
| [07-capture-pipeline.md](07-capture-pipeline.md) | Multimodal ingest and recognition |
| [08-ink.md](08-ink.md) | Handwriting subsystem |
| [09-shortcuts.md](09-shortcuts.md) | iOS Shortcuts capture (P0) |
| [10-design-system.md](10-design-system.md) | Brand, palette, type, components |
| [11-copy-and-tone.md](11-copy-and-tone.md) | Voice, microcopy, naming |
| [12-roadmap.md](12-roadmap.md) | Milestones and exit criteria |
| [13-security-and-privacy.md](13-security-and-privacy.md) | Threat model and promises |
| [14-native-apps.md](14-native-apps.md) | Future iOS/Android, and building without a Mac |
| [15-decision-log.md](15-decision-log.md) | Decisions made, with reasoning |
| [16-web-presence.md](16-web-presence.md) | Domains, canvas-first shell, anonymous capture, SEO |
| [17-shared-infrastructure.md](17-shared-infrastructure.md) | **Read before deploying.** We share sparx's cluster and SQL server: what that constrains, and the pipeline that follows |

## The one-paragraph version

jotdojo is a web-only capture app where a thought lands in under a second — typed, handwritten, spoken, or photographed — and becomes useful later, because agents can read it over a hosted MCP server. It is the bar napkin a business starts on, and the notepad in a bag at cheer practice. It is not a knowledge base and it is not a task manager; its sibling product **kanninja** handles action.

## The code

    apps/web        Next.js PWA + BFF. Canvas-first shell          [M0, working]
    apps/api        Fastify REST v1, the Shortcuts endpoint        [M1]
    apps/mcp        MCP server + OAuth 2.1 authorization server    [M1]
    apps/worker     Recognition pipeline, embeddings, outbox
    packages/domain Entities, services, authorization. The core
    packages/db     Drizzle schema, hand-written migrations, RLS
    infra/          Dockerfiles and Kubernetes manifests

Run it: see the root [README.md](../README.md). `pnpm db:smoke` proves the tenancy
boundary and should stay green — ADR-019 explains why that is not optional.

## Conventions in these docs

- **Must / should / may** are used deliberately. "Must" means a decision is settled — see [15-decision-log.md](15-decision-log.md) before reopening one.
- Code and schema here are illustrative, not authoritative. The repo is the truth once it exists.
- The repo directory is `jotDOJO`, matching the product. It was `noteNINJA` for historical reasons and was renamed on 2026-08-21; anything still saying otherwise is stale.
- The **GitHub repository name is a separate fact from the directory name**, and one place depends on it: the federated credential in the sparx repo at `terraform/envs/azure/jotdojo.tf` builds its subject from `owner/repo`, matched exactly and case-sensitively. There is no remote yet. When the repo is created, check that variable against the real name before the first deploy.
