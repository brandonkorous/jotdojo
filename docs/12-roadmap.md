# 12 — Roadmap

Six milestones. Each has an exit criterion that is a demonstrable behaviour, not a checklist.

The ordering principle: **prove the loop before polishing anything.** The single most informative thing that can happen early is one note becoming one kanban plan, and everything before that is in service of it.

## M0 — Foundation

Infrastructure and the boring half of auth.

- Monorepo, four apps, `packages/domain` with the authorization model
- Postgres with RLS on from the first migration. Retrofitting it is much harder
- Google sign-in, users, spaces, memberships
- Next.js PWA shell with Silica `washi` (ADR-011), installable, canvas-first
- Typed notes: create, edit, list, search (lexical only)
- AKS deploy on the shared sparx cluster, plain manifests, TLS from the shared Caddy (ADR-026 dropped Helm; there is no cert-manager and no node pool of our own)
- Dashboard, notes list, and history exist — reached from the chrome, never the landing page
- Layout built for a mirrored tool rail from the start, even though the setting ships in M2

**Not in M0:** the marketing site and anonymous capture. **App first.** See ADR-018.

**One thing that cannot be deferred:** ship the app at `app.jotdojo.com` from the first deploy, with the apex parked on a single static page. Where the PWA installs from is baked into every installed icon; moving it later forces every user to reinstall. An hour now, a migration avoided.

**Exit:** jot on a phone, close the browser, open on a laptop, the note is there.

## M1 — The loop

The milestone that tells us whether any of this is real.

- [x] OAuth 2.1 authorization server: PRM, AS metadata, PKCE, resource indicators, DCR + CIMD
- [x] MCP server, streamable HTTP, read tools plus `comment_on_note`
- [x] Consent screen with per-space grants
- [x] Semantic search: embeddings, pgvector, hybrid fusion
- [x] **iOS Shortcuts**: Jot, Snap, share sheet, capture tokens, guided setup
- [x] Android Web Share Target
- [x] Audit log

**Every line above is built and covered by a smoke suite over real HTTP or real SQL** —
`api:smoke` (16 checks), `oauth:http-smoke` (21), `mcp:smoke` (20), `search:smoke` (18) on
the tenancy of semantic recall, plus `oauth:smoke` and `mcp:check` on the discovery chain.

**What remains is not code. It is the deploy.** The four Dockerfiles and the `infra/k8s`
manifests exist, but nothing has been applied, and until it is, every origin in the chain
is `localhost` — which `mcp:check` says out loud rather than passing quietly:

> Everything is on localhost. That is correct for development and cannot be reached by a
> hosted Claude client.

That single fact is what holds the exit criterion of **this milestone and two others**
(M2 and M4) — all three end with "and Claude can read it", and no Claude client can reach
a laptop. It also gates the only questions that matter next, because every recognition and
embedding path so far is proven against `fake` providers: whether a real model reads real
handwriting, and whether the loop closes end to end.

The deploy is also the moment `app.jotdojo.com` becomes permanent — see ADR-010 and
ADR-018, and the hostname note in [infra/README.md](../infra/README.md). It is a two-repo
change: routing and the TLS allow-list live in the sparx repo.

**Exit:** say "Hey Siri, jot" in a car, then that evening ask Claude on a phone to read the note and build a plan in kanninja — and it works end to end.

**kanninja is live and in daily use, so the far half of this loop already exists.** That makes M1 dramatically cheaper to prove than it would otherwise be: no mocking, no parallel build, no waiting. The only new thing being tested is whether jotdojo's half holds up.

**This is the thesis. If it is unconvincing here, stop and rethink before building ink, billing, or voice.**

## M2 — Ink

- [x] Canvas with pressure and tilt, palm rejection
- [x] All four tools: pen, highlighter, stroke-wise eraser, lasso select
- [x] Lasso select, with move and delete (ADR-033)
- [x] Vector stroke storage, eager incremental upload
- [x] Apple Scribble path surfaced in onboarding (ADR-034)
- [x] VLM-based handwriting recognition, async, with confidence
- [x] Transcript correction UI
- [x] Toolbar placement, flippable for handedness (ADR-025 moved it to one top pill)

**Built and tested** (`ink:smoke` 34 checks, `recognize:smoke` 25, `lasso:smoke` 18):

- The engine is an imperative island — no React render in the stroke hot path.
- `seq`-based eager sync: replays are no-ops, gaps are refused rather than papered over.
- Strokes → SVG → PNG (sharp, no native canvas) → vision model → transcript + confidence,
  with tall pages split into overlapping bands.
