# 15 — Decision log

Decisions that are settled, with the reasoning. Reopening one is fine; doing it without reading the entry is not.

---

### ADR-001 — Hosted remote MCP, not local
**Settled.** The MCP server is hosted at `mcp.jotdojo.com`. A stdio shim exists for convenience but is a proxy, not the real thing.

**Why:** every competitor's agent access is local — Amplenote's desktop app, Obsidian's REST plugin, the Apple Notes AppleScript servers — and all of them require a computer that is on. If your notes live on your phone, that entire ecosystem is unavailable. Hosted MCP is the only shape that serves a phone-first user, and it is the whole wedge.

---

### ADR-002 — jotdojo and kanninja stay separate products
**Settled.** Not merged, not one app with two modes.

**Why:**

1. **A note does not always become an action.** Much of the value is remembering, not doing. Forcing every capture toward a board would corrupt the capture reflex — people would hesitate before jotting things that are not tasks, which is exactly the hesitation we exist to remove.
2. **MCP tool budgets are real.** Agents degrade as tool counts climb. Two focused servers of eight to ten tools outperform one merged server of twenty-plus. Separation is a technical advantage here, not just a product preference.
3. **Different audiences.** A family buying shared notes will never buy a kanban board.
4. **The composition already works without merging.** An agent holding both servers does the whole flow with zero integration code on our side.

**What we do instead:** a shared identity and gateway layer, later, at M5. Not before there is a customer who wants both.

**Explicitly rejected:** an in-app "send to kanban" button. It hardcodes one destination and contradicts the thesis that the agent decides what a note should become — some become cards, some become calendar events, some become an email, most become nothing.

---

### ADR-003 — Server is the source of truth, local storage is a cache
**Settled.**

**Why:** Safari evicts script-writable storage under pressure and after disuse, and caps the Cache API around 50MB. Any design where the local copy is authoritative will eventually lose someone's notes, and that day the product dies. Applies to anonymous users too — see ADR-009.

**Consequence:** eager incremental upload of stroke batches, audio chunks, and keystroke debounce. No CRDTs in v1.

---

### ADR-004 — Comment by default, edit by grant
**Settled.** An agent's normal output is a comment. The `notes:edit` scope is off until explicitly granted per space. Every mutation is attributed and reversible; delete is always soft.

**Why:** prompt injection through note content is unpreventable, so the mitigation must be that agent writes are non-destructive and reviewable rather than that they are somehow safe.

---

### ADR-005 — iOS Shortcuts is P0
**Settled.** Ships in M1 alongside the MCP server.

**Why:** iOS Safari has no Web Share Target, no Siri, no widgets. Without Shortcuts, capture is "unlock, find icon, wait, tap, type" and we lose to Apple Notes regardless of how good everything else is. Shortcuts gives Siri, the Action Button, the share sheet, and automation for the cost of one endpoint.

---

### ADR-006 — Free tier gets read-only MCP
**Settled.**

**Why:** the instinct is to paywall MCP because it is the differentiator. That is wrong. The product is unbelievable until seen — someone has to watch Claude read their napkin photo. Gating that behind a card kills the word-of-mouth that is our only distribution. The paywall sits where "neat demo" becomes "part of my workflow," which is also where our costs begin.

---

### ADR-007 — Meter recognition, never note count
**Settled.**

**Why:** recognition is the actual COGS; storing text is not. Capping notes is hostile to the exact behaviour we need most. **Capture is never refused for billing reasons** — over-quota recognition is deferred, and we say so plainly.

---

### ADR-008 — Canvas-first app shell
**Settled.** `app.jotdojo.com` opens a live writable canvas. No dashboard, no note list on load, no create button.

**Why:** the capture contract. Every click between opening the app and writing is a click during which a thought can be lost.

---

### ADR-009 — Anonymous capture is server-side, not local-only
**Settled.** Anonymous notes get a server-side space from the first keystroke, keyed by an opaque token in `localStorage`.

**Why:** local-only anonymous notes would be evicted by Safari and lost. That is not an edge case, it is the documented behaviour of the platform. Losing an anonymous user's first note is the worst possible first impression, and "never lose a thought" cannot have an asterisk. Server-side also makes claiming at sign-in a single ownership update instead of a merge, and sidesteps cross-subdomain storage isolation between the marketing hero and the app.

---

### ADR-010 — Marketing at the apex, app at `app.`, hero is a live canvas
**Settled.** `jotdojo.com` is the crawlable marketing site and its hero is a real working canvas. `app.jotdojo.com` is the app and never shows marketing. The PWA installs from `app.`.

**Why:** an app shell at the root wastes our highest-authority URL and will never rank, while serving crawlers different content than users is cloaking. Making the hero a live canvas satisfies both requirements honestly — and letting someone capture something is the best marketing a capture app has.

---

### ADR-011 — Silica UI, the house `washi` theme, plus a registered `agent` colour
**Settled. Revised after reading kanninja's live brand kit.**

An earlier draft chose Silica's `dune` preset. That is superseded: kanninja already publishes exact house values, and "close enough" is the wrong standard when the sibling has real ones.

**The house palette:** Vermillion `#E0432F` (the seal — *one per screen*), Sumi `#0E0F12` (the ink), Washi `#F8F4EC` (cream paper, the page), Snow `#FBFAF6` (elevated surfaces). Fraunces display, Inter body, JetBrains Mono. jotdojo declares these as a Silica theme named `washi` rather than picking a preset.

**Why:** two products from one workshop should look like it — and the palette happens to be exactly right for a product about napkins and notepads, since washi is literally paper and sumi is literally ink. `--depth: 0` because ink casts no shadow; `--noise: 1` for paper grain.

**The vermillion rule is inherited and binding:** one seal per screen. It is not a button colour.

The `agent` colour is registered through Silica's open colour list rather than hardcoded, so **human ink is sumi and agent ink is `agent`** (indigo) across every component variant, in both modes, automatically. Indigo is cool against washi's warmth and unmistakable against vermillion, so agent content reads as visiting the page and never competes with the seal. Never colour alone — every agent element also carries a text label.

---

### ADR-012 — Toolbar placement is responsive and user-selectable
**Settled.**

Two pieces of floating chrome, not one:

- **Tool rail** (vertical, handed side): pen, colours, text box, mic, camera, and the user avatar / account dropdown at its foot.
- **Nav bar** (opposite top corner): dashboard, history, search.

A dashboard, notes list, and history all exist — they are simply never the landing page. They open as sheets over the canvas and return to it.

**Setting: *Toolbar side* — Left / Right**, defaulting by form factor, overridable by anyone.

| Form factor | Default |
|---|---|
| Desktop | Right |
| Tablet + stylus | **Left** |
| Phone | Rail becomes a bottom bar; the setting picks which end the avatar sits at |

**Why left on tablet:** a right-handed writer's hand and forearm cover the right side. GoodNotes, Notability and Procreate all keep primary tools left for exactly this reason. A left-handed user flips it.

The flip also moves the nav bar to the opposite corner, anchors popovers **away from the writing hand**, and slides sheets in from the rail side. Setting ships in M2; the layout is built mirror-ready from M0, because retrofitting a mirrored layout costs far more than designing for it.

---

### ADR-013 — Google OAuth for humans; jotdojo is its own OAuth 2.1 server for agents
**Settled.**

**Why:** every target audience is already on Google, which removes passwords, resets, and account recovery from the roadmap entirely. Separately, MCP clients run OAuth **against us**, not against Google — so we must be an Authorization Server and a Protected Resource, with Google federated behind as the upstream IdP. Support both DCR and Client ID Metadata Documents, since DCR has been downgraded to MAY and now carries a deprecation warning.

---

### ADR-014 — Markdown is the note format
**Settled, and load-bearing.**

**Why:** agents read markdown natively, and it makes export credible. A product people can leave is a product people trust enough to join. Nothing about this is negotiable.

---

### ADR-015 — Native apps deferred, but not because we lack a Mac
**Settled for now. Revisit at M3.**

**Why:** iOS apps build and submit fine from Windows via Expo EAS or Codemagic — $99/year plus cloud build minutes, no Mac at any point. We defer because Shortcuts covers the capture gap and a second client would halve the pace of everything else, not because it is impossible. Revisit against the trigger list in [14-native-apps.md](14-native-apps.md).

---

### ADR-016 — jotdojo MCP tool names are namespaced against kanninja
**Settled.**

**Rule:** every jotdojo tool name ends in `_note`, `_notes`, or `_spaces`. No bare verbs.

**Why:** kanninja is live and exposes 42 tools, including the generic names `search`, `list_comments`, and `add_comment`. An agent doing the flow we care about holds *both* servers, so a bare `search` on our side is a coin flip the agent will sometimes lose.

This also sharpens ADR-002. The agent already carries 42 tools from kanninja before jotdojo speaks; a merged server would ship 50+ and be worse at both jobs. jotdojo holds to ten.

---

### ADR-017 — API key path alongside OAuth
**Settled.** Support `JOTDOJO_API_KEY` for terminal agents, matching kanninja's `KANNINJA_API_KEY`, with OAuth for web clients.

**Why:** house consistency. Someone already running both from a terminal should configure them the same way. Same identity model underneath — the key is another credential resolving to a user and a grant.

---

### ADR-018 — Build the app first; marketing site deferred
**Settled.** M0 is the app only. The marketing site and anonymous capture move to M3.

**Why:** there is no traffic to convert yet, and the founder is user one. A marketing site optimises for an audience that does not exist while the thing it advertises is unproven. ADR-010 still stands as the *shape* — apex for marketing, `app.` for the app, live-canvas hero — it is simply built later.

**The one part that cannot wait:** deploy the app to `app.jotdojo.com` from the first deploy, with the apex parked on a static page. The PWA install origin is baked into every installed home-screen icon; changing it later forces every user to reinstall. An hour now avoids a migration.

---

### ADR-019 — The application connects as a restricted role, and RLS is proved by a test
**Settled. Learned the hard way during M0.**

Two bugs, found by `packages/db/scripts/smoke-rls.ts` on its first run, both of which
would have shipped:

1. **The app connected as `postgres`.** PostgreSQL exempts superusers and `BYPASSRLS`
   roles from every policy, and exempts the table owner unless `FORCE ROW LEVEL
   SECURITY` is set. So every policy existed, read correctly, and enforced nothing.
   Bob could read Alice's notes.
2. **Every policy was written with `USING` only.** That is a read predicate.
   PostgreSQL needs `WITH CHECK` for rows being written, and a policy with neither
   denies `INSERT` outright. This was invisible until bug 1 was fixed.

**Decisions:**

- **The application connects as `jotdojo_app`** — no DDL, no `BYPASSRLS`, not the owner.
  Migrations run separately as the owner via `DATABASE_ADMIN_URL`. This applies to every
  environment; an admin connection string in production would silently disable tenancy.
- **Account creation goes through one `SECURITY DEFINER` function**,
  `app_provision_user()`. Sign-in happens before an actor exists and so can satisfy no
  policy — but the alternative, a blanket `INSERT` grant on `users`, `spaces` and
  `space_members`, would hand the app exactly the privilege the policies exist to
  withhold. One reviewable door instead.
- **`pnpm db:smoke` is a required check.** A policy that is enabled but wrong looks
  exactly like one that is right until something checks. Eight assertions, two users,
  and every cross-space read must come back empty or refused.

**The general lesson, worth keeping:** security controls that are declared but never
exercised are indistinguishable from ones that work. Anything load-bearing gets a test
that would fail if it were removed.

---

### ADR-020 — A test must distinguish a refusal from a crash
**Settled. Learned during M1, and it nearly cost us the refresh-reuse defence.**

`app_resolve_oauth_token` revokes a whole token family when a rotated-away refresh
token is replayed — the core of rotation-reuse detection. Its `RETURNS TABLE` output
names (`family_id`, `client_id`, `user_id`) are plpgsql variables inside the body, so
an unqualified `WHERE family_id = ...` was **ambiguous and raised at runtime**. The
family was never revoked.

