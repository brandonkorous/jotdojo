# @jotdojo/worker — the async half

Drains the `outbox` table and runs everything the capture path is forbidden from
doing. **The synchronous capture path never calls a model.** If a model is in the
capture path, the capture contract in
[docs/02-product-spec.md](../../docs/02-product-spec.md) is broken.

## What it does

| topic | what | proof |
|---|---|---|
| `block.embed` | embeddings into pgvector, the semantic leg of hybrid search | `worker:smoke` |
| `block.recognize` | ink to HTR, audio to ASR, image to OCR and caption | `recognize:smoke`, `media:smoke` |
| `note.triage` | the agent that reads settled notes and proposes **as comments**, never edits | `triage:smoke` |

Title inference is not a topic. It happens inline when recognition lands, and stops
touching the title forever once a person edits it.

Each provider is independent. A missing one switches off its own feature and nothing else,
and none of them can stop capture (ADR-007).

## How it reaches the database

As `jotdojo_app` — the same restricted, RLS-bound role as every other process — through a
handful of narrow `SECURITY DEFINER` functions, one per thing the worker is allowed to do:
claim a job, store a result, meter it, close the job. They are in
`0009_embedding_jobs.sql`, `0011_recognition_jobs.sql`, `0015_recognition_metering.sql` and
`0024_triage.sql`. That is the worker's entire capability surface, and it is deliberately
readable in one sitting.

The narrowest of them is `app_comment_as_agent`: it can write a comment and nothing else.
That is what stops a model that has been talked into something by note content from doing
anything worse than saying a sentence (ADR-004, ADR-048).

It used to run as a `BYPASSRLS` role. That role no longer exists; see **ADR-024**
for why a role that can silently switch off tenancy is worse than a door that can
only do three things.

## Running it

```sh
pnpm --filter @jotdojo/worker dev     # or just `pnpm dev` at the root
pnpm worker:smoke                     # embeddings, including the failure paths
pnpm recognize:smoke                  # handwriting
pnpm media:smoke                      # photos and voice
pnpm metering:smoke                   # the allowance, and what deferral means
pnpm triage:smoke                     # the agent, and everything it refuses to do
pnpm reread                           # re-read old content with a newer model
```

Needs at least one of `EMBEDDING_PROVIDER`, `VISION_PROVIDER`, `SPEECH_PROVIDER` or
`TRIAGE_PROVIDER` set (`openai`, `azure`, `anthropic`, or `fake` for development).
**With none set it logs why and exits cleanly** — semantic search switches off,
lexical and fuzzy search keep working, and capture is entirely unaffected.
Capture is never refused for infrastructure or billing reasons (ADR-007).

`TRIAGE_PROVIDER` is the only one that is off by default even in the example environment,
because it is the only thing here that speaks to a person unprompted.

Claiming uses `FOR UPDATE SKIP LOCKED`, so any number of replicas can drain
concurrently without blocking each other or handling the same job twice. Failures
back off exponentially and park after six attempts with the error on the row —
a job that has failed six times will not succeed on the seventh, and it should be
findable rather than retrying forever.