- Handwriting becomes searchable through the same tsvector as typed text, so a note is
  findable by words nobody typed.
- MCP renders ink as `> [handwritten, confidence 0.82]`, and says so explicitly when a
  page is unread or unreadable rather than letting it look empty.
- A person's correction is ground truth and is guarded at claim time *and* store time.

**Exit:** handwrite a page on an iPad, and ten seconds later Claude can quote it back accurately over MCP.

**The exit criterion is NOT met and cannot be until M1's is.** Everything above is proven
against `VISION_PROVIDER=fake`, which cannot read handwriting — it proves the pipeline and
says nothing about accuracy. Two things are still unmeasured: whether a real model reads
real handwriting well enough, and whether any of it reaches a Claude client, which needs
the deploy M1 is still waiting on.

## M3 — Spaces and money

The first milestone where revenue is possible. Deliberately after the loop is proven, because pricing something unproven is guesswork.

- [x] Shared spaces, invites, owner/member roles (ADR-035, `members:smoke` 29 checks)
- [x] Family and Team plans, Stripe, per-space billing (ADR-038, `billing:smoke` 35)
- [x] Anonymous capture, server-side from the first keystroke (ADR-039, `anon:smoke` 34)
- [x] Marketing site at the apex with the live-canvas hero (ADR-040, `site:smoke` 44)
- [x] Usage metering on recognition, deferred not refused (ADR-036, `metering:smoke` 19)
- [x] Review inbox and revert (ADR-037, `review:smoke` 18)
- [x] `notes:append` and `notes:edit` scopes with per-space grants (covered by `mcp:smoke`)
- [x] Solo plan, and free reads / paid writes enforced (ADR-042, ADR-043)

**Two gaps found while writing the pricing page, one closed and one open.** The free tier
could write over MCP — the fence docs/01 calls its most important decision was never
implemented — and `solo` was not a plan the schema would accept. Both are fixed. **Seat
counts are still not enforced:** Family says six and Team says five, and nothing stops a
seventh, because Team's per-member overage needs quantity-based subscriptions to bill
honestly.

**Exit:** a family of four shares a space, each member's own Claude reads it, and someone has paid us money.

## M4 — Voice and images

- [x] In-app audio recording with the Safari codec fallback
- [x] Server-side transcription with word timestamps
- [x] Camera capture, OCR plus VLM description
- [x] Both wired into the same recognizer interface

**The architecture claim held.** Adding photos required **one migration and zero table
changes** — `0013_recognize_all_kinds.sql`, which widens the worker's claim function to
dispatch on `blocks.kind`. `blocks` already allowed `image`, `media_assets` already had
`blob_url`, `mime_type`, `byte_size` and `width`/`height`, and nothing in `0000_init.sql`
moved. That is exactly what docs/07 said should happen, and it is the first time it has
been tested.

**Built and tested** (`media:smoke`, 36 checks):

- `packages/storage` — a blob seam with an Azure SAS driver and a local filesystem driver.
  Bytes never pass through our servers on Azure: the browser gets a time-limited upload
  URL and PUTs straight to Blob. The local driver *does* proxy through the API, which is
  why it refuses to resolve when `NODE_ENV=production`.
- Reserve → upload → finalise, as three steps, so a capture interrupted mid-upload leaves
  a visible gap rather than nothing.
- Signed URLs are real HMACs: tampered, expired and unsigned requests are all refused, and
  path traversal is checked twice.
- Photos go to the same recognizer as ink and land in the same four fields, so what was
  written on a napkin becomes searchable through the same tsvector as typed text.

**Exit:** photograph an actual bar napkin, and Claude reads back what was written on it.

**Voice** (`packages/speech`): Whisper over OpenAI or Azure, `verbose_json` with word
granularity so the timestamps are kept the first time — getting them back later means
paying to transcribe the audio twice. Confidence is derived from `avg_logprob` rather than
invented, and the mapping is written down where it can be argued with.

`MediaRecorder`'s `mimeType` is a demand, not a request: pass a type the browser cannot
produce and the constructor throws, and the answer differs by browser *and* by Safari
version — WebM/Opus only arrived in 18.4. `apps/web/lib/recorder.ts` asks in preference
order and keeps whatever the browser actually chose, because the transcription provider
has to be told what it is being handed.

**One queue, three senses.** Ink and photos go to a vision model, audio to a speech model,
and `runRecognitionCycle` dispatches on `blocks.kind`. A modality whose provider is
missing is **failed explicitly, not left pending** — a spinner that never resolves is
indistinguishable from a bug, and the artifact is safe either way.