It looked fine from outside. Replaying a refresh token still produced an error, and the
smoke test asserted only that *something* was thrown — so a SQL crash was indistinguishable
from the security check firing. The test passed while the control did nothing.

**Decisions:**

- **Every column reference inside a `SECURITY DEFINER` function is table-qualified.** The
  output-name collision is invisible until the branch executes, which for a security
  fallback may be never in normal use.
- **Negative assertions check the error TYPE**, not merely that one occurred. The smoke
  helper is `refused()`, which requires a `DomainError`; anything else is reported as
  "crashed rather than refused" and fails the check.

**The general lesson, and the sharper form of ADR-019:** it is not enough to exercise a
control. The test has to be able to fail for the *right* reason and pass for the *right*
reason. "Something threw" is not an assertion about behaviour.

---

### ADR-021 — Two client identifiers, kept distinct
**Settled. Found by the MCP smoke test.**

    oauth_clients.client_id   text, "jd_client_204af..."   the APPLICATION
    mcp_clients.id            uuid                          THIS USER'S connection to it

The agent actor carried the first and wrote it into `comments.agent_client_id` and
`audit_log.mcp_client_id`, which are uuid foreign keys to the second. Every agent
**write** failed with `invalid input syntax for type uuid`; every agent **read** worked.
The server looked healthy right up until a tool tried to attribute something.

**Decision: keep both, named for what they are.** The agent actor carries `clientId`
(the application, for display and rate limiting) and `clientRecordId` (the connection,
which every attribution column references). Collapsing them would be simpler and wrong:
attribution should name *the connection a person granted*, so revoking one person's
Claude leaves another person's agent comments intact and correctly attributed.

**The lesson, and it is the third time this shape has appeared:** reads exercised the
happy path and writes did not. A test that only reads will report a healthy server.
`mcp:smoke` now writes — comments, appends — and asserts the attribution that comes
back, not merely that the call returned.

---

### ADR-022 — Chrome is two glass pills and a ⌘K palette
**Settled.**

The canvas runs edge to edge. Chrome is a floating tool rail and a small ⌘K affordance,
both using Silica's `glass` class — nearly invisible over a still canvas, resolving into
a surface only when content moves under them. No borders: a hairline would reassert the
panel the glass exists to avoid.

**Search, notes, dashboard and settings live in the command palette**
(`CommandPalette` from `@wizeworks/silicaui-react` — ⌘K, filter-as-you-type, arrow
navigation, grouped items), not in a toolbar. A capture app should spend its screen on
the thing being captured; every navigational affordance that earns a permanent pixel has
to justify it, and none of these do.

Recent notes are preloaded into the palette so filtering is instant with no round trip.
When a collection outgrows that, the palette gains a "search everything" command backed
by `searchNotesAction` rather than growing a second UI.

**Addendum, after the chrome disappeared.** Silica ships `glass` as `.glass[class]` —
two selectors' worth of specificity. That outranks Tailwind's single-class `.absolute`,
so `class="glass absolute"` resolves to `position: relative`, and both pills fell to
their static position: after a `100dvh` textarea inside an `overflow: hidden` shell.
They rendered, they were in the DOM, they were simply below the fold and clipped.
Nothing errored and nothing logged.

**Rule: an element carrying `glass` cannot be positioned by a Tailwind utility.**
Positioning for all chrome lives in `.jd-chrome[class][class]` in `globals.css` — doubled
deliberately, because merely *matching* `glass` would work today only by source order and
would break the day Silica reorders its output. The offset utilities (`bottom-3`,
`left-1/2`, `top-1/2`) are untouched by `glass` and still work normally.

This is the CSS instance of the pattern the rest of this log keeps recording: a control
that is declared but silently overridden looks exactly like one that works. Typecheck,
build and every smoke suite were green while the entire chrome sat off screen.

---

### ADR-023 — Search stays in Postgres. No Typesense, no Elasticsearch.
**Settled.**

The question was whether to put retrieval behind a dedicated search engine. The answer
is no, and the deciding argument is not performance or cost.

**Tenancy.** Every guarantee jotdojo makes about who can read a note is a row-level
security policy in Postgres, enforced by the database on a connection that cannot bypass
it. A search engine has no idea what a space is. Tenancy there becomes a `filter_by`
clause the application must remember to attach to every query — and we have already
learned, expensively, what that class of control is worth: RLS sat inert for a whole
session because the app connected as a superuser, and every policy still read as
enforced. A filter that one code path forgets is the same bug with no backstop at all.
Moving retrieval out of Postgres means moving the tenancy boundary out of Postgres, into
application code, for a product whose entire premise is that you can safely let a model
read the things you write down without thinking.

**Nothing else about it is close, either.** A search engine is a second stateful service
to run on AKS, size, back up, secure and keep consistent with the source of truth. It
holds its index in RAM, so cost scales with corpus rather than traffic. It needs its own
replication story. And the corpus it would be serving is one person's notes — thousands
of short documents, not millions.

**What we lose, and what replaced it.** The real thing Typesense gives you for free is
typo tolerance; `websearch_to_tsquery` is exact after stemming, so "kubernets" finds
nothing. That is a genuine gap for a product people type into one-handed on a phone, so
`pg_trgm` fills it as a third recall strategy alongside lexical and semantic
(`0010_fuzzy_search.sql`). We also lose sub-50ms faceted search over millions of
documents, which we do not have and would not want to design for now.

**Retrieval is therefore three strategies fused with Reciprocal Rank Fusion**
(`packages/domain/src/search.ts`): tsvector for the words you typed, pgvector for the
meaning you meant, trigram for the word you meant to type. RRF because ts_rank, cosine
distance and trigram similarity are three incomparable scales — any weighted sum of them
is a number with no meaning, tuned by superstition. RRF uses only rank, needs no
calibration, and survives adding a fourth strategy.

**Revisit when** a single space holds millions of notes, or someone wants faceted
filtering across a large shared corpus, or search latency becomes the thing people
complain about. None of those are true, and the first two may never be.

---

### ADR-024 — The worker gets three narrow doors, not a BYPASSRLS role
**Settled. Reverses part of 0000_init.sql.**

`0000_init.sql` created a `jotdojo_worker` role with `BYPASSRLS`, reasoning that
embedding legitimately operates across spaces. `0009_embedding_jobs.sql` deletes that
role.

The reasoning that created it was sound and the conclusion was still wrong. A role that
bypasses RLS is a loaded gun in the cluster: one mis-pasted connection string — a Helm
value, a Key Vault secret, a `.env` copied from the wrong place — silently disables
tenancy everywhere, and *nothing fails*. Every policy still reads as enforced. That is
not a hypothetical; it is exactly the bug we shipped and caught in M0, and the only
reason we caught it was a test that asserted the boundary rather than assuming it.

The replacement is three `SECURITY DEFINER` functions — `app_claim_embed_jobs`,
`app_store_embedding`, `app_finish_embed_job` — and the worker connects as the same
restricted `jotdojo_app` role as everything else. Point the application at the worker's
credentials by mistake and nothing happens, because those credentials confer the ability
to claim an embedding job and nothing more.

Two details are load-bearing:

- `app_store_embedding` reads the space **from the block**, not from its caller, and
  refuses a mismatch. A wrong `space_id` from the worker cannot file one tenant's vector
  under another tenant's space, which is the one way an embedding could become
  retrievable by the wrong person.
- `app_claim_embed_jobs` is written as sequential plpgsql statements rather than one
  statement with data-modifying CTEs, because two CTEs updating the same `outbox` row in
  a single statement is documented as unpredictable — the second update silently does
  nothing. Every column in it is table-qualified, for the ADR-020 reason: `RETURNS
  TABLE` names are plpgsql variables, and an unqualified `space_id` resolves to the
  output variable instead of the column.

**Cost:** background work now has a fixed, reviewable capability surface instead of an
open one, and widening it takes a migration someone has to read.

---

### ADR-025 — One pill, top centre, search first
**Settled. Supersedes the two-pill layout in ADR-022 and the rail placement in ADR-012.**

ADR-022 put a tool rail down one side and a small ⌘K affordance in a corner. For four
tools, an avatar and a search box, that was two pieces of furniture for a handful of
controls — and it put search where nothing else was, so the one thing people reach for
most was the one thing with no weight on the screen.

**Now: a single glass pill along the top edge.** Search leads and takes most of its
width, because a wide field centred on the top edge is where every application anyone
has ever used has trained them to look. The four tools and the avatar follow, behind a
seam.

The search field is a **button styled as a field**, not an input. A real input here would
be a second place to type on a page whose entire premise is that the cursor is already
in the canvas; clicking it opens the palette and focus never leaves the note.

**The bottom bar is gone, including on phones.** ADR-012 sent phones to a bottom bar for
thumb reach, which was right for a drawing app and wrong for this one: a software
keyboard covers the bottom of a phone exactly when someone is typing, which is the whole
time they are using jotdojo. `useToolbarPlacement` and its viewport measuring went with
it — there is nothing left to measure.

**The left/right preference survives and still means what it meant** — keep the chrome
clear of the hand holding the pencil. It now shifts the one pill along the top edge.
`auto` centres it. The account setting is relabelled "Toolbar position".

**Second colour bug from the same family as the specificity one.** `glass` tints from
`--u-accent`, and that variable **inherits**. `<body>` carries `text-base-content`, which
sets `--u-accent` to the ink colour — so the pill inherited near-black, tinted itself 55%
of it, and rendered as a dark slab with near-black icons drawn on top. Perfectly legible
in the DOM, invisible on screen. `.jd-chrome` now declares its own `--u-accent`, and any
new glass surface must do the same.

Twice in one session, the chrome was broken by a Silica CSS mechanism that fails without
erroring. Both are now written down in docs/10-design-system.md, because neither is
discoverable from the markup.

---

### ADR-026 — Plain manifests, no Helm
**Settled.**

Helm earns its keep when you are packaging software for other people to install, or
templating one chart across many genuinely different deployments. jotdojo is four
services we control, deployed to one cluster, with one environment. A templating
language between us and our YAML would buy nothing and cost a layer everyone has to
learn to read.

There is not even a dev/prod split to justify overlays, so there is no Kustomize either.
Image tags move with `kubectl set image`, which gives real rollout and rollback without
`:latest` and without a second tool.

**Revisit if** a second environment appears, or if the manifests start repeating
themselves badly enough that the repetition is the bug.

---

### ADR-027 — Ink: what got built and what did not
**Settled for M2's first half.**

**The engine is not a React component and does not know about one.** Every `pointermove`
that touches component state is a render, and at pen sample rates that is a render every
few milliseconds. React mounts two canvases and then stays out of the way; the only
things crossing back are the sync status and the block id.

**Two stacked canvases.** The in-flight stroke draws on its own layer and is committed to
the durable one on `pointerup`. Without the split, every frame of a stroke would mean
repainting the whole page.

**Palm rejection is a single flag: once a stylus has touched this page, touch stops
drawing.** Per page rather than per stroke, because the palm lands before the nib does
and a per-stroke check leaks the first millimetre of every line. Finger-only devices are
unaffected — this product is explicitly for jotting with a finger too.

**Curve fitting is not decoration.** Safari does not implement `getCoalescedEvents`, so
Apple Pencil ink is reconstructed from a fraction of the samples the hardware captured.
Catmull-Rom through the captured points — which passes *through* them rather than
approximating, because those points are what the person actually drew.

**Erase is stroke-wise and replaces the whole page.** Pixel erase would force
rasterisation and end re-recognition forever. The append protocol only adds to the end,
so removing from the middle is a whole-document replace rather than a delete-by-index
that would race with in-flight appends.

**The eager-sync protocol is `seq`-based, and the strictness is the point.** A batch that
skips ahead is refused, not accepted, because accepting it would leave a hole in the
middle of someone's handwriting that nothing would ever report. A replayed batch is a
no-op. The client queue empties only on confirmation from the server.

**A person's correction is ground truth, guarded twice.** `transcript_source = 'user'`
blocks recognition at claim time *and* at store time. Checking only at claim leaves a
window where someone fixes a transcript while a job is already in flight and a model
silently overwrites what they typed. That would be the single most infuriating thing this
product could do.

**Not built:** stored raster previews (`media_assets.preview_url` is still null — the
renderer exists, nothing calls it for thumbnails yet). The lasso select tool landed in
ADR-033 and the Scribble path in ADR-034.

---

### ADR-028 — Storage is a seam, and the dev driver refuses production
**Settled.**

Ink lives in Postgres jsonb; photos and audio do not. `packages/storage` is the one place
that knows where bytes go, with two drivers.

**Azure hands the browser a SAS URL and never sees the payload.** docs/04 forbids proxying
media through the API and the reason is arithmetic: a hundred phones uploading a 5MB photo
is half a gigabyte flowing through a Node process sized for JSON. Written against the REST
API rather than `@azure/storage-blob` — the SDK is a large dependency for two signed URLs
and a GET, and the SAS signing is the only part with substance.

**The local driver does proxy, which is why it throws when `NODE_ENV=production`.** A
development convenience that silently becomes the production path is how this kind of
thing goes wrong; refusing at resolve time makes it impossible rather than merely
discouraged.

Its signed URLs are real HMACs, not a stub. A dev-only route that accepted unsigned writes
would be an open upload endpoint on a laptop that is more often than anyone admits
reachable from a coffee shop network.

**Keys are derived, never accepted from a client** — `spaceId/artifactId.ext`. A
caller-supplied key is a path traversal and a cross-tenant overwrite waiting to happen,
and `../../other-space/note.png` is a perfectly valid-looking string. The traversal check
runs on write *and* on read, because a signed key is still a key that arrived off a URL.

**Not done:** user-delegation SAS via workload identity. The account key is a standing
credential that has to live in Key Vault; moving to a short-lived delegation key means
replacing one function.

---

### ADR-029 — One queue, three senses
**Settled.**

Ink, photos and voice all travel the same `block.recognize` topic and land in the same
four fields on `blocks`. `runRecognitionCycle` dispatches on `kind`: ink and images are
rendered to an image and read by a vision model, audio is fetched from storage and sent to
a speech model.

**A modality whose provider is missing is failed explicitly, never left pending.** Both
alternatives are worse: a job left claimed spins the queue, and one silently completed
strands the artifact as permanently unread with nothing saying why. A block that reads
`failed` lets the UI say "saved, but not transcribed yet" — which is true, and which
distinguishes itself from a spinner that never resolves.

**Confidence is derived, not invented.** Whisper reports `avg_logprob` per segment — a
mean log-probability per token, about -0.1 for clean speech and below -0.8 for guesswork.
`exp()` of the mean maps that to (0, 1] with roughly the right shape. The mapping is a
judgement call, so it is written down in `packages/speech/src/provider.ts` where someone
can disagree with it, rather than buried. The number is shown to people and sent over MCP;
it has to mean something.

**`MediaRecorder.mimeType` is a demand, not a request.** Pass a type the browser cannot
produce and the constructor throws, and the answer differs by browser and by OS version —
Safari recorded MP4/AAC only until 18.4. So we ask in preference order, and we store what
the recorder actually produced rather than what we hoped for: guessing wrong means a 400
from a transcription provider that will not say why.

**Known limitation, named rather than hidden:** the recording uploads on stop, not per
chunk. A tab closed mid-recording loses it. `recorder.start(5000)` at least keeps the data
in hand in five-second slices; eager chunk upload — the same shape as the ink sync — is
the fix and it is not built.

---

### ADR-030 — 250 lines, 50 lines, 3 lines
**Settled.** A source file must not exceed 250 lines, a function or method 50, a comment 3.
The rule and its exemptions are written in [CLAUDE.md](../CLAUDE.md); this entry is the why.

**The limits are arbitrary on purpose.** Any specific number is; what matters is that a
number exists, because "keep it small" is advice and 250 is a rule. A rule gets applied to
the file in front of you at the moment you are least inclined to stop and reorganise it.

**The file limit is a limit on responsibilities, not on lines.** Nothing goes wrong at line
251. What goes wrong is that `oauth.ts` at 564 lines holds client registration, the
authorization code exchange, refresh, and revocation, and no one reading it can tell which
of those a change touches. The line count is a proxy for that, and a proxy that can be
measured beats a judgement that has to be argued.

**The function limit buys stack traces and names.** Fifty lines is about one screen. Past
that, the extracted helpers are worth more than the inlining: they name the steps, they
appear in traces, and they can be tested without constructing the whole surrounding call.

**The comment limit is aimed at a specific failure.** A long comment is nearly always a
design decision defended in place, and a decision defended in place drifts from the code
below it and is never revised. This log is where those go, linked by ADR number from a line
of code. Three lines is enough to say what a line does and not enough to argue.

**Existing violations are grandfathered, and named in CLAUDE.md so they are not lost.**
Splitting four working files to satisfy a rule written after them is churn with real
regression risk. They get split when they are next opened for a reason of their own.

---

### ADR-031 — The database connects on first use, not on import
**Settled.** `packages/db` builds its pool inside a function and exposes `db` as a
stand-in that becomes the real client the moment anything touches it.

**A build is not allowed to need a production credential.** The pool used to be
constructed at module scope, so importing the package required a live `DATABASE_URL`.
`next build` imports every route module during "Collecting page data", which meant the
build — a step that should need no secrets at all — tried to open Postgres and died with
`DATABASE_URL is not set`.

**It passed locally for the worst possible reason:** a `.env` happened to be sitting next
to it. It failed in Docker and would have failed in CI, which is exactly backwards. The
environments that deliberately hold no production secrets are the ones that must work.

**No validation was relaxed.** The same errors are thrown with the same messages. They are
thrown by the first query instead of by the import, which is the point at which a database
is genuinely required.