**Not met yet.** Everything is proven against the `fake` providers, which read and hear
nothing. Whether real recognition and real transcription are any good is still completely
unmeasured, and none of it has reached a Claude client.

## M5 — Alive

- [x] Triage agent: scheduled pass proposing actions as comments (ADR-048, `triage:smoke` 42) — Team only, off until an owner turns it on, and off stops work already queued
- ~~Suite gateway: one account, one MCP endpoint spanning jotdojo and kanninja~~ — **deferred by the vision doc**, not by scheduling. docs/00 says do not build a shared account layer before there is a customer who wants both products, and ADR-002 keeps them separate
- [x] Re-recognition of old content with newer models (ADR-046, `reread:smoke` 24) — `pnpm reread`, dry run by default, scoped with `--space`
- Whatever the first fifty users actually asked for, which will be more informative than this list

**Exit:** users open the app to see what their agent noticed overnight.

## Deliberately unscheduled

Real-time collaborative editing (CRDTs), native apps (see [14-native-apps.md](14-native-apps.md)), public share links, import from other apps, browser extension, rich text, templates, reminders.

Each is a reasonable feature. None is "the thought lands in under a second."

## The honest risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Capture is not fast enough and the founder keeps using Apple Notes | **Fatal** | M1 Shortcuts. Instrument time-to-captured. Treat regressions as P0 bugs |
| OAuth 2.1 server takes far longer than estimated | High | It is the hardest work in the project. Budget generously; consider Entra External ID or WorkOS if it stalls past two weeks |
| Handwriting recognition accuracy disappoints | Medium | Scribble path covers most real need. Confidence display sets expectations. MyScript is the escape hatch |
| Notion or Obsidian ships remote MCP | Medium | Expected, not preventable. Our answer is multimodal capture and attribution, not the endpoint itself |
| Azure fixed costs outrun revenue | Medium | Portable containers. Container Apps is a one-week migration if needed |
| Nobody wants this | High | M1 exists to find out cheaply, before ink, billing, or voice are built |

---

## Where the work actually stands

_Updated 2026-08-21._

| Milestone | Code | Exit criterion |
|---|---|---|
| M0 Foundation | complete | **not met** — needs the deploy |
| M1 The loop | complete | **not met** — needs the deploy |
| M2 Ink | complete | **not met** — needs the deploy and a real vision model |
| M3 Spaces and money | complete | not met — nobody has paid us, but now they CAN (ADR-049) |
| M4 Voice and images | complete | **not met** — needs the deploy and real providers |
| M5 Alive | code complete; suite gateway deferred by ADR-002 | **not met** — needs the deploy and a real reasoner |

**One fact explains most of that column: nothing has been deployed.** Four exit criteria
end with "and Claude can read it", and no hosted client can reach a laptop. The second
fact is that every recognition, embedding, triage and billing path is proven against
`fake` providers, which read nothing, hear nothing, judge nothing and take no money — so
the pipeline is proven and the *quality* of any of it is still entirely unmeasured.

**Everything in M0-M5 that is ours to build is now built**, and the suite gateway is
deferred by decision rather than by scheduling. What is left before any of it is real is
the deploy and four `fake` providers replaced by ones that read, hear, think and take
money.

**The last hole was the one nobody could have found in a suite.** Billing had a provider
seam, entitlement rules, SQL doors and 35 passing checks, and there was still no way for a
person to pay: no checkout button anywhere, and no HTTP caller for `applyBillingEvent` at
all. A card could have been charged and the space would have stayed free. Fixed in ADR-049;
found by opening the account page and looking for the button.

**The triage agent is the one to be suspicious of.** Its pipeline is proven — queued when a
note settles, claimed, commented, metered, and stopped dead when somebody switches it off —
but the `fake` reasoner cannot judge anything, so whether a real model's remarks are worth
reading is completely unmeasured. The prompt in `packages/reason/src/provider.ts` is a
first draft nobody has tuned against real notes, and the failure mode is not a crash: it is
a well-behaved agent that says something obvious on every third note until somebody turns
it off. That is why it is opt-in.

**What opening a browser turned up.** The suites were green and the canvas still had three
defects, one of them serious: handwriting was not drawn when a note was opened, and
reaching for the pen started a SECOND ink block and orphaned the first (ADR-047). No
suite would have caught it — every layer underneath behaved correctly, and the flaw was in
what the component asked for. Look at the thing.

**What the marketing site turned up.** Writing an honest pricing page is a good way to find
out what a product does not actually do. Three things surfaced: the free tier could write
over MCP (fixed, ADR-042), `solo` was not a sellable plan (fixed, ADR-043), and seat counts
are not enforced (open, and the page sells only the included seats because of it).

**M0 — code complete; the exit criterion is not met.** Monorepo, Postgres with RLS from
the first migration, Google sign-in, canvas-first PWA on the Silica `washi` theme, typed
notes, dashboard and history.

The one M0 line item still outstanding is the deploy, and it is the same one holding M1,
M2 and M4: "jot on a phone, close the browser, open on a laptop" cannot be demonstrated
against `localhost`. The Dockerfiles and manifests are written; nothing has been applied.

**M1 — code complete; the exit criterion is not met.**

Built and tested:
- Capture: capture tokens, `POST /v1/capture` (idempotent, rate limited, ~45ms), token
  management UI, the iOS Shortcut recipe, the Android Web Share Target.
- OAuth 2.1 authorization server: RFC 8414 metadata, DCR **and** Client ID Metadata
  Documents (SSRF-guarded), PKCE S256, RFC 8707 resource indicators, refresh rotation
  with reuse detection, per-space consent, RFC 7009 revocation.
- MCP server on `:3402`: RFC 9728 protected-resource metadata, nine namespaced tools,
  audience-bound token validation. Verified with a real MCP client over real HTTP.
- Chrome rebuilt as two glass pills plus a ⌘K command palette (ADR-022).

- Hybrid search: lexical + semantic + fuzzy, fused with RRF, with a distance floor
  so an unmatched query says so instead of returning the notebook (ADR-023).
- The worker: `outbox` drain with `FOR UPDATE SKIP LOCKED`, exponential backoff,
  autosave coalescing, and three narrow SECURITY DEFINER doors in place of the
  `BYPASSRLS` role that 0000 created (ADR-024).
- Connections UI: every agent that can reach your notes, what it can do, when it last
  did, and a revoke that takes effect on the next request.

**Everything M1 asked for is built, and none of it has left this machine.**

Twenty smoke suites, 505 checks, all green:

| suite | checks | what it proves |
|---|---|---|
| `db:smoke` | 9 | the RLS tenancy boundary |
| `api:smoke` | 16 | the capture endpoint over real HTTP |
| `oauth:smoke` | 26 | PKCE, audience binding, refresh rotation, grants |
| `oauth:http-smoke` | 21 | discovery, DCR, token endpoint contract |
| `mcp:smoke` | 22 | a real MCP client with a real OAuth token, reads **and writes** |
| `search:smoke` | 18 | outbox → worker → pgvector → fusion, and that it does not cross spaces |
| `worker:smoke` | 14 | the drain loop, including what it does when the provider is down |
| `ink:smoke` | 40 | stroke storage, replay, gap refusal, tenancy, correction |
| `recognize:smoke` | 25 | strokes → PNG → model → transcript → searchable |
| `media:smoke` | 36 | photos and voice: reserve → upload → finalise → read → searchable |
| `mcp:check` | 21 | the OAuth discovery chain, walked as a client walks it |
| `lasso:smoke` | 25 | lasso containment, marquee bounds, and that a move keeps pressure and tilt |
| `marks:smoke` | 28 |
| `reread:smoke` | 24 | reading old pages with a newer model, and that a correction is never one of them | the markdown toolbar: toggling off, the caret, and headings as one setting |
| `members:smoke` | 29 | invites, roles, and that an outsider sees nothing until they accept |
| `metering:smoke` | 19 | over quota, capture still works and the reading is deferred, not failed |
| `review:smoke` | 18 | agent changes are attributed, listed, and revertible by a person only |
| `billing:smoke` | 35 | the webhook signature contract, and that a failed card keeps the plan |
| `anon:smoke` | 34 | capture before an account, and that claiming it loses nothing |
| `site:smoke` | 45 | the apex is crawlable and the app is not, and a draft survives a closing tab |

**Then the real test of the thesis:** connect a Claude client to the MCP server and run
the whole loop — "Hey Siri, jot" in a car, then that evening ask Claude to read the note
and build a plan in kanninja. That needs the server reachable from wherever the client
runs, which is an AKS deploy. That is no longer undecided: ADR-026 settled the shape, and the
four Dockerfiles and `infra/k8s` manifests are written and waiting to be applied.