**The pool size stays per-process** (`DB_POOL_MAX`, ADR-026's cluster note). jotDOJO shares
a Postgres Flexible Server whose tier caps `max_connections` at 50 for the whole server,
and four services at the old default of 10 would be 40 of them. `infra/k8s` sets 5/5/3/3.
Postgres does not degrade politely at that ceiling — it refuses with `FATAL: sorry, too
many clients already`, and which service loses depends on pod start order.

---

### ADR-032 — Images are proven by running them, not by building them
**Settled.** A Dockerfile that builds is not evidence of anything. All four images are
booted against a real Postgres and checked for a real response before they are believed.

**Every bug found in the container images was invisible to `docker build`.** Each one
produced a clean image that started and then failed:

- `tsx` resolved to `/repo/node_modules/.bin/tsx`, which does not exist under a filtered
  install and is a **shell shim** rather than JavaScript in any case, so `node` refused it.
- Workspace packages were copied as source without their own `node_modules`. pnpm does not
  hoist, so `drizzle-orm` is reachable only through `packages/db/node_modules` — the import
  fails from a file that is present, in a package that is present.
- `web` copied the standalone server from `/repo/.next/standalone`, which does not exist:
  `outputFileTracingRoot` puts it under `apps/web/.next/standalone`.
- Three services were missing a workspace manifest their dependency graph requires —
  `@jotdojo/domain` alone pulls in db, embeddings **and** storage, so declaring `domain`
  is not the same as needing only `domain`.

**So every Dockerfile copies every workspace manifest and lets `--filter` narrow the
install.** Copying only one service's subgraph looks tighter and is a trap:
`--frozen-lockfile` validates the lockfile against the importers it can see, so a missing
`package.json` is not a missing dependency — it is a lockfile that no longer matches the
workspace.

**The bar is a response, not a green build.** The API image serves `/health` and passes the
full 16-check capture suite over real HTTP; the MCP image serves RFC 9728 metadata naming
`https://app.jotdojo.com`; web serves RFC 8414 metadata with the same issuer; the worker
states that no providers are configured rather than idling silently.

**The same bar applies to the release, and it caught one.** The whole sequence was
rehearsed locally against an empty Postgres: 14 migrations applied from the api image, the
role password set, all four services booted as `jotdojo_app` with `NODE_ENV=production`.

`psql -c "... :'app_password'"` does not work. psql expands `:'var'` only while lexing
input it reads; a `-c` string goes to the server verbatim, so the variable arrives literally
and Postgres answers `syntax error at or near ":"`. The SQL now arrives on stdin, which is
lexed. Verified both ways, and with a password containing a quote, a dollar, a double
quote, a space and a backslash.

**That failure was loud rather than silent** -- `ON_ERROR_STOP=1` and a `kubectl wait` mean
the release stops -- but it would have stopped every deploy at the same step, and on a
first deploy the app role would never have had a password at all.

---

### ADR-033 — A lasso selects whole strokes, and a move keeps every sample
**Settled.** The Select tool draws a freeform loop, keeps the strokes that fall
**entirely** inside it, and can move or delete them.

**Whole-stroke containment, not "any point inside".** Partial containment is more
forgiving and worse: one long underline passing through the loop would be dragged along
with the words above it, and nothing on screen would explain why. Whole-stroke is what pen
apps do, and it is the rule a person can predict without being taught.

**A move rewrites x and y and nothing else.** Timestamp, pressure and tilt travel with the
points untouched. Those are what a better model reads on re-recognition (ADR-027), so a
move that rebuilt its points would quietly cost the page its future readability to save a
few bytes.

**Move and delete resend the whole page.** The eager append protocol can only say "here
are more strokes"; it has no way to express "these ones are somewhere else now". That is
the same path erase already takes, so no server change, no new endpoint and no migration
were needed -- `InkSync.replace` already existed.

**The selection dies with the tool.** Switching away from Select clears the marquee: a
selection that outlives the tool that made it is a promise the next pen stroke will not
keep.

**Tested without a browser or a database.** Containment, marquee bounds and the move are
pure functions in `apps/web/lib/ink-geometry.ts`, covered by `pnpm lasso:smoke` (18
checks) -- including a concave lasso, because people draw around words rather than around
boxes, and the notch of a C shape must not count as inside.

---

### ADR-034 — Apple Scribble is told to the people who have it, once
**Settled.** On an iPad, a one-line hint says the Pencil already writes into the text
field. It shows once, only while typing, and only on hardware that can do it.

**The feature costs nothing and is invisible.** docs/08 calls Scribble Tier 1: it works in
any web text field on iPadOS, needs no code, and satisfies a large share of "I want to jot
with my pencil" before a recognizer runs at all. The entire problem is that almost nobody
knows it exists, which makes surfacing it the whole implementation.

**iPadOS reports itself as macOS**, deliberately, since version 13. The only reliable
separator left is touch: a Mac has no touch points. Getting this wrong is not neutral --
telling a desktop user to pick up a Pencil is the kind of copy that makes a product feel
like it is not paying attention.

**Not shown over ink.** Someone drawing has visibly worked out that the pen works. The
hint belongs in the text surface, which is exactly where Scribble applies.

**It is dismissed permanently, and dismissal is allowed to fail.** `localStorage` throws
outright in a locked-down Safari rather than returning null, so both reads and writes are
guarded. A hint shown twice is a much smaller problem than a canvas that will not load.

---

### ADR-035 — Joining a space is the one thing an outsider may do
**Settled.** Shared spaces have owners and members, invitations are emailed tokens, and
accepting goes through a narrow SECURITY DEFINER door.

**The awkward part is not the table, it is that an invitee cannot see the invite.** Every
policy in this schema is `app_can_reach_space`, and someone who has not joined reaches
nothing — so the row that would let them join is invisible to them by exactly the rule that
makes the product safe. Widening a policy to fix that would undo the boundary. A door keyed
by a secret the caller must already hold does not, and it is the same shape as sign-in
(ADR-024, `app_provision_user`).

**The token is the credential; the email is the binding.** `app_accept_invite` refuses when
the accepting account's address differs from the one invited. A link forwarded to a group
chat should not hand over a family's notes, and "whoever clicks first" is not a security
model. The cost is real — someone who signs in with a different address is stuck — and it
is the right trade for a product holding a family's private notes.

**A space always keeps an owner, enforced by a trigger.** There are three ways to strand a
space — delete the member, demote them, or leave — and only one of them is obvious. Put
that check in application code and it will be right in two places out of three. In the
database it is right everywhere, including from `psql`.

**Members may see the pending invite list.** Hiding it from a family member buys nothing
and makes "why has nothing happened" impossible to answer. Only owners send and revoke.

**Anyone may remove themselves.** Leaving a space you were added to should never require
asking the person who added you.

**Proven by `pnpm members:smoke`** — 29 checks, including that an outsider can neither see
the space nor list its members, that a forwarded token is refused by code, that a used or
revoked token is refused by code, and that the last owner can neither leave nor demote
themselves.

---

### ADR-036 — Over quota is deferred, and the queue carries the deferral
**Settled.** Recognition is metered per space per calendar month. Over the allowance, the
block is marked `deferred` and its outbox row is moved to the start of the next period.

**`blocks.transcript_state` has allowed `'deferred'` since 0000_init.sql.** This is the
migration that finally sets it, which is a small vindication of writing the state down
before there was anything to put in it.

**`deferred` is not `failed`, and the difference is not cosmetic.** `failed` means "this
will never happen". Saying that about someone's own handwriting when the only problem is
that we have not billed them yet would be a lie, and it would invite the UI to offer a
"try again" that cannot work. `deferred` means "not yet", which is true, and it lets the
copy say so plainly (docs/11).

**Enforced at CLAIM time, not in the worker.** Checking after claiming means a job is
leased and then handed back — which spins the queue and burns `attempts` on work that was
never going to run. The claim function already decides what work exists; quota is part of
that decision.

**The queue is the scheduler.** A deferred job's `available_at` moves to the start of next
period, so it becomes claimable on its own. There is no backfill job to remember to write
and no cron to forget. `attempts` is decremented back, because being over quota is not a
failed attempt.

**Metered after the model answered, never before.** A call that failed cost nothing worth
billing, and charging for it would make a bad transcript expensive twice.

**Audio is charged by started minute, from the last word's timestamp** — not by file size.
A long silence is not work, and a compressed codec is not a discount.

**Allowances live in SQL** (`app_plan_allowance`), because the claim function enforces them
and runs in the database. A limit defined somewhere the enforcer cannot see it is a limit
that drifts.

**Proven by `pnpm metering:smoke`** — 19 checks, the load-bearing one being that over
quota a note is still created, strokes are still stored, and the block reads `deferred`
rather than `failed`.

---

### ADR-037 — The review inbox needed no schema
**Settled.** Agent-authored changes are listed, attributed and revertible by a person. It
is built entirely on `note_revisions`, which has carried `author_type`,
`agent_client_id`, `agent_model` and `reverted_at` since 0000_init.sql.

**That is the second time the data model has paid for itself** — photos needed one
migration and zero table changes (ADR-029), and this needed none of either. Both were
designed for in 0000 on the strength of docs/04, before there was anything to put in them.

**A revert is a NEW revision, never a deletion.** History stays append-only, so "an agent
wrote this and a person took it out again" remains answerable. Deleting the row would make
the inbox lie by omission about the thing it exists to record.

**Reverted entries stay in the list.** An inbox that hides what you already dealt with
cannot answer "what has this agent been doing lately", which is exactly the question asked
after something goes wrong.

**People only, in both directions.** An agent cannot read the inbox and cannot revert —
not its own change and not another's. An audit trail that agents can edit is a conversation
we are not part of.

**Reverting an agent's first write empties the note rather than failing.** There is no
earlier revision to restore, and "" is the honest answer for what the note was before.

**Proven by `pnpm review:smoke`** — 18 checks, against an agent actor minted through the
real OAuth path with a real per-space `notes:edit` grant, not a hand-built object.

---

### ADR-038 — Billing is a seam, the space is the customer, and a failed card is a conversation
**Settled.** `packages/billing` is one interface with two drivers, Stripe over its REST API
and a `fake`. Nothing in the application names Stripe.

**The SPACE is billed, not the user.** A family pays once and four people benefit; the
person who happened to enter a card is not the thing being sold. It also means leaving a
space cannot take a subscription with you.

**Entitlement is separate from its paperwork.** `spaces.plan` is what a space is ALLOWED —
`app_plan_allowance` reads it, so metering (ADR-036) responds the moment it changes.
`space_billing` records why. Keeping them apart is what lets a provider outage or a failing
card leave entitlement alone.

**`past_due` KEEPS the plan.** A failed card is a conversation, not a reason to take a
family's recognition away in the middle of a month. Stripe retries for days; `canceled` is
what arrives if it truly ends, and only then does the space fall back to free — to free,
never below it. **Notes are never deleted for non-payment**; recognition simply defers
again, which is the behaviour ADR-007 already promised.

**The space id round-trips through the provider as metadata.** The subscription attaches to
a space we named, never to whatever a returning browser claims — a redirect back from a
payment page is not evidence of anything.

**The fake enforces the same signature contract as the real one.** That is the whole reason
it exists in this shape. A fake that accepted unsigned webhooks would let an
unsigned-webhook bug ship, because the suite would pass against a driver that skips the one
check worth making — a webhook endpoint without signature verification is a public API for
granting yourself a paid plan. The fake also refuses to resolve under
`NODE_ENV=production`, same as the local storage driver (ADR-028).

**Timestamp age is checked, not just the HMAC.** Without it a captured webhook stays
replayable forever, which is the usual way this is got wrong.

**A price we do not sell is ignored, not an error.** It is somebody else's product on the
same account, and it must never change a plan here.

**Written against the REST API rather than the SDK**, for the same reason as the Azure blob
driver: a large dependency for three endpoints and a signature check, where the signature
check is the only part with substance.

**Proven by `pnpm billing:smoke`** — 32 checks, of which six are attempts to forge, tamper
with, replay or skip the webhook signature.

---

### ADR-039 — An anonymous visitor is a user who has not signed in yet
**Settled.** An anonymous session gets a real `users` row — a shadow — which owns a space
of kind `anon`. Claiming at sign-in swaps the owner and deletes the shadow.

**This was the third option and the only good one.** A fourth actor type would mean
teaching every RLS policy about a second kind of principal. Routing anonymous writes
through SECURITY DEFINER functions would mean reimplementing notes, blocks and ink behind
doors that skip RLS — which is exactly the privilege the policies exist to withhold. A
shadow user needs neither: notes, ink, search, revisions and autosave all work unchanged,
because from their point of view this is an ordinary person with one space.

**Zero allowance is how "no recognition until claimed" is enforced.** An anon space is on
plan `anon`, which `app_plan_allowance` values at 0, so `app_space_over_quota` is already
true and `app_claim_recognize_jobs` already defers the work and keeps the strokes. No
second mechanism, and the ink becomes readable the moment the space gets a real plan
(ADR-036).

**Claiming is a change of ownership, not a copy.** Nothing moves between tables, so nothing
can be lost in the moving and there is no merge logic to get wrong. The real owner joins
before the shadow leaves, because the last-owner trigger would otherwise refuse — and
rightly.

**Authorship survives the shadow's deletion as NULL**, which is honest: a note written
before there was an account was written by "someone".

**`@anon.invalid` is deliberate.** RFC 2606 reserves it, so a shadow can never collide with
a real address — which matters because an invite is bound to an email (ADR-035) and a
shadow must never be invitable.

**Retention is a function, not a runbook sentence.** `app_sweep_anon_spaces` deletes
unclaimed drafts after 30 days, so the data-retention promise is executable.

**The suite found a real bug on its first run.** Deleting a space cascades to
`space_members`, and 0014's last-owner trigger refused the cascade — meaning **no space
could ever be deleted**. Nothing had deleted one until the sweep existed, so it had no way
to surface. Fixed in 0019 by asking whether the space still exists: during a cascade the
parent is already gone and there is nothing left to protect.

### ADR-040 — One deployment serves both hostnames, and the middleware chooses
**Settled.** `jotdojo.com` and `app.jotdojo.com` are the same `apps/web` deployment. The
marketing pages live under `/site` in the route tree, and `apps/web/middleware.ts` rewrites
the apex's bare paths onto them by reading the Host. Adding the apex to the shared Caddy is
one more block pointing at the **existing** backend, not a fifth service.

**Because the hero is the real canvas.** ADR-010 requires the marketing hero to be a
working canvas rather than a screenshot, and it saves through the same `saveNoteAction`,
the same `InkCanvas` and the same RLS as the app. A separate marketing app would mean a
second copy of the capture path — and the copy that is not the product is the one that
quietly rots.

**The host is read from `x-forwarded-host`, falling back to `host`.** That is what the
shared Caddy sets. Spoofing it only chooses which page tree renders and never grants
anything: the app tree still requires a session and RLS still decides what that session
reaches.

**The middleware runs on the edge runtime, and `runtime: "nodejs"` is a trap.** Setting it
in the middleware `config` on Next 15.5 does not error, does not warn, and silently leaves
`middleware` **empty in `middleware-manifest.json`** — so the middleware never runs and the
apex serves the app. Caught by checking the manifest, not by reading the build output.

**The rewrite must be idempotent.** The production server re-enters middleware on its own
internal rewrite, so a path already inside `/site` is left alone. Without that the second
pass produces `/site/site/pricing`, which is a 404 that does not appear in development.

**`/site` paths are NOT canonicalised away on the app host**, which was the first design and
was wrong. A re-entered request arrives without the forwarded host, so redirecting it
bounces between the two hostnames forever. Every marketing page carries a canonical tag
pointing at the apex and `app/robots.ts` keeps crawlers off `app.` entirely, so there is
nothing left to canonicalise.

**Prerendered URLs are baked at build time.** Canonicals, `robots.txt` and `sitemap.xml` are
written from `SITE_URL` during `next build`, so `infra/docker/web.Dockerfile` sets it
explicitly and it must match `infra/k8s/01-config.yaml`, which supplies the same value at
runtime for the routing. Two places, deliberately, and the Dockerfile comment says so.

**The hero is the whole hero, and the headline is written on it.** The canvas fills the
viewport rather than sitting in a card between a headline and a paragraph: a boxed demo
reads as a picture of the product. "Where the thought lands." and its subtext are
positioned ON the writing surface, are transparent to pointers, and drop to the foot the
moment anyone clicks, focuses or puts a pen down. From that moment the page is theirs to
write on rather than ours to pitch on, and the pitch is still legible underneath.

**The toolbar is literally the app's.** `components/ToolRail.tsx` holds the seven tools
once and both surfaces render it, because a hero wearing a different toolbar advertises a
product that does not exist. Voice and photo appear on the marketing hero but are
disabled, with the reason in the tooltip -- a stranger sees the whole product and is told
which parts need an account, rather than being shown a smaller one.

**Deferred: redirecting returning visitors from the apex to the app.** docs/16 describes it
and it would need a cookie shared across `.jotdojo.com` — the exact mechanism that document
avoids for drafts, and one that cannot be exercised locally because `localhost` and
`jotdojo.localhost` share no cookie parent. The nav carries "Open the app" instead, and the
installed PWA already opens straight onto the canvas.

### ADR-041 — The anonymous draft is a server-set cookie, not localStorage
**Settled.** The token for an anonymous draft lives in an httpOnly, host-only cookie set by
the server, not in `localStorage` as docs/16 originally specified.

**Because ITP caps script-writable storage and not this.** `localStorage` and
`document.cookie` are both script-writable and both subject to Safari's seven-day cap and
its eviction under pressure. A cookie written by the server is neither. Since the entire
reason the draft is server-side is that Safari evicts things, storing the key to it in the
one place Safari evicts would have undone the argument.

**It is also not readable by script**, so a cross-site scripting bug on the marketing page
cannot walk off with somebody's draft.

**The handoff still travels in a URL.** The cookie is host-only, so `app.jotdojo.com` never
sees it; "Keep this" reads it server-side and redirects to `/claim?t=…`. That is the same
shape docs/16 describes, for the same reason.

**The cookie is left alone after claiming.** Once the draft is claimed the token stops
resolving, so the next visit to the apex reads as a fresh start without anything having to
remember to clear it.

### ADR-042 — Free reads, paid writes, checked at use time
**Settled.** An agent may read on every plan and may only write on a paid one. The check is
`assertAgentMayWrite` in `packages/domain/src/plans.ts`, called inside the transaction of
every agent-reachable write.

**docs/01 calls this the most important pricing decision in the document**, and it was not
implemented: scopes were granted at consent and never compared against the plan, so the
free tier could write. The marketing site is what surfaced it — a pricing page can only
honestly sell what the code enforces.

**At use time, not at consent time.** A grant made while a space was free would otherwise
stay read-only after the upgrade, and a grant made while it was paid would keep writing
after the subscription ended. Entitlement is a live property of the space, exactly like the
recognition allowance (ADR-036).

**Only agents are fenced.** A person writing in their own space is not a cost being metered,
and a capture token is the person coming through a narrower door. `assertAgentMayWrite`
returns immediately for both, so the common path costs no query at all.

**The refusal has its own code, `plan_read_only`,** rather than a generic `forbidden` — per
ADR-020, a suite that cannot tell "you lack the scope" from "your space has not paid" is
not testing the fence.

### ADR-043 — Solo exists because the pricing page cannot sell what the schema refuses
**Settled.** `solo` is a sellable plan: migration 0020, 1000 units a month, and
`PAID_PLANS` in `packages/billing` is now the one list every driver reads.

**The pricing doc has listed four plans since M0 and the schema only ever knew three.**
`app_apply_subscription` refused anything but `family` and `team`, so one person who wanted
agent writes had to buy Family. Found while writing the pricing page.

**1000 units is where the ladder implies.** Free is 100 and Family is 2000 pooled across up
to six people, so one paying person landing between them is the only number that keeps
"Family is Solo, pooled" true.

**Still not enforced: seat counts.** Family says six and Team says five, and nothing stops a
seventh. Team's documented "$4 per extra member" needs quantity-based subscriptions to bill
honestly, so the marketing page sells the included seats and says to write to us — which is
true, and better than advertising an overage we cannot charge for.

### ADR-044 — Icons are lucide, because the Unicode ones were never being drawn
**Settled.** `lucide-react`, seven icons, rendered through `components/ToolRail.tsx`.

**The toolbar was Unicode characters, and Inter serves none of them.** The subsets Google
Fonts actually delivers stop at `U+2122, U+2191, U+2193, U+2212, U+2215` plus Latin, so
`U+270E` (pen), `U+25AC` (highlighter), `U+2327` (eraser), `U+2B1A` (select), `U+25CF`
(voice) and `U+25A2` (photo) all fell through to whatever the operating system had.
Mismatched weights and baselines across one row of buttons, tofu where coverage is thin —
and `U+270E` has an emoji presentation variant, so on Apple platforms the pen could render
as a **colour emoji**, which docs/11 bans outright in product chrome.

This was never a decision. It was a placeholder nobody had looked at closely, and it had
shipped into the app as well as the marketing hero.

**Why a dependency here and nowhere else.** This repo hand-rolls its Stripe and Azure
drivers rather than take an SDK (ADR-028, ADR-038), so a package for seven icons deserves
an answer. The answer is that those SDKs wrap *three endpoints and a signature check* —
things worth owning. Icon geometry is not: it is drawing, it needs maintaining across a
growing set, and lucide tree-shakes to **1.4 kB** for these seven. The shared chunk did
not move.

**`Lasso`, not a dashed square.** ADR-033 makes the select tool a lasso that takes whole
strokes. The icon now says so.

**Stroke weight is 1.75, not lucide's 2.** Lucide draws at 24px; these render at 16. At
the default weight the row reads as marker pen beside Inter.

**Sized in CSS, not by the `size` prop**, so the coarse-pointer bump is one rule rather
than a second prop threaded through every caller.

**`site:smoke` refuses the old glyphs by code point**, and that check was verified to fail
before it was trusted.

**Still outstanding, and unrelated to this:** `icon-192.png`, `icon-512.png` and
`icon-maskable-512.png` do not exist, so an installed PWA shows a default home-screen
icon. That is brand work on the 覚 seal, not an icon-set decision.

### ADR-045 — Style is per tool, formatting is markdown, and a selection can be changed
**Settled.** Three things the toolbar could not do, and one of them was a bug.

**The highlighter was a grey smear, and the cause was one shared colour.** The alpha was
always there — 35% at `multiply`, over an 18px width — but `InkCanvas` was handed
`color="#1A1817"` for every tool, so the marker painted the pen's near-black. Translucent
near-black on cream is grey. Style is now held **per tool**: `InkStyles` carries a pen and
a marker, and each keeps its own colour the way real ones do.

**Opacity is a property of the tool, not of the colour.** The domain validator takes
six-digit hex only, which is worth keeping: an alpha baked into a stored colour is one that
a re-render, a re-recognition or an agent read would each have to know about separately.
The painter applies it, every time, so a highlighter can never accidentally be opaque.

**A marker still has one width.** docs/08 says so, and resizing a selection skips
highlighters rather than turning somebody's highlight into a thin coloured line.

**Formatting is markdown text, not a rich-text document.** The body of a note IS markdown —
it is what the block stores and what MCP hands an agent — so ⌘B wraps the selection in
`**`. The surface stays a real `<textarea>`, which is what keeps Apple Scribble working
(ADR-034) and leaves paste, IME and undo to the browser. The rules are pure functions in
`markdown-marks.ts` and `marks:smoke` exercises them with no DOM at all: the toggle and the
caret are the two things a hand-rolled markdown toolbar gets wrong, and `****bold****` is
what it looks like when it does.

**Underline is `<u>`.** Markdown has no underline. Inline HTML is valid markdown, every
renderer passes it through, and an agent reading the body sees an honest tag. The
alternative was to refuse a control people expect.

**Headings are absolute, not a toggle.** Body / H1 / H2 are one setting with three
positions, so pressing "heading" twice does not quietly make it body text again.

**Selecting now does something.** It always moved and deleted; nobody could tell, and there
was nothing else. The selection bar names what is caught and offers recolour, resize and
delete — the palettes shown depending on whether the lasso holds pens, markers or both.
Strokes are restyled **in place**, so the marquee survives and somebody can try three
colours without lassoing again. Dragging already worked this way.

**Found while splitting the engine back under the size limit:** the pointer listeners were
added in the constructor and removed in `destroy` as two hand-maintained lists. One is now
`bindPointer`, which returns its own disposer. Two lists drifting is the only way that leak
ever happens.

### ADR-046 — Old content is read again on request, never on a whim
**Settled.** `pnpm reread` compares each block's `transcript_source` against the source the
configured model would write now, and queues the ones that differ. M5.

**This is the payoff for storing strokes.** docs/08 keeps vectors rather than a flattened
raster precisely so a page can be read again by a better model, and until now nothing
could actually do it. Every page anyone has ever drawn improves the day a better model
ships, and the person who drew it does nothing.

**A command, and it dry-runs by default.** A worker that noticed a changed `VISION_MODEL`
on boot and re-read the corpus would bill per page for a decision nobody made. So it prints
what it would do, and only `--apply` spends anything.

**Scoped to a space with `--space`.** Somebody writes in to say their old handwriting reads
badly; the answer should cost their pages, not everybody's. Unscoped and scoped runs look
identical from a command line at 11pm, so the narrow one has to be easy to reach.

**A CORRECTION IS GROUND TRUTH AND IS NEVER RE-READ.** `transcript_source = 'user'` is
excluded in the definition of stale, and `reread:smoke` proves a corrected block survives a
sweep of its whole space. Overwriting somebody's correction with a "better" model is the
single most infuriating thing this product could do, and a pass that walks every block is
exactly how it would happen by accident.

**Everything else is reused rather than reinvented.** The queued rows are ordinary
`block.recognize` jobs, so an over-quota space still defers (ADR-036), the worker still
meters each reading, and an anon draft at zero allowance still reads nothing.

**The format string lives in one place.** `sourceFor()` is shared by the recogniser and the
re-reading pass. Built in two places, a change to the format would not look like a bug — it
would look like every block in the database suddenly needing to be read again, and it would
bill accordingly.

**Two bugs found by the suite on its first run**, both recorded in the migrations:
`app_stale_transcripts` was SECURITY INVOKER, so it ran under RLS with no actor and always
returned nothing — while the requeue that calls it internally worked perfectly, making the
dry run disagree with the real pass. And re-reading could only ever mean "everything",
which is how the `--space` scope came to exist.

### ADR-047 — A note has ONE ink layer
**Settled.** The canvas asks for the note's ink block through `ensureInkBlock`, which
returns the existing one or creates it. `createInkBlock` still makes a new block every
time, which is right for the data model and wrong for the canvas.

**Handwriting was not being drawn when a note was opened.** `inkStarted` began `false` on
every mount, so the ink layer was not rendered until somebody reached for the pen — and
reaching for the pen called `createInkBlock`, which made a SECOND block and drew that one.
The strokes were still in the database, attached to a block nothing looked at.

**Nothing was ever lost, and that is what made it bad.** It looked exactly like loss to the
person who drew it, and "never lose a thought" is not a promise about rows.

**React StrictMode made it happen without anyone touching a pen.** The mount effect runs
twice in development, so every mount created two ink blocks. The `disposed` flag stopped
the first being *used*; the row was already there.

**Found by opening the page in a browser**, after the suites were green — the flaw was in
what the component asked for, and every layer under it behaved correctly.

**Ink now counts as engagement on the hero too.** A visitor returning to a drawing they
made had the headline sitting on top of it, because only typed text was checked.

### ADR-048 — The triage agent: opt-in, Team only, and it can only comment
**Settled.** A scheduled pass reads notes that have stopped changing and leaves a comment
when it spots something with a date on it or somebody waiting. `packages/reason` is the
seam, `note.triage` is the topic, and `triage:smoke` (42) is the proof.

**It is the only thing in the product that speaks first**, which is why almost all of the
design is about restraint rather than capability.

**Off until an owner turns it on, and off means off.** docs/07 asked for exactly one thing
above everything else: it must be genuinely easy to turn off, and off must mean off. So the
check happens twice — once when work is queued and again when it is claimed — because a job
queued last night must not speak this morning to somebody who switched it off in between.
The suite queues a job, flips the switch, and proves the job is closed rather than run.

**Its only output is a comment.** Note content is untrusted input; anyone can write "ignore
your instructions" on a napkin and photograph it. ADR-004 already decided that an agent's
normal way of saying something is a comment, and here that is enforced by there being no
other door: `app_comment_as_agent` can write a comment and nothing else. The suite asserts
the note body and revision are untouched after a pass.

**Silence is the normal answer.** The prompt says most notes deserve nothing, and anything
that is not a non-empty string is read as silence. An agent that remarks on every shopping
list is not alive, it is noise, and noise is how a feature like this gets switched off in
week one.

**It waits for the writing to stop.** A note is not read until it has been untouched for
`TRIAGE_QUIET` — fifteen minutes by default. Remarking on half a sentence is the difference
between an assistant and an interruption, and there is no event for somebody putting their
pen down, which is why this is the one scheduled thing in jotdojo.

**The watermark moves to where the pass actually got to, not to `now()`.** Stamping the
clock would silently drop every note past the batch limit. Because the scan is ordered
oldest-first across all spaces, the timestamp of the last note taken is exactly the safe
place to resume — so a busy space catches up on the next tick instead of losing a day.

**Over the allowance it goes quiet rather than deferring.** Recognition deferred to next
month is still worth having, because the strokes wait. A remark about a note from five
weeks ago is not, so the job is closed and the outbox row says why.

**The clock lives in the drain loop, not in a cron container.** The loop already runs,
already holds a connection, and already survives restarts by keeping its watermark in
Postgres. A second deployment whose only job is to call one function is a second thing that
can be down.

**A triage comment has no MCP client, because nobody connected it.** `comments_author_ck`
required an agent comment to name a client; it now requires a client *or* a model, which
preserves what the constraint was actually for — an agent comment is never unattributed —
and the comment renders as "Triage · <model>".

**Metered whether or not it speaks**, because deciding to stay quiet cost the same call as
deciding to speak. Billing only for remarks would pay a model to talk.

**Team only** (docs/01), enforced in `app_plan_allows_triage` rather than in TypeScript: a
space that downgrades stops being triaged even if the switch is still on.

**Queueing can be scoped to one space** (migration 0025), the same shape re-reading needed
in ADR-046 and for the same reason. The suite found it: `triage:smoke` passed on its first
run and failed the moment another space in the same database had the agent switched on, so
it had been quietly proving "nothing else was going on" alongside what it claimed to prove.
Its cleanup helper had been trying to switch the agent off for every other space and doing
nothing at all — `spaces` only accepts an update from an owner, and that connection has no
actor — which is a good argument for a suite that fails loudly when the world is not quiet
rather than one that assumes it.

### ADR-049 — Somebody has to be able to pay us
**Settled.** A billing webhook at `/api/billing/webhook`, a plan section on the account
page, and a CTA on the pricing page. `billing:http-smoke` (20) is the proof.

**Everything about billing existed except the parts a person touches.** The provider seam,
the entitlement rules, the SQL doors and a 35-check domain suite were all built in ADR-038,
and none of it could be reached: there was no checkout button anywhere in the product, and
`applyBillingEvent` had no HTTP caller at all. A card could have been charged and the space
would have stayed on the free plan for ever, because Stripe had nowhere to say what
happened. Found by reading the account page in a browser rather than by any suite.

**The webhook is the only unauthenticated write endpoint in the product**, and the
signature is the authentication. It is checked over the RAW body, because that is what the
signature covers. Three status codes and each one is a decision: 400 on a bad signature so
the provider does NOT retry something that will never verify; 500 when a verified event
cannot be recorded, so it DOES retry rather than costing somebody the plan they just
bought; 503 when no provider is configured, because nothing is broken -- this deployment
simply does not take money.

**Two things the suite corrected.** `past_due` KEEPS the plan (migration 0016), which is
the kinder reading and the one already written down: the provider retries for days, and
taking a family's recognition away on the first failed charge punishes them for an expired
card. And every plan the pricing page sells is now proven sellable end to end -- 0016 only
allowed `family` and `team`, and `solo` arrived later in 0020.

**The plan section says the two things worth interrupting for**: a card that is not going
through, and an allowance that has run out. Both say plainly that nothing has been deleted,
because docs/01 calls losing a thought to a billing limit the one unforgivable failure.

**No per-plan buy button on the marketing pricing page.** There is no checkout without an
account, so a price tag that opens a sign-in screen is a bait. One CTA -- start writing,
free, no card -- and the plans are chosen from the account page afterwards.

### ADR-050 — Four things a browser found that twenty suites did not
**Settled.** All fixed. Recorded together because they are one lesson, and it is the same
lesson as ADR-047: open the thing and look at it.

**Agent remarks were invisible from the front door.** `Notices` was mounted on `/n/[id]`
only, and the landing page IS the canvas (ADR-008) -- so "users open the app to see what
their agent noticed overnight", the exit criterion for M5, could not happen. One line.

**The marketing site had a section laid out three different ways.** `.jd-band-quiet > *`
centred every direct child on its OWN width, so the heading, the paragraph and the button
each landed on a different left edge -- the button worst, because an inline-block does not
centre that way and it sat outside the column entirely. Pad the band, not the children.

**The account button said "?".** A round button with a question mark on it, next to a
toolbar, reads as help. The dev sign-in returns no display name and the fallback was
literal; it now takes the initial from the name or the address, which is a fallback that
survives a Google account with no name on it too.

**The four plans wrapped 3 + 1**, which reads as "and one more we forgot" rather than as a
price list.

**The app had no icons at all.** The manifest promised three PNGs that 404ed, and there was
no favicon. `pnpm icons` generates them from the seal and commits the result -- a one-shot
generator rather than a build step, because a home screen icon that depends on a font being
installed on whichever machine ran the build is one that will one day come out blank. The
generator refuses to write a file whose mark did not draw, which is how the first two
attempts were caught: the glyph rendered off-centre, and then clipped by its own canvas.

### ADR-051 — The models are Azure OpenAI, provisioned by sparx, keyed from the vault
**Settled 2026-08-22.** All four seams -- `vision`, `speech`, `embeddings`, `reason` --
run against ONE Azure OpenAI account, created by sparx's Terraform in
`terraform/envs/azure/jotdojo.tf`. Nothing in this repo changed to adopt it.

**Why Azure rather than the vendors directly.** Azure startup credits pay for it, and the
four resolvers already had an `azure` branch. This is a funding decision wearing a
technical hat, and it should be read as buying runway rather than solving economics --
docs/01 says so in the same words. `recognition_usage` meters from day one, so the
decision that comes after the credits expire gets made against a measured cost per space.

**The account is in `eastus2`, not the platform's `centralus`, and that is not a
preference.** `whisper` is listed in centralus with SKU `None` -- present in the catalogue,
not deployable. Azure OpenAI is reached over HTTPS and is not VNet-bound like Postgres and
AKS, so it is free to sit where the model actually exists. It must be whisper rather than
the `gpt-4o-mini-transcribe` that IS in centralus, because `packages/speech` asks for
`verbose_json` with word timestamps and the gpt-4o transcribe models support neither.

**`text-embedding-3-small` is not a free choice either.** It is natively 1536 dimensions,
`block_embeddings.embedding` is `vector(1536)`, and the provider REFUSES a response of any
other width. Changing the model is a migration and a full re-embed.

**The key is written by Terraform and never typed.** Same property as the generated
database passwords beside it: a hand-transcribed credential is a crashloop two stages later
with nothing pointing at the typo. Managed identity would remove the key entirely and is
the right end state, but it needs `roleAssignments/write` (which the release identity
deliberately lacks), bearer-token auth in all four seams, and AKS workload identity in
`infra/k8s/`. It is a project, not a line.

**The load-bearing part is the four `*_PROVIDER` switches.** Every `resolve*()` reads its
provider variable FIRST and returns null when it is absent -- so the endpoint, the key and
all four deployment names can be present and correct and every feature still be off, with
no error anywhere. They were missing from `release.yml`'s optional list, which meant a
fully configured vault would have produced a deployment that looked healthy and did
nothing. That is the same silent-green failure the required list exists to refuse,
arriving through the back door.

### ADR-052 — CI tests the artifact that ships, so the fakes need one exemption
**Settled 2026-08-22.** Three decisions in this repo were each correct and jointly
impossible, and `billing:http-smoke` was the first suite to stand where they meet.

- CI builds and serves the PRODUCTION Next artifact, which is most of what the HTTP
  suites are for -- they catch wire-format bugs a function signature cannot.
- CI configures FAKE providers, because it holds no payment or model credentials and
  should not.
- Every fake REFUSES to run under `NODE_ENV=production` (ADR-007, ADR-028), because a
  fake billing driver in a real deployment hands out paid plans for free and records
  that somebody paid.

`next start` sets `NODE_ENV=production` and `web start` is `dotenv -e ../../.env --
next start`, so the CI web server is a production process holding
`BILLING_PROVIDER=fake`. `resolveBilling` threw, Next surfaced it as a 500 with an
EMPTY BODY, and all eighteen checks failed -- including the ones asserting a refusal,
which "passed" as failures for the wrong reason.

**The exemption is one environment variable, `JOTDOJO_FAKE_PROVIDERS_OK=1`, and what
makes it safe is structural rather than a promise.** `release.yml` builds the
container's environment SOLELY from Key Vault entries named in its `required` and
`optional` lists. A name absent from both cannot reach a deployment by any path. This
name is deliberately absent from both, and there is a comment above those lists saying
so, because the only way to break this is to add it there.

**Rejected: run the web app in dev mode for the HTTP suites.** It keeps every guard
untouched and it also stops the suites testing the thing that ships, which is the
entire reason they exist.

**Rejected: drop the suite from CI.** This is the only unauthenticated write endpoint
in the product and the one deciding who has paid us. It is the last suite that should
run only on somebody's laptop.

**Six copies of the guard, exercised by `pnpm fakes:check`.** The provider packages are
leaves with no dependencies -- deliberately, so nothing in that layer can reach the
database or another provider -- which leaves no shared module to hold a safety
predicate. Six copies of a rule is how one of them quietly drifts, so the check CALLS
all six resolvers in all three states: refusing under production, building with the
flag, building in development. It also proves the flag is exact rather than truthy --
`"true"`, `"yes"` and `"0"` all still refuse -- because a guard that opens for any
non-empty string is a guard that opens by accident.

No app depends on all six, so the check is a root script importing them by relative
path. That is honest about what it is: a root script belongs to no workspace package.

**The webhook also stopped answering an opaque 500.** A provider that is named and
unusable is a different thing from one that is absent; both now answer 503 with a
distinguishable message and a logged cause. Eighteen failing checks that named no cause
is what that costs.

### ADR-053 — The frame comes from the ink, not from the canvas it was drawn on
**Settled 2026-08-22.** Recognition derives its geometry from the STROKES. The stored
`canvas {w,h}` is no longer read by the renderer at all.

**This started as a feature request and turned out to be a repair.** The ask was a dot
grid, zoom and an endless canvas. The blocker looked like the recognition pipeline, which
assumed a fixed page: `toSvg` emitted `viewBox="0 0 w h"` and `bands()` walked `0..h`.
Then the reason that assumption was already wrong: `canvas` is written ONCE at block
creation and never updated, while a ResizeObserver resizes the live surface freely. Rotate
an iPad, write in the newly exposed strip, and those strokes were stored correctly and
clipped out of the render — no error, no log, and permanently, because a re-read in 2027
re-applies the same crop to the same strokes.

**A latent bug sat one stroke behind it.** The recognition background was
`<rect width="100%" height="100%">`. Percentages resolve against the viewport with `x`/`y`
defaulting to zero, so the first negative viewBox origin would have put the white entirely
off-screen and rasterised a transparent PNG — a model reading nothing, reporting nothing.
The rect now carries explicit `x`/`y`, and a smoke test rasterises a page at
`x = -4000` and asserts the corner pixel is opaque white.

**Tiling is two-dimensional, and sized in PIXELS.** A surface spreads sideways as readily
as down, and full-width bands over a wide board get shrunk by the longest-edge cap until
nothing is legible — the same failure as clipping, through a different door. When content
is one tile wide there is one column, which is the old banding behaviour at no cost.
Document units stopped meaning anything the moment zoom existed: 700 units is four pages
drawn zoomed out and two letters drawn zoomed in, so tile size is rendered pixels
converted through the render scale.

**Membership is rectangle overlap, not "some point is inside".** A two-point divider
spanning the whole board has no sample in the middle tile and was invisible to the old
test — and a zoomed-out board is mostly such strokes. This is now asserted directly.

**Recognition may ENLARGE, and `Stroke.width` is how it knows to.** The client holds the
pen at a constant DEVICE width, so what lands in the document is `constant / zoom`: ink
drawn zoomed out is stored thin. Scaling to a legibility floor (~2.5px) rather than to
fill the frame means a two-word note does not cost a full page of tokens to read.

**Metering had to change with it.** One block could be 32 images — thirty pages of tokens
— against a single unit of a 100-unit free allowance. A unit is now a page-equivalent,
four rendered tiles. `smoke-metering`'s "one page costs one unit" stays green and becomes
the guard that an ordinary page did not get more expensive.

**No migration, and `v` stays 1.** Old documents have every stroke inside `[0,w]x[0,h]`,
so bounding-box derivation is naturally compatible; the only visible change is that an old
page renders cropped to its written area instead of its white margins, which reads better.
Bump `v` when the document gains a FIELD — a persisted viewport would be a real `v: 2`.
`canvas` is reinterpreted rather than removed: it is the viewport the layer was created
at, which is where a client opening an endless surface should put its camera. ADR-047's
one-layer rule and the `bad_canvas` guard are untouched.

**Still owed, and named so it is not forgotten:** a partial read is not yet recorded
anywhere. `MAX_TILES` caps one surface at 32 images and the worker logs when it drops
some, but nothing tells an agent that a transcript covers part of a board. That needs a
`transcript_coverage` column — not a fifth `transcript_state`, because a partial read IS
ready, and not a suffix on `source`, because that string is the staleness key and would
make every partial block permanently stale.

### ADR-054 — The canvas is endless, and two fingers move it

**Context.** docs/08-ink.md listed infinite canvas panning as a v1 non-goal. That held
while the page was one screen of paper. It stopped holding the moment ADR-053 made
recognition read from the ink's own bounding box: the renderer no longer cares how large
the surface is, so the only thing still pinning the client to one screen was the client.

**Decision.** A three-number camera — `x`, `y`, `k` — between the pointer and the
document. Endless in both directions. Zoom clamped to `[0.1, 8]`.

**The camera is never in React state.** It lives in `InkViewport`, which the engine holds
and mutates directly, and every paint goes through one `requestAnimationFrame` coalescer.
An Apple Pencil reports faster than a display refreshes; a `setState` per pointermove is a
re-render every few milliseconds, and docs/08 has always said that destroys the feel.
React is told only when the ZOOM changes or the camera leaves or returns to home — a
readout and a button, nothing else. Panning around out there re-renders nothing at all.

**One conversion point.** `pointFrom` is the only place screen coordinates become document
coordinates, so every hit test downstream — erase, lasso, marquee — was already in world
space and needed no change. What did need changing is everything measured in SCREEN terms:
the erase radius, the lasso's line width and dash, the marquee's padding. Those are divided
by `k`. Ink widths are world-space and must never be, or zooming out would draw hairlines.

**Two fingers move the camera; one finger draws.** Pan and zoom are one formula — a
two-finger drag with unchanged spread falls out of `applyPinch` as a pure pan — so there is
no separate pan path to get wrong. The gesture tracker is fed BEFORE the drawing guards,
which key on a single active pointer and would otherwise drop the second finger entirely.

Three things about that were only obvious once written down. A gesture must **abort the
stroke in progress**, or every zoom leaves the tick mark the first finger already drew —
and the abort has to FLUSH a pending erase, because the strokes are already gone locally
while `up` never runs, so without it the ink vanishes here and comes back on reload. The
claim must **outlive the pinch until every finger lifts**, or the survivor of a two-finger
gesture is handed a stroke it never started. And **while the stylus is on the glass, touch
does nothing at all** — narrower than PalmGuard's page-wide latch, and necessary, because a
resting palm is often two contact points and would otherwise read as a pinch.

**The dot grid is CSS, not a third canvas.** At 1440×900 a 24px grid is ~2,200 dots. On a
canvas that is 2,200 `arc`+`fill` calls per pan frame, on the same main thread the next pen
sample arrives on — precisely the budget `desynchronized: true` was bought to protect. Four
custom properties on a repeating radial-gradient cost two style writes instead. World
spacing steps on a power-of-two ladder so screen spacing stays inside `[16, 64]px`; without
it `k = 0.1` is moire. The phase uses `((v % step) + step) % step`, because JS `%` keeps the
sign of the dividend and the raw remainder jumps the grid a whole cell at the origin.

**Fit-to-content on load, and no persistence.** Opening a note frames its writing rather
than landing on blank paper miles away. An empty page lands on exactly `0, 0, 1` — bit for
bit what the canvas did before it had a camera — and `k` is capped at 1 so a three-word note
is not blown up to fill a monitor. Resize ANCHORS rather than re-fits: the ResizeObserver
fires when the iOS keyboard opens and when a tablet rotates, and re-framing there teleports
the page out from under somebody mid-sentence. Nothing is stored, so there is no migration
and no `v` bump; a persisted viewport would be a real `v: 2`.

**The zoom chip is not decoration.** The canvas is unclamped, so someone can pan into blank
paper until there is no ink on screen and nothing to steer by. It is the way back.

**Consequences.** Pan and zoom are unreachable with the TEXT tool selected, because the ink
mount is `pointer-events: none` unless an ink tool is active. Correct for v1 — the textarea
underneath needs those events — and the chip is exempted so nobody is stranded. The
marketing hero does not use the engine and is unaffected: it stays one fixed screen.

**Verification is honest about its limit.** `smoke-viewport.ts` covers the arithmetic and
the gesture state machine — 45 assertions, no DOM — because that is what fails quietly.
Whether any of it feels right under a thumb it cannot answer. That needs a real phone,
which is what ADR-050 was about.

### ADR-055 — An idle worker parks; it does not exit

**Context.** With no provider configured the worker printed a loud warning and called
`process.exit(0)`. Deliberate, and right in spirit: a missing provider must never stop the
app accepting notes (ADR-007). But a Kubernetes Deployment restarts a clean exit forever,
so the honest "nothing to do here" rendered in the cluster as a pod restarting every few
seconds — indistinguishable from a crash loop, and the first thing anyone would chase.

**Decision.** Wait for `SIGINT`/`SIGTERM` instead of exiting. The pod stays `Running` with
nothing to drain, which is exactly what is true, and still shuts down promptly when asked.

**The first version of this fix shipped broken, and the way it broke is the useful part.**
`process.exit(0)` became `await park()`, every suite stayed green, and the pod restarted
exactly as fast as before. **A signal handler does not hold Node's event loop open.** With
nothing else pending, Node decides the top-level `await` can never settle, prints
`Detected unsettled top-level await` and exits **13**. Parking needs a live handle — a long
`setInterval`, cleared when the signal arrives — or it is just a slower crash.

**So this one is tested by spawning a real worker.** `smoke-park.ts` starts the process with
no providers, asserts it is still alive five seconds later, asserts Node did not call the
park a deadlock, and asserts SIGTERM still stops it. Nothing in-process could have caught
this: the bug was entirely about what keeps a process alive, which is invisible from inside
the module that is failing to stay that way.

**Consequences.** The state now reads correctly from `kubectl get pods` — a worker with no
providers looks idle rather than broken. It costs one parked process holding one timer. The
warning still prints, so the reason is one `logs` away, and when sparx's Azure OpenAI
deployment lands the rollout replaces the pod anyway.

### ADR-056 — A partial reading has to say it is partial

**Context.** `MAX_TILES` caps one surface at 32 rendered images, and a whiteboard
photographed at arm's length can exceed that. ADR-053 shipped the cap and the worker
logged a warning, but the partial reading was then stored as an ordinary transcript.
Nothing in the row was false. It was merely incomplete — which is worse, because a bad
transcript looks wrong and an incomplete one does not. An agent handed a third of a board
reports it as the whole board, confidently, in the user's own voice, and every summary,
task and reply downstream inherits that.

**Decision.** `blocks.transcript_coverage real`. NULL means nobody measured; `< 1` means
partial, and every caller that presents the transcript must say so.

**Two obvious alternatives, both wrong.**

*Not a fifth `transcript_state`.* `0000_init.sql` constrains that CHECK to four values, and
a partial read genuinely **is** ready: nothing should retry it, the UI should show it,
search should index it. Only its completeness differs, and completeness is not a state.

*Not a suffix on `transcript_source`.* docs/04 and `sources.ts` both say that string is the
staleness key, and `app_stale_transcripts` compares it for equality. A partial suffix would
make every partial block permanently stale against the source we would write now — so every
re-read pass would queue them all, bill for them all, and store the same suffix again. A
loop that costs money per lap.

**NULL is not 1, and the difference is load-bearing.** NULL means unmeasured; 1 means
measured and whole. Every row written before this migration is the former. Backfilling 1
would assert something no code ever checked, and the renderer says nothing at all for NULL
rather than claiming completeness it cannot vouch for.

**A partial reading may not name a note.** The first line of the first tile of a board we
only partly read is a guess at what the board is about, and a wrong title is far stickier
than a wrong transcript: it is what the note is called in every list, every search result
and every agent's reply. The title inference in `app_store_transcript` now requires
`coalesce(p_coverage, 1) >= 1`.

**A person's correction clears it.** Someone who has looked at the page and typed what it
says has settled completeness as well as accuracy. Leaving a machine's coverage figure
behind would keep flagging their answer as partial, which is the same insult as
overwriting it.

**`coverage` is a required argument, not an optional one.** Making it optional would let a
caller that has not been updated keep writing NULL silently — precisely the invisible
incompleteness this exists to end. Making it required turned the one stale call site into a
compile error, which is how it should have been found.

**The ink source gains a renderer generation, `htr:vlm:{model}/r2`.** For ink we build the
image the model sees, so the renderer is as much "how it was read" as the model is. r1
framed every page from a canvas written once at creation, so anything drawn outside it was
clipped out of the read silently and permanently (ADR-053) — every existing ink block was
read that way. The bump makes that corpus visible to `countStale`, so `reread` can offer to
fix it: opt-in and cost-previewed, as ADR-046 insists. Deliberately **not** applied to image
or audio, where nothing changed and a re-read would pay for an identical answer.

**Consequences.** One nullable column, one function signature, one renderer change. The
existing corpus is not rewritten and nothing is re-read without being asked. `smoke-render`
asserts the wording an agent actually receives — including that a reading which rounds to
100% is still marked partial — and `smoke-partial` asserts what lands in the column,
that a partial reading cannot title a note, and that a correction clears it.

### ADR-057 — The one door needs the owner exemption it was built on

**Context.** Nobody could create an account in production. Every Google sign-in ended on
Auth.js's "There is a problem with the server configuration", and the `users` table had
zero rows. The cause was two decisions in the initial schema that cannot both hold.

0002 states the design plainly: *"There is deliberately NO insert policy on users, spaces
or space_members. Account creation goes through app_provision_user() below, so there is
exactly one auditable door into existence."* A `SECURITY DEFINER` function is a good answer
to that problem — it can create an account and nothing else, and the app role gets EXECUTE
on it rather than write access to three tables.

But that door only opens if the function's owner is exempt from RLS, and 0000 set
`FORCE ROW LEVEL SECURITY` on all three tables. FORCE is precisely the flag that **removes**
the table owner's exemption. With FORCE on and no INSERT policy anywhere, the one door was
welded shut.

**Why every suite stayed green.** A developer's `DATABASE_ADMIN_URL` is `postgres`, a
superuser, and superusers bypass RLS unconditionally — FORCE included. So locally the
function worked, `db:smoke` passed, and `oauth:smoke` created users happily. Production's
owner is `jotdojo_owner`: not a superuser, no `BYPASSRLS`. The identical schema behaved
differently on the only machine that mattered. (`sparx_owner` on the same server *does*
have `rolbypassrls`; that asymmetry is the whole bug.)

**Decision.** `NO FORCE ROW LEVEL SECURITY` on `users`, `spaces` and `space_members`.

**What this does not weaken.** FORCE only ever applied to the table **owner**. The
application connects as `jotdojo_app`, which does not own these tables, so every policy
still applies to it exactly as before — it holds table-level INSERT and is stopped by RLS
alone. The tenancy boundary is untouched. What changes is that the definer functions built
to do this one job can do it again. `notes`, `blocks` and the rest keep FORCE: they hold
tenant content, no definer function writes to them, and the owner has no business reading
across spaces there.

**The rejected alternative was broader, not safer.** `ALTER ROLE jotdojo_owner BYPASSRLS`
would also have worked and would have kept FORCE as documented — but it exempts the
migration role from RLS on *every* table rather than restoring one exemption on three, and
it needs a superuser, so it would live in another project's Terraform instead of shipping
with the schema it fixes.

**Testing this needed a schema assertion, not a behavioural one.** The behaviour cannot be
reproduced where the admin role is a superuser, which is everywhere except production —
that is what hid it. So `smoke-rls.ts` now asserts the shape directly: the three account
tables have RLS enabled and NOT forced, and `notes`/`blocks` keep FORCE. Run against the
broken schema it fails three checks; against the fixed one it passes.

**Verified against production, not inferred.** `BEGIN; SELECT app_provision_user(...);
ROLLBACK;` as the real owner role reproduced
`new row violates row-level security policy for table "users"` before the fix and returned
a row after it, without writing anything either time.

**Correction, same day: the first fix was three tables and the problem was sixteen.**
0027 unblocked account creation, and the hero canvas still could not create an anonymous
draft -- `new row violates row-level security policy for table "anon_sessions"`. The rule
was never about account tables. Every SECURITY DEFINER function in this schema writes as
the owner, so FORCE breaks all of them; 0028 removes it from the twelve remaining tables
that definer functions write to.

**The second failure mode is worse than the one that was reported.** Where a table has no
INSERT policy the write raises, which is loud and findable. Where it has an ALL policy keyed
on `app_actor_id()` -- `blocks`, `notes`, `comments`, `oauth_tokens` -- there is no actor
inside `withoutActor`, so the policy matches nothing and the UPDATE reports success having
changed zero rows. A transcript that was never stored, metering that never recorded, and no
error anywhere. Recognition being switched off in production is the only reason that had
not yet bitten.

**So the guard is derived from the catalogue, not hand-written.** `smoke-rls` now joins
`pg_proc` on `prosecdef` against `pg_class.relforcerowsecurity` and fails if the
intersection is non-empty. A hand-kept list is what produced a three-table fix for a
sixteen-table problem, and the next definer function someone writes would not have been on
it either. Run against the schema after 0027 it names all twelve.

**This is the third bug this week that green suites could not see** — after a worker that
exited 0 into a restart loop and a canvas that clipped ink out of recognition. The pattern
is the same each time: the check ran somewhere the failure was impossible.

### ADR-058 — Live updates: the stream is a hint, and it carries pointers

**Decided:** 2026-08-22. **Status:** built.

Write on the iPad, watch it appear on the laptop. Members of a shared space see each
other's strokes land, see who else has the note open, and see who is writing before they
collide. Handwriting, typed text, and readings coming back from the worker.

**The stream carries ids and counters. It never carries content.** An event says "block X
is now at 42 strokes, version 19" and nothing else. Every receiver then reads the page for
itself, through the same row-level security as any other read. Three things follow from
that one choice, and they are why it is the choice:

- **Authorization is not a second implementation.** A member removed from a space mid-stream
  cannot be sent anything, whatever the stream layer forgets to check, because the fetch is
  what carries the data and the fetch goes through RLS.
- **A duplicate event is free and a lost one is only late.** Delivery needs no guarantees,
  which is what makes the transport below a reasonable thing to build on.
- **Nothing has to be kept in sync twice.** There is no second copy of a stroke in flight
  that could disagree with the row.

#### The transport is Postgres LISTEN/NOTIFY, and sparx's is not

sparx solves the same problem with **NATS JetStream** (`EVENT_BROKER=nats`, a StatefulSet in
the `sparx-prod` namespace of the cluster jotDOJO shares) fanned out to browsers over
socket.io with a Redis adapter. It is in reach: same cluster, resolvable by DNS. It was not
chosen, and the reason is not that it is unavailable.

sparx has **two layers** — a durable broker for business events that must not be lost, and a
non-durable last hop to an open tab. jotDOJO already has the first: the **Postgres outbox**,
with `attempts`, `locked_until` and `last_error`, chosen in ADR-002 for the reason that
still holds. What was missing was only the second, and the second wants none of what
JetStream sells. No acks, no redelivery, no replay — a page's truth is in the database and
the channel exists to say "go and look."

So depending on it would mean a runtime dependency on **another product's namespace** for a
feature that gains nothing from it. Today jotDOJO's outage surface is the cluster and the
Postgres server; this would make it three, and the third would be a service sparx can
restart without telling us. One Postgres connection per web pod is the price instead, and
docs/17 now counts it.

**What WOULD change this:** web scaling past a couple of replicas, where one connection per
pod starts to matter against a 50-connection ceiling shared with sparx; or jotDOJO needing
events to cross a service boundary that the outbox does not already cover. The seam is one
file — `packages/db/src/live.ts` — and no domain code knows what is underneath it.

**What was taken from sparx instead is the lesson in its `transport.ts`,** which documents a
real incident: a GCP→Azure migration unset `GCP_PROJECT_ID`, that silently selected a
fire-and-forget dev transport, and events vanished for weeks while every publish returned
success. **The default was a downgrade.** `publishRaw` here also swallows every error — and
that is how the same bug starts if anybody forgets why. The defence is not vigilance: it is
that this channel *cannot* carry anything worth losing, because `LiveEvent` is ids and
counters by construction. Anything that must happen goes in the outbox. That rule is written
at the top of `live.ts`.

#### SSE down, server actions up

Not a WebSocket. Writes already had a good path and did not need replacing, so only the
downward half was missing — half the machinery for all of the benefit. `EventSource` also
reconnects with backoff by itself, which is the part of a hand-rolled socket that gets
written once and then fails quietly on a train.

Publishing happens **after** the commit, not inside the transaction. Inside, a full
notification queue — one stuck listener is enough — would roll back the write that triggered
it, and that write is somebody's handwriting. After it, the strokes are already durable and
the worst a failure costs is a device finding out late. That trade is only available because
the payload is a pointer; with content in the event it would have to be the other way round.

#### A stroke now has an id, and that is what fixes the real bug

The append protocol only adds to the end, so erase, move and recolour were expressed by
resending the whole page. **That was already a data-loss bug**, not one this feature
introduced: erase a word on a tablet and every stroke the laptop drew while the request was
in flight is gone, silently, with the erase reported as success. Live updates only make
people hit it.

Naming strokes by id turns those edits into a **delta** — `remove: id[]`, `upsert: Stroke[]`
— and a delta is *commutative* with drawing. Removing stroke A and appending stroke B are
independent facts; either order gives the same page. So there is no version guard, no
refusal and no retry loop. The conflict was never real; it was an artefact of describing an
edit as a snapshot. Where two devices touch the *same* stroke, removal wins over restyling:
they disagree about whether it should exist, and the one who wanted it can draw it again.

`media_assets.strokes_version` is therefore not a lock. It is how a follower tells "the page
grew, ask for the tail" from "the middle changed, read it whole" — a count alone cannot,
because a delta that removes two and adds two leaves it unmoved.

**A second bug fell out of the same review.** `seq < count` meant "a retry whose response was
lost", which was true with one writer and false with two: a batch can be behind the page
because somebody else drew first, and dismissing it as a retry discards real strokes *with a
success code*. A batch that names its strokes is now deduplicated by id and the rest are
kept. A batch with no ids — the Shortcuts endpoint, MCP — is still assumed to be a retry,
which is the only safe guess when a stroke cannot be recognised.

#### Typed text follows when clean. ADR-001 still stands

No CRDT. A device with nothing unsaved adopts what another device wrote; a device in the
middle of a sentence keeps its sentence, and the existing revision conflict handles the
collision exactly as before. That covers what people actually do — pick up a different
device, or watch an agent append to a note they have open.

It does not solve two people typing into one paragraph, and **presence is the honest answer
to that** rather than a merge algorithm nobody can predict: you can see who else is here and
who is writing, before you collide. A warning you can act on beats a silent three-way merge.
Yjs or Loro remains available if simultaneous editing of the same paragraph ever becomes a
demonstrated need.

#### Consequences

- Polling retires. `InkTranscript` backs off to a 15s safety net instead of leading with 4s;
  the reading now arrives when the worker stores it, which is what docs/03 and docs/07 have
  claimed since they were written.
- One Postgres connection per web pod, lazily opened, outside the pool. docs/17 counts it.
- `ink.ts` split into `ink.ts` / `ink-delta.ts` / `ink-recognition.ts` / `ink-page.ts`, and
  `ink-engine.ts` into `ink-painter.ts` / `ink-framing.ts` / `ink-merge.ts` — both were at
  the size limit and both were edited, which is when the rule applies.
- `pnpm live:smoke` proves the two-device cases against a real database; `pnpm merge:smoke`
  proves the reconciliation rules with no database at all.

### ADR-059 — Pen size is a range, not three names

**2026-08-22.** The pen offered Fine, Medium and Broad — 1.4, 2.2 and 3.6 canvas pixels.
Three names is the right shape for a fixed page, where "medium" means medium *against
something*: a line has a size relative to the sheet it is on and the margins around it.

ADR-053 removed the sheet. On a canvas that goes on forever the same 2.2px line is a
heading when you are close and a footnote two screens out, and a person laying out a board
— a title, a body of notes under it, an arrow between two clusters — wants a mark ten times
the width of another mark, not a mark 1.6 times the width of another mark. The old ceiling
made the widest pen a slightly firm pen.

Pen width is now continuous from **0.5 to 32** canvas pixels, picked with a slider. The
domain has always accepted anything up to 200 (`ink-doc.ts`), so nothing below the UI
changed to allow it.

#### The travel is geometric, not linear

A linear slider over 0.5–32 spends two thirds of itself above 10px, which is a range with
about four useful values in it, and gives the handwriting sizes — where a tenth of a pixel
is visible — almost no room to aim. `width = 0.5 × 64^t` makes every step of the thumb the
same *proportional* change, so 1.4 sits a quarter of the way along and 2.2 a third,
roughly where the old presets were, and the fat end is reachable without swallowing the
control.

Widths settle to hundredths below 4px and to tenths above, and that is not fussiness — the
slider is driven by the width it produced, so two steps that settle to one width make the
thumb stick at it and slide back under the finger. Rounding to whole pixels at the fat end
did exactly that, twice, and `pnpm --filter @jotdojo/web smoke:pen-size` is what caught it.

#### A drag is one edit

Recolouring is a click, so `restyleSelection` published a delta every time it ran and that
was correct. A slider fires on every pixel of thumb travel, and `InkSync.delta` flushes
immediately — fifty requests for one decision. `restyleSelection(patch, publish = false)`
paints the change and tells nobody; the release publishes once. The strokes still fatten
under the thumb, which is the whole reason to resize a selection you can see.

#### Consequences

- `PEN_WIDTHS` is gone. `PenSize` is one component, used by the tool options pill and by
  the selection bar, so the pen you write with and the strokes you resize afterwards are
  the same control.
- `SelectionSummary` carries `penWidth`, so the slider opens where the selection already is
  instead of jumping it the moment it is touched.
- The nib preview is drawn at the true width up to 22px and then stops growing; past that
  the number beside it is the only honest signal, which is why it is there.