**The first push to main, 2026-08-22.** Both workflows failed, and the two
failures are different in kind.

- **Release** stopped at `azure/login`: no federated identity credential matches
  `repo:brandonkorous/jotdojo:environment:prod`. That is the sparx-side
  Terraform not applied yet, first item on the deploy checklist in docs/17. The
  deploy refused rather than half-shipping, which is the design working.
- **CI** failed on `metering:smoke`, and that one was ours. **Fixed 2026-08-22.**
  The over-quota check asserts a reading is DEFERRED rather than failed and got
  `{"claimed":1,"read":0,"failed":1}` — the third instance of a suite counting
  jobs on the GLOBAL outbox queue rather than its own.

  The first diagnosis written here blamed the section immediately above it. That
  was wrong. The failed job belongs to `recognize:smoke` or `media:smoke`, which
  run just before this suite in CI and leave AUDIO blocks behind; this suite
  passes **no transcriber at all**, so claiming one throws "no provider" and
  lands as `failed`. The `drain()` at startup could not prevent it, because
  recognition is queued with a 30-second quiet period: a job enqueued just before
  the suite began is not yet claimable when the drain runs, and is claimable by
  the time the assertion happens. That is why it passed locally and failed on a
  slower runner.

  The fix closes foreign `block.recognize` jobs immediately before every measured
  cycle. It matches on the payload's `blockId` rather than joining to `blocks` —
  that table is FORCE ROW LEVEL SECURITY and the suite's connection sets no
  actor, so a subquery against it returns nothing and a `NOT EXISTS` built on one
  matches every row, closing the suite's own work. That mistake was made and
  caught here; the note is what stops it being made again.

- **The next CI run failed differently, which is progress.** `metering:smoke`
  passed and the build reached the HTTP suites, where `smoke-capture.ts` failed
  its latency budget at 341ms against 300ms. That assertion timed the FIRST
  request to reach a freshly started server -- a cold pool and a cold JIT, paid
  once by the harness and never by a person, whose server has been up for days.
  It now takes a median of three warm samples, which on the same machine reads
  18ms. A budget worth keeping; a measurement that was never measuring it.

**The first deploy to reach a container, 2026-08-22.** The Azure identity blocker
cleared -- `azure/login` succeeded, images pulled, and both migration Jobs
completed -- so the release got further than any before it and found the next
thing.

All four services sat in `CreateContainerConfigError`, which usually means a
missing Secret and this time did not: `jotdojo-secrets` and `jotdojo-config`
were both present and correct. The container state said what the events did not:

    container has runAsNonRoot and image has non-numeric user (jotdojo),
    cannot verify user is non-root

Every Dockerfile creates its user with `adduser -S -u 1001` and then writes
`USER jotdojo` -- a NAME. Kubernetes cannot verify a named user is non-root, so
`runAsNonRoot: true` refuses the container before anything starts. Nothing
crashlooped because nothing ever ran.

Fixed as `USER 1001:1001` in all four images rather than `runAsUser: 1001` in
all four manifests: the uid is already declared one line above in each
Dockerfile, and one source of truth beats four copies of a number.

**The first deploy to actually run, 2026-08-22.** With the user numeric, api, mcp
and web came up 1/1 and the worker crashlooped on
`Cannot find package '@jotdojo/reason'`.

The triage agent shipped a new workspace package and nothing added it to
`worker.Dockerfile`. Typecheck passed, sixteen suites passed, CI went green --
because every one of those runs against the workspace, where the package is
present. Nothing in the repo was in a position to notice, and production was the
first thing that looked.

`pnpm images:check` now compares each image against the transitive closure of
its app's declared dependencies. It is deliberately strict about packages only
imported as TYPES today: `@jotdojo/billing` was an `import type` in domain,
stripped at transpile, missing from three images and harmless until somebody
imports a value from it. All three now carry it. A rule with an exception list
gets an entry added instead of being obeyed.

**Known gaps, named rather than left to be discovered:**
- Search quality has never been measured against a real embedding model. The suites run
  `EMBEDDING_PROVIDER=fake`, a hash projection with no semantics, which proves the
  plumbing and nothing about relevance. `EMBEDDING_MAX_DISTANCE` in particular is a
  starting value, not a tuned one.
- Only `position 0` text blocks exist, so embedding is one vector per note. That is
  correct for M1 and wrong from M2, when a long note should be retrievable by the
  paragraph that answers the question rather than by its opening line.
- Nothing re-embeds on a model change yet. The `model` column makes it detectable; the
  backfill job that acts on it is not written.
