# 15 — Decision log

Decisions that are settled, with the reasoning. Reopening one is fine; doing it without reading the entry is not.

---

### ADR-001 — Hosted remote MCP, not local
**Settled.** The MCP server is hosted at `mcp.jotacular.com`. A stdio shim exists for convenience but is a proxy, not the real thing.

**Why:** every competitor's agent access is local — Amplenote's desktop app, Obsidian's REST plugin, the Apple Notes AppleScript servers — and all of them require a computer that is on. If your notes live on your phone, that entire ecosystem is unavailable. Hosted MCP is the only shape that serves a phone-first user, and it is the whole wedge.

---

### ADR-002 — jotacular and kanninja stay separate products
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
**Settled.** An agent's normal output is a comment. Every mutation is attributed and reversible; delete is always soft. **Superseded in part by ADR-070**, which went further than this decision did: the edit tool and the `notes:edit` scope are gone, so an agent cannot replace a note's content at all.

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
**Settled.** `app.jotacular.com` opens a live writable canvas. No dashboard, no note list on load, no create button.

**Why:** the capture contract. Every click between opening the app and writing is a click during which a thought can be lost.

---

### ADR-009 — Anonymous capture is server-side, not local-only
**Settled.** Anonymous notes get a server-side space from the first keystroke, keyed by an opaque token in `localStorage`.

**Why:** local-only anonymous notes would be evicted by Safari and lost. That is not an edge case, it is the documented behaviour of the platform. Losing an anonymous user's first note is the worst possible first impression, and "never lose a thought" cannot have an asterisk. Server-side also makes claiming at sign-in a single ownership update instead of a merge, and sidesteps cross-subdomain storage isolation between the marketing hero and the app.

---

### ADR-010 — Marketing at the apex, app at `app.`, hero is a live canvas
**Settled.** `jotacular.com` is the crawlable marketing site and its hero is a real working canvas. `app.jotacular.com` is the app and never shows marketing. The PWA installs from `app.`.

**Why:** an app shell at the root wastes our highest-authority URL and will never rank, while serving crawlers different content than users is cloaking. Making the hero a live canvas satisfies both requirements honestly — and letting someone capture something is the best marketing a capture app has.

---

### ADR-011 — Silica UI, the house `washi` theme, plus a registered `agent` colour
**Settled. Revised after reading kanninja's live brand kit.**

An earlier draft chose Silica's `dune` preset. That is superseded: kanninja already publishes exact house values, and "close enough" is the wrong standard when the sibling has real ones.

**The house palette:** Vermillion `#E0432F` (the seal — *one per screen*), Sumi `#0E0F12` (the ink), Washi `#F8F4EC` (cream paper, the page), Snow `#FBFAF6` (elevated surfaces). Fraunces display, Inter body, JetBrains Mono. jotacular declares these as a Silica theme named `washi` rather than picking a preset.

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

### ADR-013 — Google OAuth for humans; jotacular is its own OAuth 2.1 server for agents
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

### ADR-016 — jotacular MCP tool names are namespaced against kanninja
**Settled.**

**Rule:** every jotacular tool name ends in `_note`, `_notes`, or `_spaces`. No bare verbs.

**Why:** kanninja is live and exposes 42 tools, including the generic names `search`, `list_comments`, and `add_comment`. An agent doing the flow we care about holds *both* servers, so a bare `search` on our side is a coin flip the agent will sometimes lose.

This also sharpens ADR-002. The agent already carries 42 tools from kanninja before jotacular speaks; a merged server would ship 50+ and be worse at both jobs. jotacular holds to ten.

---

### ADR-017 — API key path alongside OAuth
**Settled.** Support `JOTACULAR_API_KEY` for terminal agents, matching kanninja's `KANNINJA_API_KEY`, with OAuth for web clients.

**Why:** house consistency. Someone already running both from a terminal should configure them the same way. Same identity model underneath — the key is another credential resolving to a user and a grant.

---

### ADR-018 — Build the app first; marketing site deferred
**Settled.** M0 is the app only. The marketing site and anonymous capture move to M3.

**Why:** there is no traffic to convert yet, and the founder is user one. A marketing site optimises for an audience that does not exist while the thing it advertises is unproven. ADR-010 still stands as the *shape* — apex for marketing, `app.` for the app, live-canvas hero — it is simply built later.

**The one part that cannot wait:** deploy the app to `app.jotacular.com` from the first deploy, with the apex parked on a static page. The PWA install origin is baked into every installed home-screen icon; changing it later forces every user to reinstall. An hour now avoids a migration.

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

- **The application connects as `jotacular_app`** — no DDL, no `BYPASSRLS`, not the owner.
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

**Tenancy.** Every guarantee jotacular makes about who can read a note is a row-level
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

`0000_init.sql` created a `jotacular_worker` role with `BYPASSRLS`, reasoning that
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
restricted `jotacular_app` role as everything else. Point the application at the worker's
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
time they are using jotacular. `useToolbarPlacement` and its viewport measuring went with
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
templating one chart across many genuinely different deployments. jotacular is four
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

**The pool size stays per-process** (`DB_POOL_MAX`, ADR-026's cluster note). Jotacular shares
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
  `@jotacular/domain` alone pulls in db, embeddings **and** storage, so declaring `domain`
  is not the same as needing only `domain`.

**So every Dockerfile copies every workspace manifest and lets `--filter` narrow the
install.** Copying only one service's subgraph looks tighter and is a trap:
`--frozen-lockfile` validates the lockfile against the importers it can see, so a missing
`package.json` is not a missing dependency — it is a lockfile that no longer matches the
workspace.

**The bar is a response, not a green build.** The API image serves `/health` and passes the
full 16-check capture suite over real HTTP; the MCP image serves RFC 9728 metadata naming
`https://app.jotacular.com`; web serves RFC 8414 metadata with the same issuer; the worker
states that no providers are configured rather than idling silently.

**The same bar applies to the release, and it caught one.** The whole sequence was
rehearsed locally against an empty Postgres: 14 migrations applied from the api image, the
role password set, all four services booted as `jotacular_app` with `NODE_ENV=production`.

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
**Settled.** `jotacular.com` and `app.jotacular.com` are the same `apps/web` deployment. The
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
and it would need a cookie shared across `.jotacular.com` — the exact mechanism that document
avoids for drafts, and one that cannot be exercised locally because `localhost` and
`jotacular.localhost` share no cookie parent. The nav carries "Open the app" instead, and the
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

**The handoff still travels in a URL.** The cookie is host-only, so `app.jotacular.com` never
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
pen down, which is why this is the one scheduled thing in jotacular.

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
`terraform/envs/azure/jotacular.tf`. Nothing in this repo changed to adopt it.

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

**The exemption is one environment variable, `JOTACULAR_FAKE_PROVIDERS_OK=1`, and what
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
owner is `jotacular_owner`: not a superuser, no `BYPASSRLS`. The identical schema behaved
differently on the only machine that mattered. (`sparx_owner` on the same server *does*
have `rolbypassrls`; that asymmetry is the whole bug.)

**Decision.** `NO FORCE ROW LEVEL SECURITY` on `users`, `spaces` and `space_members`.

**What this does not weaken.** FORCE only ever applied to the table **owner**. The
application connects as `jotacular_app`, which does not own these tables, so every policy
still applies to it exactly as before — it holds table-level INSERT and is stopped by RLS
alone. The tenancy boundary is untouched. What changes is that the definer functions built
to do this one job can do it again. `notes`, `blocks` and the rest keep FORCE: they hold
tenant content, no definer function writes to them, and the owner has no business reading
across spaces there.

**The rejected alternative was broader, not safer.** `ALTER ROLE jotacular_owner BYPASSRLS`
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
the `sparx-prod` namespace of the cluster Jotacular shares) fanned out to browsers over
socket.io with a Redis adapter. It is in reach: same cluster, resolvable by DNS. It was not
chosen, and the reason is not that it is unavailable.

sparx has **two layers** — a durable broker for business events that must not be lost, and a
non-durable last hop to an open tab. Jotacular already has the first: the **Postgres outbox**,
with `attempts`, `locked_until` and `last_error`, chosen in ADR-002 for the reason that
still holds. What was missing was only the second, and the second wants none of what
JetStream sells. No acks, no redelivery, no replay — a page's truth is in the database and
the channel exists to say "go and look."

So depending on it would mean a runtime dependency on **another product's namespace** for a
feature that gains nothing from it. Today Jotacular's outage surface is the cluster and the
Postgres server; this would make it three, and the third would be a service sparx can
restart without telling us. One Postgres connection per web pod is the price instead, and
docs/17 now counts it.

**What WOULD change this:** web scaling past a couple of replicas, where one connection per
pod starts to matter against a 50-connection ceiling shared with sparx; or Jotacular needing
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
did exactly that, twice, and `pnpm --filter @jotacular/web smoke:pen-size` is what caught it.

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

### ADR-060 — The save line becomes a toast, and stops repeating itself

**2026-08-22.** `SaveIndicator` was a line of small text centred over the foot of the page.
Its states are `idle | saving | saved | retrying | conflict` and it never returns to `idle`,
so from the first save onward "Saved" simply sat on the washi for the rest of the session —
at the same size and weight as the writing, in the same column, on the same paper. It read
as something somebody had jotted there.

Next to the transcript panel's own "Your ink is saved. Nothing has read it back yet." it was
the word twice, one above the other, about two different things.

It is now a Silica toast (`ToastProvider` / `useToast`, already a dependency for the command
palette). A toast is off the page by construction and it leaves on its own, which is the
whole complaint answered: the reassurance stops being furniture.

#### It is rate limited, and that is the point

Autosave fires 600ms after every pause in typing, so a toast per `saved` would be a check
mark every time somebody stopped to think. Two rules:

- **Settle.** A `saved` schedules the toast 1.2s out and any further activity cancels it, so
  a burst of keys is one toast rather than one per keystroke.
- **Quiet.** Having spoken, it says nothing for 30s. The promise only needs making once
  until something changes.

`retrying` and `conflict` ignore both and stay until dismissed (`timeout: 0`) — they are not
reassurance, they are news. A save that lands after trouble always speaks, however recently
it last did, because it is the answer to a warning still on the screen.

#### Consequences

- The pending transcript note is now "Nothing has read your handwriting back yet." The
  *failed* note keeps "Your ink is saved" — that one is a moment of alarm and the
  reassurance is load bearing there. The pending one was only duplicating the save line.
- `.toast-viewport` is lifted to `4.75rem` off the bottom. Silica parks it 16px up, which on
  a phone is on top of the selection bar; a message about saving must never cover Delete.
- The "Saved" toast hides its close button. It leaves in 2.4s on its own, and a dismiss
  control makes reassurance look like an alert. The two that stay keep theirs.
- `Canvas` is wrapped in `ToastProvider`. The root layout is a server component, and the
  canvas is the only surface with save state to report.

### ADR-067 — Export, because the privacy policy already promised it

**Date:** 2026-08-22
**Status:** accepted

`apps/web/content/legal/privacy.md`, live on the site since it went up:

> **Export** is available at any time and gives you a zip of markdown files plus the
> original recordings and images.

`docs/13-security-and-privacy.md` says the same thing and adds the reasoning: *"a product
people can leave is a product people trust enough to join"*. There was no export anywhere in
the codebase. A repo-wide search found no markdown, SVG, PNG or zip download and no route
that set `content-disposition`.

That is a false statement in a legal document, made by the only holder of handwriting that
exists nowhere else. It is why export went to the front of the queue ahead of five features
with better demos, and it also settled the format argument before it started: the policy had
already specified markdown plus originals, so the job was to make the sentence true rather
than to design something.

#### What ships

    GET  /export/note/<id>?format=md|svg|png|zip
    POST /export/note/<id>   {format, strokeIds}    just what the lasso caught
    GET  /export/space/<id>                         everything, as one archive

The space route is the one the policy describes, and it is reachable from the account page
rather than from a support address. A promise you have to email someone to collect on is a
slower way of saying no.

#### The renderer moved to the domain

`renderNote` and `renderBlock` were module-private inside `apps/mcp`. They are now
`packages/domain/src/render.ts`, because what a person downloads and what an agent is handed
have to be the same account of the same page. Two copies would drift, and only one of them is
ever checked — the export would quietly stop marking handwriting as handwriting while the MCP
suite stayed green.

#### A third render mode, and why two were not enough

`recognition` flattens every pen to black on white, because a model reading pale grey ink on
cream paper is doing two jobs and does the second one worse. `preview` keeps colour but
leaves the background `fill="none"`, caps the longest edge at 480px and refuses to enlarge —
correct for a thumbnail on a card that supplies its own background.

Neither suits a person. So `viewing`: real colours, opaque white paper, 1600px, upscaling
allowed. **The white is the load-bearing part.** A transparent PNG opened against a dark
background is invisible ink, and the person who exported it has no way to tell that from an
empty page.

#### The rasteriser is a separate entry point

`sharp` is a native binary. `apps/web` imports `@jotacular/ink-render` for its geometry, so
`toPng` lives at `@jotacular/ink-render/raster` — a second export path — rather than behind the
package's main one. The four inline lines that used to do this in `apps/worker/src/recognize.ts`
are gone; the worker, the export routes and (next) the MCP page view all call the same
function. `sharp` is now also a dependency of `apps/web` and is named in
`serverExternalPackages`; it traces into `.next/standalone` correctly, which was checked
rather than assumed.

#### The zip is written by hand, and stored rather than deflated

`apps/web` has no archive dependency and this is a hundred lines of a format from 1989.
Stored, not compressed: the contents are markdown, SVG, and already-compressed JPEG and Opus.

The archive is built in memory, which is the honest constraint — a year of voice notes is
gigabytes and a route handler holding that gets killed. So there is a ceiling, and when it is
reached `README.txt` **names every file that was left out**. A silent truncation would be the
same failure as the missing export itself, one layer down.

#### Exporting is not four hundred reads

`getNote` writes a `note.read` audit row per call, so a space export built by looping it would
bury every read that meant something under four hundred that meant "a zip was made".
`exportSpace` is two queries and one `space.export` row.

It also calls `assertMember` explicitly. `canReachSpace` returns `true` for any signed-in
person by design — RLS is the real boundary — so without it, exporting a stranger's space
would hand back a perfectly valid archive of nothing *and* leave a row in their log saying it
happened. Refused, not empty. ADR-020.

#### A selection exports as a picture

`SelectionSummary` gains `ids`, and `SelectionBar` a download button. The client posts the ids
and nothing else: the strokes are taken from the **server's** copy of the page, so an export
can never contain a stroke that was not saved. The frame comes from the strokes being drawn,
so a lasso round one diagram crops to that diagram.

#### Consequences

- `apps/web/lib/zip.ts` is verified against Python's `zipfile` — `testzip()` checks every CRC.
  Signature bytes are not evidence that an archive opens.
- `packages/ink-render/scripts/smoke-raster.ts` decodes the PNG and reads pixels. Every
  earlier bug in this renderer was valid markup and a wrong image; asserting on the string
  would have passed all of them.
- The first version of `smoke-export.ts` read `audit_log` through `withoutActor`, where the
  policy matches nothing and every count is zero — so "the export read nothing" passed for the
  wrong reason. It reads as the user now, and asserts the contrasting case.
- `docs/12-roadmap.md` still claims the iOS share sheet is built. It is not (ADR pending,
  M9); the roadmap is corrected here.

### ADR-068 — An agent can look at the page, not only read it

**Date:** 2026-08-22
**Status:** accepted

A transcript carries words. That is the whole of what it carries.

An arrow between two boxes, a crossed-out line, a freehand table, a sketch of a room, a
circled total with a line to a margin note — recognition returns
`_[handwritten, nothing legible on it]_`, which is **true**, and which an agent correctly
reads as "this page is blank". The recogniser did not fail. It was asked for text and there
was no text; the meaning was in the layout, and layout is not what it was asked for.

This is a structural limit of Tier 2 (docs/08-ink.md), not a quality problem, so no better
prompt and no better model fixes it. The fix is to stop asking for a description and hand
over the thing itself.

**We can, and almost nobody else could.** We never flattened the strokes (docs/08 is
emphatic about this), so a page can be redrawn at any size on demand. A product holding a
photograph of that page has one fixed raster and no way back.

#### One tool, and it costs a slot

`view_note(note_id)`. The budget is "under a dozen" and this makes ten. It earns the slot
because it is the only capability in the surface that is ours alone — everything else we
expose, a competent notes API could expose too.

It takes a note id, not a block id. `findInkBlock` already means "the note's writing surface",
and inventing a block-id vocabulary for agents before a second ink page per note exists would
be building an address space for one address.

#### The caption is load bearing

`view_note` returns **two** content blocks: a caption, then the image.

An image arriving unframed is one a model describes as though somebody had emailed it a
photograph. Worse, an agent holding both a picture and a transcript has no way to know which
to believe when they differ — and they will differ. So the caption says, in order: what the
page is, that **the drawing is the record**, that the transcript is a reading of it, and that
where they disagree the page wins.

Its branches are the same honesty `renderBlock` applies to text, and one of them is the whole
point of the tool:

> A reader found no words on it. That is often RIGHT and not a failure — a diagram, a sketch
> or a table has layout rather than sentences. Describe what you can see.

A transcript the author typed themselves is attributed to them and carries no confidence
figure, for the reason ADR-056 gives: they are not "82% sure".

#### Consequences

- `apps/mcp` gains `@jotacular/ink-render` and `sharp`. `mcp.Dockerfile` carries both, and its
  header now repeats worker.Dockerfile's warning verbatim: sharp's musl binaries are fetched
  by an install script pnpm runs *only* because of `pnpm.onlyBuiltDependencies`. Remove that
  entry and the install still succeeds; the first `view_note` in production dies.
- **`images:check` now asserts that entry**, for every app that depends on sharp — three of
  them now. The rule that caught `@jotacular/reason` did not cover native packages, and this is
  the same failure with a different shape: green everywhere, dead in the container.
- `InkBlock` gains `transcriptSource`. The caption has to tell a person's own correction from
  a model's guess, and `findInkBlock` was not returning it.
- A blank ink layer returns a **sentence**, not a 1x1 image. `bounds()` is null by design for
  an empty page and every caller has to handle it; presenting a transparent pixel as somebody's
  page is worse than saying the page is empty.
- `smoke-view.ts` is pure and checks the caption's branches. `smoke-mcp.ts` checks that the
  image block survives a real MCP transport — a renderer unit test passes whether or not the
  SDK ever puts the bytes on the wire.

### ADR-063 — When a thought arrived, and what has happened since

**Date:** 2026-08-22
**Status:** accepted

`docs/00-vision.md` opens with *"in the car, at the school gate, three minutes before a
meeting"*. The whole thesis is about **when** a thought arrived.

`searchNotes` and `listNotes` took `(actor, spaceId, query|limit)`. No date range, no cursor,
no `since`, anywhere in the product.

#### The date has to go inside each strategy, not after fusion

This is the part that is easy to get wrong and impossible to see once wrong.

`searchNotes` fuses three independently ranked lists with RRF, and recalls **four times
deeper than the limit** so fusion has something to rank — `search.ts` documents why. A date
predicate applied to the fused list spends all of that headroom on rows it then throws away,
and returns fewer than `limit` whenever a date is supplied.

It does not look like a bug. It looks like "the search found less this time".

So the predicate lives in `time-window.ts` and every strategy takes it. Proved rather than
asserted: `smoke-changes.ts` puts exactly five matching notes inside a window, out of twelve
that match the query equally well, and asks for five. Moving the filter back outside was
tried, and the check went from 5 to 1.

`search.ts` was at 247 lines, so this split it — `search-strategies.ts` is how each way of
looking recalls, `search.ts` is how three answers become one. They change for different
reasons.

#### Keyset, not OFFSET

`(pinned, updated_at, id)`, matching the ORDER BY exactly. OFFSET drops a note whenever
somebody edits one on an earlier page between two requests, and editing notes is what people
do here all day. `id` is in both the order and the cursor because two notes saved in the same
millisecond are ordinary, and without a tiebreak the page boundary lands between them and
loses one.

#### The feed, and the two things wrong with the log it is built on

`audit_log` had the right shape and the right index. It had almost nothing worth reading:

- **Five actions were ever written**, all by a signed-in person. Comments — the single
  highest-signal event in a shared space — were not audited at all. Neither were transcripts
  arriving, nor a person correcting one.
- **`note.read` outnumbers everything else put together.** `get_note` writes one per call.

So `audit()` gained an `extra` metadata argument and three new call sites, and the feed
excludes `note.read` — with a partial index on exactly that predicate, so the common query
never touches the dominant rows.

#### The worker could not write to it, and would not have said so

`recordSystemChange` goes through `app_record_change`, a SECURITY DEFINER function, because
the worker runs inside `withoutActor` — and `audit_log`'s policy is `app_can_reach_space()`.
With no actor, a plain INSERT there **does not fail**. It inserts zero rows and reports
success.

Which meant `audit_log` had to lose FORCE. 0028 left it set with a reason that was true then
("no definer function writes to them") and is not now. `smoke-rls`'s catalogue-derived guard
is what makes that safe to have got wrong: it derives the rule from `pg_proc` rather than a
list, so the migration and the check cannot drift. ADR-057.

#### Consequences

- One MCP slot spent (`changes_notes`, eleven of under twelve). `since`/`until` went onto the
  existing `search_notes` and `list_notes` rather than spawning dated variants — the budget
  does not allow a tool per filter.
- **An unparseable date is refused, not ignored.** A model asked for "notes since last
  Tuesday" computes a date and sends it; a parser that turns garbage into `undefined` answers
  that with the whole notebook, which reads as a working filter returning a lot of results.
- The feed carries the comment body inline. One that says somebody commented and makes you
  fetch the note to find out what they said is a notification, not a feed.
- `who` is words — "you", "an agent", "jotacular", "someone else in this space" — never a uuid.
  This is read by something that will paraphrase it to a person.
- Old call signatures still work: `listNotes(actor, space, 25)` and `searchNotes(..., 25)` take
  a number as before. Chasing every caller in the same commit as the feature is how a
  refactor becomes the thing that broke production.

### ADR-061 — One live line, and a drawer for the work

**2026-08-22.** The canvas had four places to look for "something happened": a save line
centred at the foot, a save toast bottom right (ADR-060), a stack of agent cards bottom left,
and a 34rem transcript panel bottom centre. Three of them occupied the same band along the
bottom of the page, none of them knew the others existed, and two of them said "saved" at
once about different things. On a page whose whole claim is that it stays out of your way,
four status surfaces is three too many.

There is now **one line**, bottom centre, small, in the same place every time.

#### Trouble, then a flash, then the baseline

Everything that speaks publishes an entry with a tone, and the line resolves them:

- **trouble** — `retrying`, `conflict`, ink that will not sync. Holds the line until it is
  fixed. These are news, not reassurance.
- **transient** — "Saved". Sits over the top of whatever was standing for two seconds and
  then falls back to it.
- **standing** — outstanding agent remarks, the reading of a page of handwriting. The
  baseline, and ranked: something to DEAL WITH (rank 20) outranks something to know (10).

The line **opens** rather than growing, upward, so the line itself never moves. What is
behind it is every standing entry that has a body — the newest remark, the transcript with
its confidence badge and its Fix button. Nothing that can be acted on is ever only a line.

The `+N` on the line counts what opening would actually show, not how many entries exist.
"Reading your handwriting" is standing but has no body, and promising a second item that
does not appear is a small lie the line cannot afford.

#### A remark is work, and work needs somewhere to live

The feed is about NOW. An agent's remark is not: "the MOT has a deadline" may not be dealt
with until Thursday, and something you come back to cannot live somewhere that scrolls away.
So remarks also have a **drawer** — every remark this note has ever collected, newest first,
resolved ones kept and greyed rather than deleted, because "did I already deal with that?"
is a question a list of only the outstanding ones cannot answer.

Two ways in, on purpose. The line carries them while they are outstanding. The button in the
chrome carries them afterwards, and appears only once an agent has ever spoken about the page
— a button for a conversation that has not happened teaches nobody anything.

#### Consequences

- `Notices.tsx` is gone. `RemarksDrawer` / `RemarksFeed` / `RemarksButton` replace it, over a
  `RemarksProvider` that holds the comments and the drawer's open state.
- The pages compose `CanvasStage` around the canvas instead of rendering `Notices` as a
  sibling. Two surfaces reporting on one note have to share a provider.
- `InkTranscript` is headless and publishes; `TranscriptCard` is the body it publishes, and
  owns its own editing state so a correction does not republish the line per keystroke.
- Ink speaks only when something is wrong. "Saving ink…" was true for a tenth of a second at
  a time and told nobody anything they could act on. `useInkTrouble` in `use-ink-feed.ts`,
  because `InkCanvas` was at the size limit and being edited.
- The toast is retired, and with it `ToastProvider`. A toast that fires on autosave is a
  drumbeat wherever you put it.
- **`.jd-live` must not carry `jd-chrome`.** That class forces `position: absolute`, which
  takes the line out of the dock's flow and hangs it below the fold — the exact failure
  canvas.css documents at length. Glass surfaces declare `--u-accent`, `--glass-tint` and the
  shadow themselves.

### ADR-064 — A link is a capture, and a photo goes round us

**Date:** 2026-08-22
**Status:** accepted

The risk register calls slow capture **fatal**. The share sheet is where most thoughts
actually arrive — a link, a screenshot, a paragraph from a message — and none of them could
reach jotacular without opening it first.

#### A URL had to arrive pre-formatted, and then titled the note with itself

`POST /v1/capture` took `text` and nothing else. A shared link therefore arrived as literal
text, and `inferTitle` names a note from its first line — so a note captured from a news
article was titled with two hundred characters of slug and tracking parameters, which is
unreadable in a list a week later.

`captureText` in the domain now takes `{title, text, url}` and orders them so that whatever a
person would call the thing is first. A **bare URL** gets its host as the first line:

    theguardian.com

    https://www.theguardian.com/lifeandstyle/2026/aug/12/a-very-long-slug…?utm_source=share

The link is kept whole, tracking parameters and all. A title is recoverable; a truncated link
is not.

`apps/web/app/share/route.ts` was doing its own version of this join. It calls the same
function now, because a link shared from Android and the same link sent by a Shortcut should
not make two different notes.

#### The photo does NOT come through us

The obvious design is `POST /v1/capture` with multipart. It was rejected.

`docs/04-data-model.md` requires that media bytes never pass through the API: on Azure the
client PUTs straight to Blob with a short-lived SAS URL and our servers hold only the
metadata. A multipart endpoint would put every photo anybody ever captures through a service
whose `bodyLimit` is 1MB and whose pods are sized for JSON, on a **public route authenticated
by a long-lived bearer token**.

So a Shortcut does what the browser already does:

    POST /v1/capture/media        reserve a block, get somewhere to put it
    PUT  <upload_url>             the bytes, straight to storage
    POST /v1/capture/media/:id    say how many bytes arrived

Three requests instead of one is awkward. Shortcuts chains them without complaint, and
awkward is a better trade than a byte proxy. The note exists from step one — in `pending` —
so a capture interrupted between steps leaves a visible, explainable gap rather than nothing.

The domain needed no new permission for any of this: `createMediaBlock` and `finalizeMedia`
already accepted a capture actor. What was missing was HTTP surface.

#### The one place bytes DO pass through us

`share/route.ts`, and it is not a choice. The manifest has advertised `image/*` and `audio/*`
since launch and the route ignored them, so **a shared screenshot silently became an empty
note**. The Web Share Target spec has no browser→blob path: the file arrives inside the POST
body or it does not arrive.

So it is implemented, capped at 30MB, and named as the exception it is — in the route, in
`docs/04`, and here. A photo that fails to store costs the photo and nothing else; the text is
already saved and the person still lands on their note.

#### Consequences

- `assets/shortcuts/README.md` now exists: the three recipes in one place, with the reason
  `request_id` is worth an extra action and the reason a link goes in `url` rather than `text`.
- A photo with no words on it gets a first line anyway (`Photo: IMG_4821.jpg`), so it does not
  land in the list as an untitled blank row — the same complaint `listNotes`' preview join
  exists to answer.
- `docs/12-roadmap.md` ticked "iOS Shortcuts: … share sheet" for months while
  `docs/09-shortcuts.md` correctly said it was not built. Both are true now, which is the
  ordinary way to resolve that disagreement and not the one that was available before.
- `byte_size` is a CLAIM. It is bounds-checked at finalize and rechecked by the worker against
  what it actually reads; trusting it would let a client reserve a block for "2KB" and upload
  two gigabytes.

### ADR-062 — The search field becomes an icon

**2026-08-22.** The pill at the top of the canvas held a search field dressed as an input —
a button styled to look like a field, so it read as somewhere to type while never taking
focus off the note (ADR-022). It was the widest thing in the pill by a distance: 212px of a
544px bar, against 32px for every tool beside it.

Two things made that untenable. ADR-061 added a remarks button, and the pill was already
over the width of a phone once touch targets grow to 2.75rem. And the field was the only
element in a bar of icons wearing a costume — a costume whose whole job was to say "you can
search here", which the magnifier says in a tenth of the space.

The pill is now **378px** instead of 544px, with the remarks button included: a 166px
reduction while gaining a control.

#### Nothing was lost, it moved

"Search notes, or jump somewhere" is the command palette's own placeholder, so the sentence
now appears where somebody is actually about to type it rather than on a button that cannot
be typed into. `⌘K` moved to the `title`, which is where a keyboard hint belongs on a control
that is one key away anyway.

The glyph changed too. It was `⌕` (U+2315) — a bare Unicode character of exactly the kind
ADR-044 removed from the tool rail, because Inter serves none of them and every one falls
through to a system font. It is Lucide's `Search` now, like every other icon in the bar.

#### One rhythm across the bar

Adding a second control after the trailing separator exposed a spacing bug that had been
invisible while the avatar sat there alone. The pill spaced its own children at `gap-1`
(4px) while the tool rail spaced its seven at `gap-0.5` (2px), and the separators add 4px of
their own margin on each side. So the bar ran 8px, 8px, 2px ×6, 8px, 8px, **4px** — the last
pair being the only two-item group whose internal gap did not match the tools.

The pill now uses the rail's `gap-0.5`, which leaves one rhythm: **2px inside a group, 6px
across a separator, every button 32x32.** The separators do the grouping, which is what they
are for; proximity was doing it a second time and disagreeing about the amount.

The one deliberate exception is an account photo, which renders at 24px inside its 32px
button where every icon renders at 16px. A 16px face is not a face.

#### The pill is sized by its contents

`width: min(94vw, 34rem)` was the width the search field wanted. With nothing in the bar
that stretches, that fixed width was mostly empty glass, so it is `max-width:
calc(100vw - 1.5rem)` and otherwise sized by what is in it.

#### What this does not fix

At a coarse pointer the ten controls want 498px, and a 390px phone offers 366px. They are
flex items with no `flex: none`, so they compress rather than clip — landing at about the
32px they already are on a desktop. It degrades, it does not break, and the underlying
squeeze (seven tools at 2.75rem is 308px of a phone) is older than this ADR and not
addressed by it.

### ADR-065 — Text is an object on the canvas, not the surface under it

**Date:** 2026-08-22
**Status:** accepted

Three observations that turn out to be one:

1. You could not select typed text and handwriting together.
2. The base of the canvas *felt* like a typing area with drawing on top, rather than a canvas
   that holds typing.
3. The endless canvas made this incoherent rather than merely inelegant: **the ink plane
   panned and zoomed; the `<textarea>` did not.** Pan twice and your handwriting annotated
   empty space.

(1) and (2) are the same problem — typed text was a DOM `<textarea>`, ink was pixels on a
canvas above it, and a lasso is canvas geometry that cannot reach into a textarea. (3) means
it was not optional: the page was inconsistent with itself.

#### Spine plus boxes, not full freeform

The full-freeform version — every piece of text a placed box — was rejected on two counts
that are not aesthetic:

- `docs/02-product-spec.md` calls *"tap capture, input is live in 300ms or less"*
  **non-negotiable**. A canvas that needs a box placed before typing adds an interaction to
  the one path the product exists to protect.
- `docs/08-ink.md` Tier 1: **Apple Scribble only works in real text fields.** Canvas-drawn
  text deletes the free handwriting story on the platform most of our users are on.

So the spine stays exactly what it was: one full-bleed textarea, `blocks` position 0, tap and
type. Boxes are the *additional* thing, and placing one is armed from the text tool's options
rather than from the rail — putting it in the rail would make every tap a decision about
where the words go.

#### Boxes live in the layer document, NOT as `blocks` rows

The obvious choice is a row per box. It breaks live collaboration.

`useNoteBody`'s `adopt()` refuses a remote revision while `dirty()`, and with N boxes sharing
one `notes.revision`, "dirty" means **any box is mid-edit**. Somebody moving box A is
silently dropped because you are typing in box B. N objects contending on one optimistic
counter is a conflict machine.

In `media_assets.strokes` they inherit ADR-058 whole: id-named objects, commutative
`{remove, upsert}` deltas, one version, one subscription, `mergePages` folding the upload
queue back in.

#### Two arrays, and that is the correctness argument

The plan called for one polymorphic `CanvasObject[]` discriminated on `type`. It ships as
`strokes[]` and `texts[]`, and the reason is worth more than the uniformity:

**`toSvg` renders `doc.strokes`.** With two arrays, typed text cannot reach the recogniser —
not by convention, by construction. If it could, the model would read it back as handwriting
and `renderBlock` would present a confidence-scored guess where a certainty already existed.
A single array plus a filter is one careless edit away from losing that; `RenderOptions.text`
defaults to **false** as the second belt.

`remove` still spans both kinds, because one lasso holds both and deleting it has to be ONE
delta — two would let somebody else's edit interleave and leave half a selection behind.

#### The wire did not have to change

A text edit bumps `strokes_version` without moving the stroke count. `needsFullRead` already
reads that as "the middle changed, re-read it whole" — which is exactly right for text. No
`strokeCount` → `objectCount` rename, no coordinated client and server deploy.

#### Findable, because a companion row makes it so

`blocks.searchable` is `GENERATED ALWAYS AS to_tsvector(coalesce(body, transcript, ''))`, so
text living only in jsonb is invisible to lexical search, embeddings, `inferTitle` and
`renderBlock`. The layer gets a companion `blocks` row — `kind='text'`, `artifact_id` → the
layer, body = the boxes flattened in reading order — and all four work with **no new paths**.

Reading order is derived: top to bottom, then left to right, with row banding so a two-column
layout does not interleave. `tiles.ts` already solves this for recognition and the rule is
borrowed rather than reinvented. The flattened text **says** the order is spatial, because
this codebase does not present a derived fact as an authored one.

**This forced a latent bug fixed.** `readBody` selected `WHERE kind='text'` and joined *all*
of them, while `writeTextBlock` only ever wrote position 0. Dormant with one row; with a
second it would put box text into the typing surface and the next autosave would save it into
the spine as though it had been typed. Both now agree on `artifact_id IS NULL`.

#### The plane

    .jd-ink-shell
      .jd-ink-grid          CSS custom properties, per frame
      .jd-object-plane      CSS transform: translate(x,y) scale(k)   <- new
        .jd-text-box*       absolutely positioned, world units, real <textarea>
      canvas committed      internal setTransform(dpr*k, ...)
      canvas live           internal setTransform

The canvases stay OUTSIDE the transformed layer: scaling a `<canvas>` through a transformed
ancestor scales its bitmap and blurs the ink. Both read the same `InkViewport`, and the
plane's transform is written where `paintGrid` is written — inside the frame loop — because
text one frame behind the ink during a pinch reads as the two layers coming apart.

A box is never declared below **16px**. iOS Safari zooms the page when a focused field's
COMPUTED font-size is under 16, and it tests that before any ancestor transform, so the
camera does the shrinking and the declared size never moves.

The plane itself never takes a pointer — a lasso has to pass through it to reach the canvas.
Individual boxes take one only while the box tool is armed **or while a box has the caret**,
which is what lets placing a box hand the tool straight back to the spine without the caret
dying with it.

#### Two product calls, both matching whiteboard convention

- **The eraser does not delete text boxes.** Rubbing at a diagram should not silently swallow
  the label beside it. Lasso and Delete are how a box goes.
- **`restyleSelection`'s `{color, width}` does not apply to them.** A width means nothing to a
  paragraph, and a mixed selection should recolour the ink it caught rather than quietly
  restyling the words too.

Selection uses **one containment rule for both kinds**: all four corners inside the lasso,
which is ADR-033's whole-object rule applied to a rectangle. A mixed selection is only
explicable if one standard governs it.

#### Consequences

- `ink-engine.ts` split. `ink-engine-select.ts` is what a selection can be turned into — it
  reaches two arrays now and had outgrown a class that also owns the frame loop. The text
  half is `ink-text-layer.ts` (state) and `ink-plane.ts` (DOM).
- `fitToContent` unions text bounds, and `contentBounds` joins `bounds` in ink-render. A note
  with nothing but a typed box has no stroke bounds at all and would otherwise open on blank
  paper and export as a 1x1 image.
- **No migration.** `blocks.kind` already allows `'text'` with an `artifact_id`, and the boxes
  live in a jsonb column that already existed. The plan expected to widen
  `media_assets.kind`; it did not need to, because the layer is still an ink layer.
- `docs/04-data-model.md` claimed a `unique (note_id, position)` constraint for months that
  `0000_init.sql` never created. Reading order depends on position now, so it is corrected
  rather than added.
- Verified in a browser, on the running app: a box placed, typed into, saved to the layer,
  written to the companion row, and restored on reload — with the spine still showing the
  spine. Three bugs this week passed every suite and were only visible in production.

### ADR-066 — Shapes snap when you hold, and nothing ever asks you to confirm

**Date:** 2026-08-22
**Status:** accepted

Two halves, and they answer different questions about the same page.

#### Hold to snap, and the popup we did not build

The obvious design is a suggestion with a green check and a red X. It was considered and
rejected, on grounds that are in the product spec rather than in taste:
`docs/02-product-spec.md` calls sub-second capture **non-negotiable**, and the risk register
calls slow capture **fatal**. A confirm dialog puts a *decision* in the capture moment, every
time, including the overwhelming majority of times when the answer is no.

So: finish a stroke, keep the pen down a beat, and the rough circle becomes a circle. Lift
immediately and you keep exactly what you drew. **The rule is that ignoring a suggestion must
be free** — and here ignoring it is the thing your hand already does.

`HOLD_MS` is 420: long enough not to fire on the pause between two letters, short enough that
somebody who meant it does not think it is broken. The drift allowance is measured in SCREEN
pixels, so it means the same thing at any zoom, and it fires once per stroke — a shape that
kept re-snapping would fight anyone still moving.

#### The classifier is built to say nothing

Most of what anybody draws is not a shape. A recogniser that fired on the letter O would make
writing on the canvas impossible, so every threshold is set so that "ambiguous" returns
`null`.

`smoke-shapes.ts` leads with the false-positive cases, and that ordering is the argument:
**a snap nobody asked for silently replaces what somebody drew; a snap that did not happen
leaves the page exactly as they left it.** Only one of those is recoverable. The suite checks
that a small letter O, a scribble, a lumpy loop and a wavy line are all left alone before it
checks that a circle is a circle.

A snapped stroke carries the original's pressure, tilt and timing rather than inventing them.
They are what a better recogniser reads later, and a shape with fabricated pressure is a
stroke claiming to have been drawn. It also keeps its **id**: the preview has already been
painted under that id, so a snap has to be the same stroke with different points, or every
watching device draws the shape twice.

#### Structure, asynchronously, which is the bigger prize

A transcript carries words. An arrow is not a word.

`block_structures` holds what a second pass over the same page found: shapes with bounds,
labels, and — the valuable part — `from` and `to` indices saying which shapes an arrow joins.
That is the difference between a diagram an agent can look at (ADR-068) and one it can reason
over.

**A table, not jsonb on `blocks`.** `blocks` has ONE transcript slot and `app_store_transcript`
overwrites it wholesale, so structure kept there would be destroyed by the next re-read — and
re-reading is something this product does deliberately (ADR-046). `smoke-structure.ts`
re-reads on purpose and then looks.

**Its own staleness key**, `struct:vlm:{model}/r2`, in its own column. 0026 explains why at
length: suffixing `transcript_source` would make every structured block permanently stale to
`countStale` and re-bill the entire corpus for readings that had not changed.

**Metered as `structure`, not as `ink`.** Without the distinction one page read twice looks
like two pages, and the allowance in docs/01 is counted in pages. `app_record_recognition`
gained a third argument by overload, so every existing caller keeps meaning what it meant.

#### One model, two questions

`Recognizer` gained `ask(pages, prompt)` returning the RAW answer, and `read` is now
`readWith(ask)` — one transport, two questions, and the parsing belongs to whoever asked,
because the answers have different shapes.

`fakeRecognizer` answers whichever question it was asked. The first version keyed on the word
"SHAPES" and the structural prompt never said it in capitals, so the fake replied to every
structural request with a transcript and the pipeline died on a parse error — **in the one
place a suite exists to catch exactly that.** Both sides now name a shared constant.

#### Consequences

- `RenderOptions.text` stays FALSE for the structural pass. Typed boxes on the plane are not
  drawn shapes, and a model handed them would report the note's own paragraphs as diagram
  nodes. ADR-065.
- ONE image, not tiles: a diagram's meaning is in the relationships between its parts, and a
  model handed a quarter of it at a time cannot see them.
- A page with nothing drawn on it still gets a stored, empty result. "Looked, no diagram" and
  "never looked" are different facts, and a reader that conflates them reports a blank page as
  a considered answer — the same distinction ADR-056 draws for coverage.
- A malformed shape from the model is DROPPED, not fatal. One bad box must not cost somebody
  the reading of their whole diagram.
- **0031 was already applied when the metering overload was written, so it went into 0032.**
  Editing an applied migration means the change never runs on that database and does run on
  every fresh one — a divergence that reads as "works in CI, broken locally". A migration is a
  record of what ran.
- `meteredKinds` reads AS the actor. `recognition_usage`'s policy is `app_can_reach_space()`,
  and `withoutActor` there returns zero for everything — which makes "nothing was billed" pass
  for entirely the wrong reason. The same trap `audit_log` set in ADR-063, caught this time by
  a check that was expecting it.

### ADR-069 — The tool surface is a submission, not just an interface

**2026-08-22.** jotacular's whole competitive position is that an agent can reach your notes
from your phone with no computer running. That position is worth nothing to a buyer who has
never heard of MCP, and two of our three audiences in
[01-audience-and-pricing.md](01-audience-and-pricing.md) have not.

The fix is a directory listing — Anthropic's Connectors Directory, and the ChatGPT app
directory. Neither is a second product. **A listing IS this MCP server**, with a name, an
icon, and an install button in front of it, and the expensive half was built a year ago in
[06-auth.md](06-auth.md). Full research in [18-app-directories.md](18-app-directories.md).

What that costs us is a permanent constraint on how tools are declared.

#### Annotations, which we had simply never shipped

Every tool carried a `title` and a description and no `annotations` object at all. Both
directories check for them mechanically — Anthropic's portal syncs the tool list off the live
server and refuses one that is missing them, and OpenAI names bad annotations as its first
rejection reason.

They are not paperwork. `readOnlyHint` is what lets a client run a tool without asking, and
`destructiveHint` is what makes it always ask. Shipping neither means a client has to guess,
and it guesses conservatively — every call a prompt.

#### Descriptions may not rank each other

This is the part that cost something real. Our descriptions said `PREFER THIS over editing`,
`Prefer this over update_note`, `Almost always the wrong tool`. Every one was true, and every
one is a stated rejection cause: a description that steers a model away from its neighbours is
indistinguishable, to a reviewer and to a scanner, from one that steers it anywhere else.

So descriptions now say what a tool does and what it is for, and stop. The safety those
sentences were carrying moved to annotations, which enforce rather than ask.

#### Consequences

- `tools.ts` passed 250 lines and split by responsibility, as the repo rule requires:
  `tools-read.ts` is what can be looked at, `tools-write.ts` is what can be added, and
  `tool-kit.ts` is what a declaration is made of. The split is the one the directories
  themselves insist on — a tool may not be both.
- **`pnpm mcp:tools` is the guard.** It registers every tool into a recorder and holds it to
  what a reviewer checks: name length, namespacing, title, annotations, description substance,
  and the absence of steering language. No network, no database, runs in CI.
- The server's own `instructions` were reworded the same way. "Do not rewrite what the person
  wrote" became a description of what comments are for.
- The check caught its own author: the namespacing rule in
  [05-mcp-server.md](05-mcp-server.md) is written as "ends in `_note`, `_notes` or `_spaces`",
  which `list_note_comments` has always violated while satisfying the actual requirement.
  The rule is that a name carries our noun, so a collision with kanninja's `list_comments` is
  impossible. The check encodes the requirement, not the shorthand.

### ADR-070 — An agent cannot overwrite what you wrote, because there is no tool that can

**2026-08-22.** `update_note` is gone from the MCP surface. So is the `notes:edit` scope.

We had already decided this three times without finishing it: an agent's normal output is a
comment (ADR-004), the edit scope is off until granted per space, and `update_note`'s
description was written to be as discouraging as prose can be. A capability that is off by
default, awkward on purpose, and granted by almost nobody was still costing a tool slot from a
budget of eleven, a row on the consent screen, a scope in every grant, and — once ADR-069
landed — the only confirmation prompt in the entire surface.

Removing it converts a promise into a property. [13-security-and-privacy.md](13-security-and-privacy.md)
listed "agent silently destroying content" as a *mitigated* risk. It is now an impossible one,
and that is a sentence the family and the small business can both check: **an agent can read
your notes and add to them, and it cannot change or delete what you wrote.**

#### What we gave up

An agent correcting a bad handwriting transcript in place. That is a real use case and this
was a poor instrument for it: replacing a whole note body destroys per-block provenance and
contradicts ADR-068, where the drawing is the record and the transcript is a reading of it. If
it earns a tool later it wants a narrow one that touches a single block and leaves the strokes
alone — and there is now a free slot for it.

#### Consequences

- `saveNote` refuses any actor that is not a person. Not a scope check — a type check, and the
  typechecker immediately proved it by flagging the `"edited by agent"` branch downstream as
  unreachable. That branch is gone.
- **`create_note` had never worked.** It required `notes:write`, which is not in `SCOPES` and
  therefore cannot be granted to any OAuth client, so the tool threw `Forbidden` for every
  agent that ever called it. [05-mcp-server.md](05-mcp-server.md) said `notes:write` in the
  tool table and `notes:append` in the scope table, and the code followed the wrong one. It
  now follows the scope table: creating a note adds without touching anything that exists,
  which is the same bargain appending makes. A tool that cannot succeed is also an automatic
  directory rejection.
- The review inbox is unchanged and still the safety control it was — appends write revisions
  exactly as edits did. `smoke-review` now exercises it through `appendToNote`, which is the
  only way an agent touches a note at all.
- `mcp:tools` asserts that **no tool is destructive**. If that check ever fails, an edit path
  came back and the consent screen started lying.

### ADR-071 — A definer function cannot READ a forced table either

**2026-08-23.** `media_assets` loses `FORCE ROW LEVEL SECURITY`, and `smoke-rls`'s guard stops
asking about writes.

ADR-057 found this on three tables and 0028 found it on twelve more, and both times we wrote
the rule down as being about **writes**. The sentence 0028 used to justify leaving
`media_assets` alone is still true and was never the whole rule:

> no definer function writes to them — the application does, as `jotacular_app`

`app_claim_recognize_jobs` is `SECURITY DEFINER` and does not write to `media_assets`. It
**joins** it, twice, to answer "does this block still have anything on it worth reading".
FORCE strips the owner's exemption for `SELECT` exactly as thoroughly as for `UPDATE`, so the
join matched nothing and the function's own guard — `NOT EXISTS (... jsonb_array_length(
a.strokes -> 'strokes') > 0)` — was true for every job. The comment above that clause says
what it believed it was doing: *"Nothing to read. Per kind: an ink page erased back to empty."*

**Every page in the product looked erased.**

#### What that actually did

Each job was marked completed **with no error**. The claim returned zero rows. The worker logs
only when it claims something, so it logged nothing. Every block stayed at `transcript_state
'pending'` forever. Handwriting was never read and not one line anywhere said so — the only
visible symptom was a spinner that never resolved.

It could not be seen from a laptop either, for the same reason ADR-057 could not: a
developer's admin URL is `postgres`, a superuser, and superusers bypass RLS unconditionally,
FORCE included. Same shape as ADR-057, one verb over.

#### Consequences

- `ALTER TABLE media_assets NO FORCE ROW LEVEL SECURITY` (0033), with a table comment saying
  why it must never be set again.
- **`smoke-rls`'s guard was the reason this survived two migrations.** It derived offenders
  from function bodies matching `insert into|update|delete from <table>`, so a definer
  function that merely SELECTs a forced table was invisible to it. It now matches **any**
  reference to the table name, and the check is renamed from WRITES to TOUCHES. Deliberately
  broad: a false positive costs a comment explaining why a table is exempt, and a false
  negative costs a feature that reports success while doing nothing at all.
- What defends the boundary is unchanged, and it was never this flag. `assertNotOwner()`
  refuses at startup if `DATABASE_URL` connects as a role that owns these tables, and
  `smoke-rls` asserts the same. FORCE was only ever a second lock on a door that is already
  bolted, fitted to a frame the hinges pass through.

**A read is not the lesser case. It is the one that fails quietly.**

---

### ADR-072 — The product is called Jotacular, and the plumbing is not

**2026-08-23.** The product is renamed from jotacular to **Jotacular**, on `jotacular.com`,
with a new palette, a new type pairing, and a new mark. [design.md](../design.md) is
canonical for the identity; [19-rebrand.md](19-rebrand.md) is the plan this executed.

#### What changed

The user-visible surface, and only that: metadata, the manifest, the marketing copy, the
blog and legal prose, the MCP server's own name and every tool description Claude reads,
the ink swatch names, the export filename, and the icons. `docs/10` and `docs/11` were
rewritten rather than patched, because both had a *thesis* — inherit kanninja's brand kit,
inherit kanninja's register — that the rename made false.

#### What deliberately did not change

Renaming these would cost a migration with downtime and buy nothing a user can see:

- `@jotacular/*` package names, and every import of them
- `jotacular_app` / `jotacular_owner` / `jotacular_worker`, and the `jotacular` database itself —
  renaming a role rewrites grants and RLS policies on a live database
- the `jotacular` Kubernetes namespace, and the Azure Key Vault and storage account, which
  live in sparx's `terraform/envs/azure/jotacular.tf` and are globally-unique immutable names
- `token.jotacularUserId` — a JWT claim. Renaming it invalidates every live session, logging
  out every user to change a string none of them can see
- the `jotacular.scribble-hint.dismissed` localStorage key, for the same reason one step down:
  a new key re-shows a hint people already dismissed
- the `jd-` CSS prefix, 100 classes across 36 files, invisible and high-churn
- **the ADRs above this one.** They are a dated record of what was decided when, under the
  name it had then. Rewriting them to say Jotacular would make the log lie

**The brand is a name for the product, not a name for the plumbing.** The two only look like
the same string.

#### Consequences

- `apps/web/lib/brand.ts` holds the name, the lines and the pigments. It exists because the
  name used to be a literal in eight places, which is what made the rename large.
- `connect-jotacular-to-claude` became `connect-jotacular-to-claude`, with a permanent
  redirect in `next.config.ts`. It is our most-linked post and a 404 there costs the one
  piece of SEO we have.
- `scripts/make-icons.mjs` now rasterizes committed artwork in `assets/brand/` instead of
  drawing a font glyph. The old script produced a blank tile on any machine without the CJK
  font, and failed loudly only because somebody had written a flatness check.
- Hostnames were **not** touched. See ADR-074.

---

### ADR-073 — The accent stops being a seal

**2026-08-23.** Vermillion was "one per screen": the seal marked the single most important
thing in a view and nothing else, and `docs/10` called it the strongest constraint in the
visual system. It is retired.

#### Why

design.md §11 makes mint the primary — CTAs, active states, helpful highlights. A colour
cannot be both the button colour and a rationed mark. Keeping the rule would have meant
finding a third colour for ordinary controls, which is a worse system than dropping it.

The rule also came from somewhere. A scarce ceremonial accent is a kanninja idea, fitted to
a product about discipline. Jotacular is friendly and immediate, and rationing its primary
would read as restraint the brand is not asking for.

#### Consequences

- Mint `#00C2A8` is `--color-primary` and used freely.
- Violet `#6A39FF` takes `--color-agent`, which is the job that token already had — design.md
  §11 assigns violet the "AI/agent association" independently. It is the one accent that
  never appears on a control the user drives, so agent content still reads as visiting.
- What carries the discipline now is the flat surface and the whitespace. A screen that
  feels loud gets fewer elements, not a rationed colour.
- The 覚 seal is gone from the site bar, the footer and the sign-in screen, replaced by the
  wordmark. `.jd-site-seal` was deleted rather than left unused.

---

### ADR-074 — The name moved before the hostnames did

**2026-08-23.** The product is called Jotacular everywhere a person can read it. It is still
served from `jotacular.com`, and that is deliberate rather than unfinished.

#### Why the hostnames lag

Two of the four are load-bearing in a way the marketing apex is not:

- **`app.jotacular.com` is the PWA install origin.** It is written into every installed
  home-screen icon and does not follow a redirect (ADR-010, and `16-web-presence.md` flagged
  this before the rebrand existed). Moving it forces every existing user to reinstall.
- **`mcp.jotacular.com/mcp` is `MCP_RESOURCE`**, and every access token is bound to that exact
  string as its audience. Changing it invalidates every live agent connection at once, and
  every user reconnects Claude by hand.

Neither cost buys anything the rename needed. A user reading "Jotacular" on a page served
from the old host notices nothing; a user whose Claude connector silently stopped working
notices immediately.

#### Consequences

- Content prose says Jotacular. Hostnames and `legal@` / `hello@` addresses in that prose
  still say jotacular, because documenting a URL that does not resolve is worse than an
  inconsistency a reader will forgive.
- Adding the new hostnames is a **two-repo change**: a Caddy site block and an allow-list
  entry in sparx, per `17-shared-infrastructure.md`. It cannot be done from this repo.
- `siteOrigin()`'s fallback still reads `https://jotacular.com`, which stays correct until the
  same commit that flips `SITE_URL`. Moving one without the other silently un-rebrands the
  site or breaks it, depending on which.
- When the cutover happens, `isMarketingHost` must accept **both** apexes for the overlap,
  or the old domain serves the app tree at its apex — which ADR-010 says can never happen.

**Rename what people read first. Move what machines are bound to on its own schedule.**

---

### ADR-075 — The site stopped arguing with Obsidian

**2026-08-23.** The marketing narrative is rebuilt to design.md §18. This is a separate
decision from the rename (ADR-072) and it is the larger of the two: renaming changed what
the site is called, this changed what it says.

#### What was there

A five-band argument, and every band was aimed at somebody already shopping for a notes app:

    Problem      "It never arrives at your desk"
    Beats        Jot / Connect / Ask
    AgentDemo    "The part that sounds made up"
    Objection    Obsidian needs a plugin, Apple Notes needs a script,
                 all of them need a machine left on
    Promises     what the software guarantees

It was well written and it was fighting the wrong fight. `Objection` in particular spent
its whole length describing other people's products to a reader who has not yet decided
they want any of this — and it led on "no computer left running", which is a fact about our
architecture rather than about their afternoon.

#### What replaced it

design.md §18's order, which starts from a person rather than from a category:

    CaptureModes   four ways in, equal weight -- write, type, speak, snap
    LakeStory      capture now, use later: the note at the lake, and the plan three
                   weeks later. The product's actual shape, told once, as it happens
    ConnectAI      one link, choose the spaces, done. MCP named once, at the bottom
    Objection      "You have tried the other ones" -- the objection a reader has
                   about THEMSELVES, not about a competitor
    Promises       who else can read a note, which is the real question after ConnectAI
    Examples       six situations, none of them a project
    Closing        "Catch the thought. Keep moving."

`Beats.tsx` and `AgentDemo.tsx` were deleted rather than edited; nothing in either survived
the change of subject.

#### Consequences

- The hero headline is now the product hook — *"Don't organize it. Just jot it."* — and
  `brand.line` ("Where the thought lands.") moved to the footer, which is what design.md §4
  means by a brand phrase rather than a headline.
- Two brand devices exist in CSS now and did not before: `.jd-ul`, a violet pen stroke
  under a few words in every band heading, and a dot grid on the quiet bands. Both are
  drawn as inline SVG rather than with `radial-gradient`, because design.md §12 bans
  gradients and drawing a flat dot with a gradient function invites the argument.
- **The footer lost its three promise cards.** With `Promises` on the page saying the same
  three things at length, the footer was repeating itself almost word for word three
  sections later. It keeps the Azure disclosure, which appears nowhere else.
- **Remapping the palette moved a meaning, and three things broke quietly.** `--color-accent`
  was vermillion, a seal; it is now violet, which is also `--color-agent`. That made a
  destructive-action hover, a "trouble" connection dot and a featured pricing plan all
  render in the colour that means *an agent did this* — and the live indicator's `trouble`
  and `standing` states became the same colour as each other. Danger and trouble moved to
  `error`, the plan and the blockquote to `primary`.

**A palette change is a semantics change.** The tokens kept their names, so nothing failed
to compile and nothing failed a test.

---

### ADR-076 — The page fills its own width, and nothing you must read is dimmed

**2026-08-23.** A visual pass over the marketing site after the rebrand. Five changes,
four of them corrections to habits rather than to decisions.

#### Fill the zone

`--measure: 34rem` inside a 62rem band meant every paragraph on the site occupied 55%
of its own width, left-aligned, with a dead column beside it. It was in `.jd-band p`,
so it applied everywhere at once and looked deliberate.

It is not a measure problem, it is a layout problem: a measure belongs to a paragraph,
not to a section. Bands are grids now. Pure prose reads in two columns (`.jd-prose-2`),
the lake story is two columns rather than a 42rem stack, the three connect steps are
three across, and the footer disclosure spans the foot instead of sitting in a 40rem
box with an empty half beside it. Only `.jd-lede` stays narrow, at 52ch, under a heading.

#### Nothing you must read is dimmed

Twenty-six rules carried `opacity` on text. Among them: the main navigation at `0.72`,
every lede at `0.78`, every card body at `0.8`, and the Azure disclosure in the footer
-- the one privacy statement that appears nowhere else on the site -- at `0.55`.

Body copy, navigation, links, ledes and disclosures are now full strength. Opacity is
kept for ambient furniture only, and never below `0.6` on anything with words in it.
Hover on a nav link is a colour change now rather than a return to full opacity, which
is a better affordance and stops advertising that the resting state was faded.

#### The hero is two columns, and the frame is paper

The hero was one full-bleed canvas with the headline lying on top of it. Honest, and
also a wall of cream with no shape above the fold. It is a two-column hero now: the
pitch on the left, the canvas on the right inside Silica's `mockup-window`, tilted
1.8deg clockwise and straightened the moment somebody engages.

What survives from ADR-010 is the part that mattered -- the thing on the right is not a
screenshot. It is the canvas, writable, saving to Postgres under the same RLS.

**The tilt is not decoration-only.** `lib/ink-pointer.ts` maps pointers with
`clientX - rect.left`, and a rotated ancestor gives it an axis-aligned bounding box of
a rotated element. Straightening on engagement means every stroke is drawn at 0deg;
choosing a pen is itself an engagement and happens on the rail, so the frame is square
before a pointer reaches the paper.

The frame is paper, not the charcoal bezel it started as. A black slab in the middle of
a cream page is a hole in the design.

#### The apex was serving 404s for every static file

`middleware.ts` rewrites the apex onto the `/site` tree, and `PASSTHROUGH` covered only
`/_next`, `/api` and `/favicon.ico`. So `/brand/wordmark.svg` was rewritten to
`/site/brand/wordmark.svg` and 404ed -- the wordmark in the site bar was a broken image
icon in every screenshot until somebody opened the page.

**Nothing caught it because the site had no images at all.** It also means the images
rule now in `10-design-system.md` was unshippable until this was fixed. `/brand`,
`/img`, the icons and the manifest pass through now; `robots.txt` and `sitemap.xml`
deliberately do not, because the apex has its own under `/site`.

#### Consequences

- `assets/brand/` holds vector now, and `pnpm icons` rasterises from it. The white
  variants are a string swap on one exact ink value rather than a pixel pass.
- The wordmark ships as SVG and is set at `1.5rem`; the sign-in masthead gets
  `.jd-wordmark-lg`.
- `smoke-site.ts` asserted "the headline is written ON the canvas, not above it",
  which described the layout this ADR replaced. It asserts the two things that are
  still load-bearing: the headline is in the hero, and the canvas is in a frame rather
  than a picture of one.

#### Two more, from the same review

**Colour is flat or it is nothing.** Three surfaces were drawn with
`color-mix(..., transparent)` -- the nav bar at 88%, the quiet bands at 82%, the hero
foot at 90% -- with a `backdrop-filter` behind them. That produces an in-between
instead of a committed colour, which is the same failure `design.md` §12 bans gradients
for. All three are solid theme colours now, and the blur went with them: it was doing
nothing behind a fill.

**No eyebrows.** Every band had picked up a small uppercase mint kicker above its
heading. It is a template tell, it is the same editorial reflex as the narrow measure
above, and it was reaching for colour that the underlines and the buttons already
carry. Removed from all seven bands and the class deleted, so it cannot come back by
habit.

#### One more the browser caught

`HeroCanvas` is a client component and I called `appOrigin()` inside it for the new CTA.
`APP_URL` is not inlined into the client bundle, so the server rendered the real origin
and the browser rendered the fallback -- a hydration mismatch, reported in the dev
overlay and invisible in the markup. The origin arrives as a prop from the server now.

**Six of these eight were things I had already looked at and called done.** The wordmark
in particular I reported as rendering, having checked that the HTML contained its `src`
and not that the file loaded. Reading the markup is not looking at the page.

---

### ADR-077 — Colour is a surface, and paper casts a shadow

**2026-08-23.** Two more corrections from the same review as ADR-076, both of them
things the rebrand inherited rather than chose.

#### The bands had no colour in them

Mint and violet appeared only as an underline, an icon and a button — six pixels at a
time on a cream page. The palette was declared and then barely spent, which is how a
brand ends up looking like a wireframe with a logo on it.

Two bands carry the brand outright now:

- **"Connect your AI" is charcoal, inverted** — white type, mint step markers, a mint
  link. It is the band about handing your notes to an agent, so it is the one that
  earns the dark ground.
- **The closing ask is mint**, with a violet underline and a charcoal button. A mint
  button on a mint ground is an invisible button, so the CTA inverts.

The rest stay paper. Two coloured bands in nine is the point — a third would make them
ordinary.

#### `--depth: 0` was kanNINJA's rule, not ours

The theme carried `--depth: 0` with the comment *"ink on paper casts no shadow"*. That
is a washi idea and it went out with the seal. `design.md` bans gradients, glows and 3D
rendering; it never banned elevation, and a page with none anywhere reads as unfinished
rather than as flat-by-choice.

`--depth: 1`, plus two tokens — `--shadow-lift` and `--shadow-raise` — warm-tinted
rather than neutral grey, so a lifted card still reads as paper rather than as a
material card. The nav pill, the cards, the story cards and the hero frame sit on that
scale; the agent card and the featured plan sit one step higher, which is the whole
reason to have two.

#### Consequences

- Three surfaces stopped being `color-mix(..., transparent)` washes in ADR-076; this is
  the other half of the same idea. **Flat means committed, not faint.**
- `.jd-band-ink` and `.jd-band-mint` each redeclare `.jd-ul` with a stroke that shows on
  their own ground — the violet underline is invisible on charcoal and reads as a bruise
  on mint.

### ADR-078 — A text box has a height, because now something is drawn at its edge

**2026-08-23.** `TextBox` gains an optional `h`, a box can be dragged out rather than
only tapped, and typed text moves above the ink in an export.

The ask was a post-it: draw the box, size it, colour it. The colour is the easy half.
The hard half is that ADR-065 defined a box as `{x, y, w, size, color, text}` with the
comment *"height is whatever the text needs"* — which was true, cheap, and fine right
up until something was painted at the box's boundary. Three disagreements had been
sitting there the whole time, all of them invisible because typed text is transparent:

1. **Two line-heights.** `ink-objects.ts` measured a box at 1.35, matching the CSS.
   `ink-render/geometry.ts` measured the same box at **1.25**. A lasso and an export
   did not agree where a box ended.
2. **Two independent wrap estimates**, one in the browser and one in the renderer, each
   guessing character counts from `w / (size * 0.55)` — while the browser then ignored
   its own guess and used real text metrics.
3. **Inverted z-order.** The editor stacks the object plane above both canvases. The
   SVG emitted `...typed` before `...body`, so text rendered *under* the ink.

None of the three could be seen. All three would have been obvious the moment a card
had a fill: a coloured rectangle of the wrong height, buried under somebody's
handwriting.

#### The decisions

**`h` is a floor, never a ceiling.** A card keeps the size it was dragged to when it
holds one word, and grows rather than clipping when it holds a paragraph. This is a
capture surface before it is a layout tool, and hiding a typed word behind an overflow
edge is not an option it gets to have.

**`h` records an intention, not a measurement.** The browser never writes its measured
height back. Storing the measurement would make `h` monotonic — a deleted paragraph
could never shrink the box again, because the floor would have swallowed it.

**One implementation of `boxBounds`, imported rather than copied.** `ink-index.ts`
already said the rule this broke: *"The boxes come from `@jotacular/ink-render` rather
than a second copy here."* The 1.25/1.35 split was that sentence being violated three
files away, so the fix is a deletion.

**Dragging is the second way to make a box, not the replacement.**
[02-product-spec.md](02-product-spec.md) calls sub-second capture non-negotiable and the
risk register calls slow capture fatal. A text tool that required a rectangle before
you could type would have added an interaction to the one path the product exists to
protect. Tap and get a sensible box; drag and get the box you drew. Below a 14-screen-
pixel threshold in *both* dimensions the drag never happened and the gesture decays into
a tap, so an unsteady finger costs nothing — the same bargain ADR-066 makes about
ignoring a snap.

#### Consequences

- Additive in jsonb, so **no migration**. A box written before today has no `h` and is
  estimated exactly as it always was.
- `ink-input.ts` reached its size limit and split by responsibility: `ink-input-snap.ts`
  is what a stroke turns out to be, `ink-text-drag.ts` is how a box is dragged out, and
  what remains routes a pointer to the tool holding it.
- An interrupted drag — a pinch starting mid-gesture — places nothing and leaves no
  rectangle on the overlay. An abandoned gesture is not a smaller version of the gesture.
- The drag preview is mint, against the selection marquee's blue. Making and choosing
  look alike on a trackpad, so the colours have to disagree.

### ADR-079 — A note can be a card, and the card is a field rather than a kind

**2026-08-23.** `TextBox` gains an optional `fill`. A box with one is a card: colour
behind the words, ink chosen for it, and a lift off the page.

#### A field, not a second kind of object

The obvious modelling is a `card` object beside `text`. It buys nothing and costs
everything twice — the reading order, the delta protocol, the companion `blocks` row,
the SVG path and the lasso would each have to learn a second name for the same thing. A
card is a text box with a colour behind it, so it is a text box with a colour behind it.

#### The ink is derived, never stored

`inkOn(fill)` picks charcoal or paper by relative luminance (Rec. 709, so a saturated
green is not mistaken for dark). Storing a text colour beside a fill would allow a card
to be **saved with text nobody can read on it**, and then to drift when either is
changed. Deriving it makes that state unreachable rather than merely discouraged.

#### The padding grows outward

`cardBounds` inflates `textBounds` rather than insetting the text, and the DOM element
is offset back by exactly what it gains. Colouring a note therefore never moves a word —
the card appears around what you wrote. It also means `contentBounds` frames the card,
so an export does not slice the colour off every edge.

Every interaction reads the card rectangle, not the text rectangle: tapping the coloured
margin opens the note, and a lasso encloses the colour a person can actually see. A card
whose corner is not part of it is an infuriating object.

#### Five colours, and a deliberate absence

Paper, mint, violet, charcoal, and none. They are the house hues from design.md §11
rather than a sixth palette invented in a component. A full colour picker is a decision
with no right answer offered at the moment somebody is trying to write something down;
real sticky notes come in a handful of colours for the same reason.

**There is no sticky-note yellow**, and that is a decision rather than an oversight — it
would be a brand colour we do not have, which is a change to design.md and not to a
canvas file.

#### Consequences

- **The card is lifted, and a month ago it would not have been.** ADR-077 retired
  `--depth: 0` along with the seal, so `.jd-card` takes `--shadow-lift` — the warm-tinted
  house token, so it reads as paper rather than as a UI card. The SVG export deliberately
  stays flat: a drop shadow there is a filter, and filters rasterise unpredictably.
- `recolourCards` is a separate method from `restyle` rather than another key on its
  patch. ADR-065 decided `{color, width}` is a pen idea that must not reach text; a card
  colour is a text idea that must not reach the strokes. Two methods state that; one
  method with a union would have to remember it.
- The card palette appears in the selection bar only when the lasso caught a note. A
  control that does nothing is worse than one that is not there.
- The bar stops saying "strokes" for everything. It names the kind when a selection holds
  only one, because nobody circles two words and a squiggle and thinks "3 objects".
- Additive in jsonb, so **no migration**, and a box with no fill is exactly what it was.
- Recognition still never sees any of it — `toSvg` draws text only when asked, and the
  suite asserts a card cannot reach the model either.

---

### ADR-080 — The pages have pictures in them now

**2026-08-23.** `10-design-system.md` gained a rule saying every marketing page carries a
real image. This is that rule being paid for rather than asserted.

#### The Open Graph card

`opengraph-image.png` is built from `scripts/og/opengraph.html` — a typeset page, captured
once at 1200×630 in a real browser and committed.

A browser rather than sharp, and this is the interesting part: the card is **typeset**.
Nunito for the headline, Caveat for the jot. Rasterising text through librsvg needs those
fonts installed on whichever machine ran the build, which is the exact failure mode the
old icon generator had — a missing font produced a blank tile and nobody noticed. A
browser has the webfonts because it fetched them. The HTML is the source, the PNG is the
artifact, and neither depends on the machine.

The card is warm paper with the dot grid, the wordmark, the hook, and a jot taped to a
board: a line drawing, handwriting, and a violet heart.

#### Pictures on the page

`components/site/Ink.tsx` holds drawings rather than an illustration library: `currentColor`
strokes, no text, so nothing in them depends on a font either. design.md §16 asks for
simple black ink lines, and **fewer objects drawn properly beats four drawn badly** — the
first attempt crammed a bookshelf, an armchair, a lamp and a mug into 340×150 and none of
them read.

The lake story's note is a real jot now: taped down, tilted, drawn on, handwritten in
Caveat, with a violet ring round the line the writer came back to. Caveat is loaded because
it is finally used — design.md §10 says sparingly, and one jot is where that budget goes.

#### The conversation is a conversation

The reply used to be a second bordered card beside the first, which is not what asking an
agent something looks like. It is Silica's `chat` component now — `chat-end` for the
person, `chat-start` with `chat-bubble-agent` for Claude.

`chat-bubble-agent` works because `agent` is registered in the plugin's `colors:` list
(ADR-011), so the same colour role the app uses for machine-authored content generates a
bubble variant for free.

**Silica's default bubble is `base-200`, and this band is `base-200`** — the person's
message rendered with no visible bubble at all. It takes paper and a hairline; the agent's
carries its own colour and needs neither.

#### Consequences

- `site-story.css` and `site-lists.css` split out at the 250-line limit, both by
  responsibility: the story is the one band with drawings and handwriting in it, and the
  lists are furniture that sits inside any band.
- `--font-hand` is a token now. It was missing for a while and the rule read
  `font-family: Caveat, var(--font-hand), cursive` — **an unresolvable `var()` invalidates
  the whole declaration**, so the handwriting silently fell back to the UI sans. The rule
  carries its own fallback now: `var(--font-hand, Caveat)`.

**Three edits in this session reported success while changing nothing.** A formatter had
rewritten `globals.css` to single quotes and `layout.tsx` to four-space indent between the
read and the write, so string replacements matched nothing — and the scripts printed their
success line unconditionally. Every write in this ADR's work asserts its own result before
printing. Verify the file, not the intent.

---

### ADR-081 — A background box is not the document

**2026-08-23.** `globals.css` had carried this since the first canvas commit:

    html, body { height: 100%; overscroll-behavior: none; }

`height: 100%` on `body` resolves against `html`, which resolves against the viewport. So
the body's **background box** was exactly one viewport tall while its content ran on for
thousands of pixels. Everything below the fold painted against the `html` canvas instead.

For a year that was invisible, because `body` had no background of its own and a
background-less body propagates nothing. The moment the theme put `bg-base-300` on it, a
hard horizontal seam appeared one screen down every long page — cutting straight through
whatever section happened to be there.

#### Why it looked like something else

It reads as a section bleeding into its neighbour, because the seam lands mid-content and
has nothing to do with any section boundary. It is worth saying what it is not: the hero
is `background: transparent`, and so is every `.jd-band` that has not asked for a colour.
The seam was at 1028px because the viewport was 1028px, and for no other reason.

#### The fix

    html { height: 100%; }
    body { min-height: 100%; overscroll-behavior: none; }

The canvas never needed the original: `.jd-canvas-shell` is `100dvh` outright and the ink
layer sizes from that rather than from this chain, so nothing that made the rule worth
having is lost.

**A rule that is wrong but unobservable is still wrong.** This one waited a year for
somebody to give the body a colour.

### ADR-082 — The close is charcoal, and quiet text is a colour rather than a hole

**Status.** Accepted, 2026-08-23.

**Context.** A design review of the rebranded landing page found two things
wrong with its surfaces and one thing wrong with its rhythm.

The last band on the page was a full-bleed mint field with a charcoal button on
it. At that area mint stops behaving like an accent. It reads as a second brand
arriving in the final screen — the review's words were that it "feels like a
different brand suddenly took over" — and it forced the one button we most want
pressed to be the one colour that could not be mint.

Separately, several strings on the page were held back with `opacity`: a price
cadence at 0.65, a post date at 0.6, the footer's legal row at 0.75, a plan
bullet at 0.4. ADR-076 already removed twenty-six of these from things a person
must read, but the metadata kept theirs on the reasoning that metadata is
secondary. Alpha is the wrong instrument for that. It does not produce a
quieter ink; it produces the same ink half-applied, and on a page whose whole
material argument is "paper", half-applied ink reads as a page that has not
finished loading.

The rhythm complaint was simply length: the page had more vertical space than
it had content, and three sections in the middle were stretched.

**Decision.** The close runs on charcoal — the same `jd-band-ink` ground as the
band about handing your notes to an agent — and mint becomes the button. Mint is
now the CTA colour in all three places a CTA appears: the bar, the hero and the
close. `.jd-band-mint` is deleted rather than left unused.

Secondary text gets `--ink-2`, a real flat colour declared on `.jd-site` and
redeclared lighter inside `.jd-band-ink`. No text on the marketing site is set
in alpha. The one survivor is the hero input's `::placeholder`, which is not
text somebody is reading.

Band padding drops from `clamp(2.5rem, 5.5vw, 4.5rem)` to
`clamp(2rem, 4.2vw, 3.5rem)`, the lede's trailing gap from 2.5rem to 1.75rem,
and the small type in cards, modes, examples and the never-list comes up from
0.95rem to 1rem against a base that is now 1.0625rem rather than the browser's
16px.

**Consequences.** Two charcoal bands now sit on the home page with four
sections between them, which bookends rather than repeats. The blog teasers came
off the home page in the same pass: the review read them as documentation at the
door, and `/blog` builds its own list, so `PostList` was deleted rather than
left orphaned. The footer keeps every internal link to them.

`--ink-2` is defined on `.jd-site` and so is unavailable to the app's chrome.
That is deliberate — the app is a canvas with a different contrast problem — but
it means a component used on both surfaces cannot reach for it.

### ADR-083 — Every icon in the product is marker-drawn, and that means a Kit

**Status.** Accepted and shipped, 2026-08-23.

**Context.** The four capture cards — Write, Type, Speak, Snap — carried Lucide
glyphs: even-weight outlines on a uniform grid. A design review called them
generic, and it was right in a specific way. Every other surface on this page
argues that the product is marker on paper: the underline sags, the note is
taped down, the canvas is dotted. Four icons drawn by a ruler contradict all of
it in the one place a reader looks before reading anything.

Font Awesome's Whiteboard family is the face that agrees with the rest — drawn
with a marker, with the wobble that implies. We have a Pro account.

The obstacle is distribution. Whiteboard is not in the npm Pro package: the
`icon-families.json` shipped with `@fortawesome/fontawesome-pro@7.3.1` declares
`classic`, `duotone`, `sharp` and `sharp-duotone` and nothing else, and there
is no `@fortawesome/whiteboard-svg-icons` on the registry. Font Awesome 7's new
expressive families are distributed only through a Kit, as
`@awesome.me/kit-<code>`.

**Decision.** One `components/Icon.tsx` and one `lib/icons.ts` map, for the
whole product. Callers name a job — `<Icon name="remove" />` — and never an
icon package, so changing artwork is a one-line edit in the map.

A package-manager Kit rather than a CDN Kit. The CDN kind injects a script from
`kit.fontawesome.com`, which would put a third-party request on a marketing page
that currently makes none, and would flash unstyled icons before it resolves.

**The icons are drawn from their definitions, not through
`@fortawesome/react-fontawesome`.** A kit icon *is* its path —
`[width, height, ligatures, unicode, d]` — so `Drawn` in `components/Icon.tsx` renders
one `<svg>` and one `<path>`. That keeps them server-rendered, adds no runtime,
and skips `fontawesome-svg-core`'s CSS injection, which on the App Router needs
its own opt-out to stop every icon flashing at full size on first paint. It also
saved two dependencies for four glyphs.

Sizing follows Font Awesome's own convention: one em tall, and as wide as the
artwork is. `pen-line` is 640x512, so a square box would squash it.

**Consequences.** `.npmrc` gained `@awesome.me:registry` beside the
`@fortawesome` line it already had, and the install now needs
`FONTAWESOME_NPM_TOKEN` in three places rather than one:

- a laptop, where it is already in the environment
- **CI** — `pnpm install --frozen-lockfile` in `ci.yml` carries it as an `env:`
- **the web image** — `web.Dockerfile` mounts it as a BuildKit secret rather
  than an `ARG`, so it never lands in a layer or in `docker history`, and
  `release.yml` passes it to the shared build step

The repository secret `FONTAWESOME_NPM_TOKEN` has to exist for any of that to
resolve. Without it the build fails at install with a 401 from
npm.fontawesome.com, which is the right failure: loud, early, and not a page
that silently ships without its icons.

The type had to be annotated rather than inferred. pnpm keeps
`fontawesome-common-types` at a path `apps/web` cannot name, so an inferred
`GLYPH` is "not portable" (TS2742); `Record<ModeName, IconDefinition>`, with the
type imported from the kit's own re-export, fixes it.

**This is the whole product, not the landing page.** `lucide-react` is gone
from the repository: nine components moved to one `Icon`, and `lib/icons.ts`
holds the single map from a job (`remove`, `agent`, `zoomOut`) to a glyph.
Naming keys for the job rather than the picture means swapping artwork never
means editing a caller.

Sizing moved with it. Icons used to be boxed — `.jd-tool svg { width: 1rem;
height: 1rem }` — and a Whiteboard glyph is rarely square (`pen-line` is
640x512), so a box squashes it. Every rule now sets `font-size`, and `.jd-icon`
is one em tall and as wide as its own artwork.

**The family does not cover everything.** Whiteboard Semibold is 492 icons, not
Classic's tens of thousands, and it has no `eraser`, no `highlighter` and no
`lasso` — which is three of the seven tools in the rail. `highlighter` takes
`paintbrush` and `select` takes `arrow-pointer`; both are honest and both stay
in one face. The eraser has no near miss at all, and `SUBSTITUTED` in
`lib/icons.ts` names all three so the compromise is in one list rather than
scattered across nine components.

Adding a second family for those three would fix the meaning and break the
face, which is the defect the review raised in the first place. So it is not
done here.

### ADR-084 — A tap picks one thing up, and a menu says what can be done to it

**2026-08-23.** Tapping an object with the Select tool selects just it, and right-click
(hold, on a phone) opens a menu anchored to what it acts on.

#### The lasso was the only way in, and it is the wrong instrument for one thing

ADR-033 gave the canvas a lasso, which is exactly right for *these things* and poor for
*that thing*. Changing one card's colour meant drawing a closed loop round it. Verifying
ADR-079 in a browser is what surfaced it: a straight drag cannot enclose anything, so
there was no way to reach the card palette at all without a deliberate curve.

A tap picks the topmost object and everything a selection already does — recolour, drag,
resize, delete, export — works on it with no new machinery. **Boxes before strokes**,
matching the paint order ADR-078 corrected: a card overlapping a squiggle is the thing
you can see.

A tap on bare canvas selects nothing, which is also how a selection is dropped, so
tapping away is the undo for tapping something and neither needed teaching.

#### The menu is anchored to the OBJECT, not the pointer

The obvious thing is to open at the touch point. On a phone that is under the thumb that
summoned it. The selection already knows its rectangle on the glass, so the menu points
at the thing it acts on; it falls back to the pointer only when nothing was hit.

**Not a bottom sheet**, which is the other obvious shape.
[toolbar-side.ts](../apps/web/lib/toolbar-side.ts) records why the bottom bar was
removed: a software keyboard covers the bottom of a phone exactly when somebody is
typing, which on this surface is most of the time.

Base UI's ContextMenu carries the touch long-press (500ms, with a move threshold),
roving focus, typeahead and dismissal. Its `anchor` accepts a virtual element, which is
how a popup points at a spot on a canvas that has no DOM node of its own.

#### What is in it, and the one that earns its place

Any object gets **bigger / smaller / save as an image / delete**. A note also gets the
five card colours. Bare canvas gets **put a note here**, and nothing else.

The best of them is **"Make this a circle"**. ADR-066 offers to tidy a rough shape only
*in the moment* — hold the pen a beat — and lifting keeps exactly what you drew. That is
the right default and a strange thing to make a one-time offer, because wanting it is
something a person often notices afterwards. The menu asks the same classifier
deliberately instead of guessing, at the same confidence floor, and names the shape it
would make. Most strokes never see the line at all.

**"Fit everything on screen" was in it and came out.** The zoom chip already does it and
is always visible; the menu was offering a second door to a room nobody had trouble
finding. A menu that pads itself out is a menu people stop reading.

#### Two bugs the first right-click found

`InkInput.down` never looked at `e.button`, so a right-click **started a lasso** — and
worse, its `preventDefault()` suppressed the `contextmenu` event that follows, so the
menu could not open at all. One guard fixes both. The visible half was the selection
vanishing; the invisible half was the whole feature.

#### Consequences

- `ink-engine.ts` reached its limit twice and split by responsibility both times:
  `ink-screen.ts` is the seam between document and client coordinates — traffic the menu
  made go both ways for the first time — and `ink-engine-erase.ts` is rubbing out, which
  earns its own file by holding state across a sweep.
- The engine stopped relaying the selection. Eight one-line wrappers only restated what
  `SelectionEditor` already says and every new action added a ninth, so React holds the
  editor directly.
- Resizing steps geometrically and reaches both kinds at once — a stroke's width and a
  note's text size are the same question asked of two things. Text is floored at
  `MIN_SIZE`: below 16px iOS zooms the page on focus, and the plane already clamps what
  it renders, so a smaller stored size would only make the export disagree with the
  screen.
- `-webkit-touch-callout: none` on the canvas layers and deliberately **not** on
  `.jd-text-box`: inside a note a hold is the system's text-selection gesture, which is
  the right one to keep.

---

### ADR-085 — Whether a note can be clicked is its own question, not a reading of the tool

**2026-08-23.** A note on the plane takes a pointer because something said it may, not
because the engine happened to be holding a particular tool.

#### A note could be written once and never opened again

Placing a note put the caret in it, and that hid the fault: the caret was already there,
so nobody noticed it could not be got back. Tap away and the note was finished — no
caret, no selection, no response of any kind. Editing your own words meant going to
Text → options → "Put a text box on the canvas" to re-arm a tool whose real job is
placing a *new* note, then tapping the old one. Nothing on the surface says that, and
there is no reason anybody would guess it.

For a product whose whole promise is that nothing you write gets lost, a note you cannot
re-open is close to the worst shape a bug can take. It looks like data loss and it feels
like the app forgetting.

#### One line, and the reason it was invisible

`InkTextLayer.setTool` asked `tool === "textbox"`. It was never wrong about `textbox`;
it was asking a question that could not be answered.

`CanvasTool` has six values, `InkTool` has five, and `inkToolFor` collapses the missing
one — the spine — to `"pen"` on the way into the engine. That collapse is correct and
ADR-065 explains why: the engine routes pointers by tool and has no branch for a
full-bleed textarea it does not own. But it means the engine can never see `"text"`, so
a tool-derived answer says *no* on the very tool people type with. The signature even
said `InkTool | "text"`, which reads as though the case were handled. It was dead code,
and had been since ADR-065.

The fix is not a sixth value. It is accepting that **the plane needs to know something
the engine deliberately does not**, and giving it its own channel: `canReachText(tool)`
in [canvas-tool.ts](../apps/web/lib/canvas-tool.ts), pushed through
`InkEngine.setTextReachable` to `InkTextLayer.setReachable`.

#### The collapse moved to where both answers are still available

`InkCanvas` used to take the narrowed `InkTool`, so both its callers wrote
`inkToolFor(tool)` at the prop and threw the spine away before the component could ask
anything else. It now takes the whole `CanvasTool` and narrows internally, which is the
only place both answers can be derived from one source and cannot drift apart.
`inkToolFor` moved from `ToolRail.tsx` — a component — to `canvas-tool.ts`, beside
`isInk` and the type it returns.

#### Reachability is pushed at mount as well as on change

The engine is built asynchronously, so the effect that pushes tool changes has already
run against a null ref by the time it exists. Every other setting is handled by
`initial`; this one has to be too, or the page opens on the default tool with every note
on it dead — which is the original bug wearing a different hat.

#### Consequences

- Off for the pen, the marker, the eraser and the lasso. All four must pass THROUGH the
  plane to the canvas underneath, and a note that swallowed the pointer would make part
  of the page silently undrawable. Verified in a browser: on Text a click lands in the
  note and bare paper still reaches the spine; on the pen every note is `none` and the
  canvas takes the pointer over a card as readily as over paper; on Select a tap picks
  the note up as ADR-084 intends.
- A native click places the caret where you clicked, rather than at the end of the text
  the way `focus()` does for a freshly placed note. That is the right behaviour and comes
  for free from using a real `<textarea>` — one more entry on ADR-065's list.
- `styleFor` widened to `CanvasTool`. It only ever asked whether the tool is the
  highlighter, and requiring a narrowed tool forced a second `inkToolFor` at both call
  sites purely to satisfy the signature.

### ADR-086 - The hostnames moved too, because nobody was holding them yet

**Status.** Accepted, 2026-08-23. Supersedes the staging in ADR-074.

**Context.** ADR-074 kept `jotdojo.com` and its three subdomains while the
product became Jotacular, on the reasoning that `app.` is the PWA install origin
baked into every home-screen icon and `mcp.` is the audience bound into every
access token. Moving either forces real people to reinstall an app or reconnect
an agent by hand.

That reasoning was sound and its premise was wrong. Both costs are paid *per
existing user*, and there are none - nothing is installed and no agent is
connected. The window in which this is free is now, and it closes the first week
anybody uses it.

**Decision.** Everything moves. 219 files, 744 occurrences: the four hostnames,
the `legal@` and `hello@` addresses, the `@jotdojo/*` workspace scope across
thirteen packages, the k8s namespace with its config and secret names, image
names, the `JOTDOJO_FAKE_PROVIDERS_OK` guard, the local database, the compose
container, and every line of prose in `docs/`.

The overlap is handled at the **edge**, not in application code. `jotdojo.com`
301s to `jotacular.com` at Cloudflare and never reaches the cluster, so
`isMarketingHost` knows one apex and `hosts.ts` grew no branch to delete later.

That is the better place for it. A redirect passes link equity where a second
accepted apex only splits it, and the conditional would have outlived the
condition -- code that exists for an overlap has no one to tell it the overlap
ended. **The redirect must preserve the path**: a root-only rule leaves every
indexed `/blog/...` URL on a 404 instead of its new home, and the blog is the
distribution (`16-web-presence.md`).

**Consequences.** Three things did not move, each for a stated reason:

- **`migrations/0000`-`0033`** are a literal record of what ran and are never
  edited (CLAUDE.md). They still create `jotdojo_app`, and `0034` renames it -
  so a database built from scratch replays history and lands on the new name.
- **The owner role** is not in `0034`. Migrations run *as* the owner and
  Postgres refuses `session user cannot be renamed`, so it is a superuser step
  paired with the Key Vault secret. `docs/20-rename-runbook.md` has the order.
- **The repo directory** is still `jotDOJO`. Renaming a checkout that other
  sessions and editors hold open buys nothing, and no reader sees it.

The database rename is `ALTER DATABASE`, which cannot run in a transaction and
needs no connections - so it is a runbook step rather than a migration. Role
renames are safe on this server because it is `scram-sha-256`; on an `md5`
server a rename silently clears the password, since the hash is salted with the
role name.

**A rename is cheap exactly once, and it is cheap because nothing is bound to
the old name yet. That is a fact about the calendar, not about the code.**

### ADR-087 — The linter was a script that had never run

**Context.** `apps/web/package.json` carried `"lint": "next lint"` from the day
the app was scaffolded, and `turbo.json` declared a `lint` task. Neither had
ever linted anything. No ESLint was installed in the repository, and no config
existed for `next lint` to read — so it fell through to its interactive setup
prompt, which asks the caller to choose between Strict and Base.

That question can only be answered by a person at a terminal. Anything else —
CI, a hook, an agent — gets a prompt written to a dead stdout and exit 1. The
failure looked like a lint failure and was not one; there was nothing to fail.

It survived because **CI never ran it.** `ci.yml` runs typecheck, the guard
checks, thirty-odd smoke suites and a real web build, and no lint step at all.
A broken script that nothing invokes reports nothing.

**Decision.** Install ESLint properly and put it in CI, where the absence was.

`eslint@9` with `eslint-config-next@15`, pinned to majors rather than taken
latest: `eslint@10` and `eslint-config-next@16` install cleanly and then fail,
because the plugins that config pulls in — `import`, `jsx-a11y`, `react` —
declare no peer support for ESLint 10, and this app is on Next 15.5.

Flat config in `apps/web/eslint.config.mjs`. `next lint` is gone in Next 16
anyway, so the deprecated wrapper was never worth adopting.

**Consequences.** The first honest run found five things, and each was decided
rather than swept:

- **`no-page-custom-font`** is off. It is a Pages Router rule — its own message
  names `pages/_document.js` — and it fires on the font link in the App Router
  root layout, which every page already shares. The fault it warns about cannot
  occur there.
- **`no-img-element`** stays on, with two annotated exemptions. The wordmark is
  an SVG and `next/image` passes SVGs through untouched; the avatar is 24px on
  the provider's own CDN and would cost a `remotePatterns` entry per provider to
  save nothing. A future `<img>` of a real photograph is still caught, which a
  blanket `off` would not do.
- **`import/no-anonymous-default-export`** was answered by naming the two
  exports, in `postcss.config.mjs` and the ESLint config itself. A suppression
  would have been longer than the fix.

The gate is `--max-warnings=0`, in the script so local and CI agree.
`next/core-web-vitals` reports most of what it knows as a warning, so a gate
that tolerates warnings passes everything and means nothing. The tree is at zero
today, which is the only moment that bar is free to set.

Only `apps/web` is linted. The other twelve packages have no `lint` script and
did not gain one here — they are typechecked, and inventing a house style for
them is a separate decision from repairing one that was already claimed.

**A script in `package.json` is a claim that something is checked. This one was
that claim and nothing behind it, for as long as the app has existed.**

### ADR-088 — The page moves, and a crawler never sees it move

**Status.** Accepted, 2026-08-23.

**Context.** The marketing site was a still page. Every surface on it was
already right — ADR-076 gave it shape, ADR-080 gave it drawings, ADR-082 gave
it a close — and none of it did anything. design.md §21 has had a motion
vocabulary since the brand was written, naming ink drawing in, a note settling,
a mint dot on save and an underline appearing quickly, and not one of those
existed anywhere in the product.

The obvious way to build it is an `IntersectionObserver` that adds a class, and
it is the wrong way here. The apex exists to be read by crawlers (ADR-010): a
reveal driven by JavaScript means the initial state — `opacity: 0` — is what a
crawler that does not run scripts is served, and a page whose text is invisible
without JavaScript is a page that has been hidden from search. It also means
shipping a client component to a route that has none.

**Decision.** All of it is CSS, and everything scroll-driven is a scroll-driven
animation: `animation-timeline: view()` for a reveal, a named `view-timeline`
for a scene with an order to keep, `scroll(root)` for the sticky bar. No
observer, no client component, no class toggled by anything.

Every scroll-driven rule sits behind two gates:

    @media (prefers-reduced-motion: no-preference) {
      @supports (animation-timeline: view()) { ... }
    }

Outside them there is no hidden state to fail open from — the page is exactly
what it was before any of this existed. That is the answer for a browser that
cannot drive an animation from a scroll position, for a reader who has asked us
not to move things, and for a crawler, which is all three at once.

The one sequence that is not scroll-driven is the hero, because it is above the
fold and there is no scroll to drive it with. It runs once on load.

**Consequences.** Three things had to change shape to be animated at all.

The underline is now a real `<path>` rather than a background image. A
background can only be revealed by squashing it — `background-size` from 0%
puts the far end of the stroke on the page at 10% — whereas a path with
`pathLength="1"` can be drawn along itself with a dash. `components/site/Underline.tsx`
replaces nine hand-written spans, `.jd-ul` became `inline-block` to hold the
stroke, and the mint variants in `.jd-band-ink` and `.jd-hero-turn` are now a
`color` on the stroke instead of a second copy of the SVG.

The drawings carry two numbers each: how long the path is, so a dash can cover
it, and where it comes in the order. Both are set in `Ink.tsx` because only the
shape knows either, and `pathLength` is not relied on for `<rect>`.

**Nothing that moves may animate `transform` if it also moves under a pointer.**
A filling animation outranks a declared value, so a card whose arrival animates
`transform` refuses to lift on hover for the rest of the session. Every hover
and press state uses `translate` / `rotate` / `scale`, which compose with
`transform` rather than fighting it, and `jd-pop` animates `scale` for the same
reason — the hero's tool rail is centred by a Tailwind `translate`.

Two smaller traps are recorded in the sheets themselves. `.jd-band-quiet` clips
its drifting dot grid with `clip-path` and not `overflow: hidden`, because
hiding overflow would make that band a scroll container and every `view()`
timeline inside it — the whole lake story — would be measured against a box
that never scrolls. And the sticky bar animates its shadow only: anything that
changed its height would shift the document up mid-scroll.

The lake story is the one scene with a script rather than a reveal. All seven
stages hang off a single named timeline on `.jd-story`, so the note finishes
drawing before the reply to it arrives however tall the band lands on a given
screen; per-element timelines would restart the clock for each piece. It
finishes by about two thirds of the band's pass, because a beat that lands
after its own section has left the screen has not landed.

`smoke:site` asserts the claim rather than the effect: the stroke ships as a
path, the underlined phrases are still readable as one phrase in the HTML,
nothing is hidden by an inline style, and no observer is shipped.

**A reveal that a crawler sees as a hidden page is not a reveal. It is a
deoptimisation with an animation on it.**

### ADR-089 — Mint comes back, at the top of the page rather than the bottom

**Status.** Accepted, 2026-08-23.

**Context.** The hero and the first section under it were both paper. Nothing
marked where the pitch stopped and the page began, so the four ways in read as
a continuation of the hero rather than as the first thing the page says.

ADR-082 deleted `.jd-band-mint` seven decisions ago, and the reasoning still
holds for what it was deleted from. Mint at full bleed **closing** the page
reads as a second brand arriving in the last screen, and it forced the one
button we most want pressed to be the one colour that could not be mint.

Neither objection survives the move. Directly under the hero, mint is not a
brand arriving late — it is the product's own colour, stated in the first
screen after the headline and then spent. And "Capture Anything" has no CTA in
it, so nothing is competing for the button colour.

**Decision.** `.jd-band-mint` is a real ground again, and `CaptureModes` is the
band that carries it. The class never fully left: ADR-082 removed the colour
but the full-bleed padding rule in `site.css` still named it, so this revives a
half-deleted class rather than inventing one.

Inside it, the rule is the same one `.jd-band-ink` follows — **the stroke is
whichever brand ink the ground is not.** On paper the underline is violet; on
charcoal it is mint; on mint it is paper, `#ece6da`. The marker tiles invert
for the same reason: a cream tile carrying a mint glyph disappears into a mint
ground twice over, so on mint the tile becomes the paper and the marker becomes
the ink — the same paper, declared once as `--mint-paper` on the band so the
stroke and the tiles cannot drift apart.

`--mint-paper` is base-300's value written out rather than taken from the
token, and the reason is worth keeping. This band is theme-invariant by
construction — `--color-primary` and `--color-primary-content` are the same in
`paper` and `paper-night` — but `--color-base-300` is not: it flips to `#262b32`
at night, which measures 6.30:1 against mint and **1.19:1 against the text it is
drawn under.** Following the token would have reinstated after dark exactly the
"stroke looks like an underline the text grew" problem the paper stroke exists
to solve. The literal is the same instrument `--ink-2` already uses for the same
class of problem, and the tiles had the identical fault before they were moved
onto it: `var(--color-base-100)` is white on paper and `#111418` at night, which
put a near-black tile on a band that changes nothing else between themes.

`--ink-2` is redeclared at `#0d3f37`, which measures 5.21:1 on mint. Body text
at `--color-primary-content` measures 7.52:1.

**Consequences.** The page now runs paper, mint, cream, charcoal, paper, paper,
cream, paper, charcoal. Two charcoal bands still bookend it as ADR-082 arranged;
mint is spent once, early, on the section that is about the product rather than
about us.

**This band must never carry a CTA.** Mint is the button colour in the bar, the
hero and the close, and a mint button on a mint ground has nowhere to go. That
is the half of ADR-082 that was never wrong, and moving the field to the top of
the page does not repeal it.

### ADR-090 — The credential keeps the old name, because a secret is not a label

**Context.** The rebrand renamed `JOTDOJO_APP_PASSWORD` to `JOTACULAR_APP_PASSWORD`
in `release.yml`'s required list, the way it renamed every other string. Key
Vault stores that under the hyphenated name, and the vault holds
`JOTDOJO-APP-PASSWORD`. The deploy asked for a key nothing answered to and
stopped:

    ##[error]Missing required secrets in kv-jotdojo-prod-cus: JOTACULAR-APP-PASSWORD

The sweep treated a secret's key as prose. It is not. Every other renamed
string had both ends move together in the same commit — the workspace scope,
the namespace, the image names. A vault key's other end is a value that exists
in exactly one place and is not in this repository.

**Decision.** The workflow reads `JOTDOJO_APP_PASSWORD`. The vault key keeps
the name it has.

Renaming it would mean creating a second copy of a live credential and deleting
the first, in the window where the site is already down — a destroy-and-recreate
of the only copy, to change a string that nothing but this list reads. That is
the same reasoning that left `kv-jotdojo-prod-cus` alone in ADR-086, applied one
level down. The name is not something a person reads; the value is something a
service cannot start without.

**Consequences.** The role still becomes `jotacular_app` — `0034` renames it and
the release job runs `ALTER ROLE jotacular_app LOGIN PASSWORD` with the value
read from the old key. Key and role no longer share a name, which is exactly
what the extra indirection in `release.yml` is for.

`DATABASE-URL` is a different problem and is **not** solved by this. Its value
names `jotdojo_app`, and after `0034` that role does not exist — so the vault
value has to change in the same window regardless. A key name can be worked
around; a role name inside a connection string cannot.

The sweep made the same mistake once more, in `17-shared-infrastructure.md`: it
renamed `kv-jotdojo-prod-cus` to `kv-jotacular-prod-cus` in five places, sending
a future operator to a vault that does not exist. Corrected here.

**A rename is safe exactly where both ends of the name are in the commit. The
sweep could not see the end that lives in Azure.**

### ADR-091 — A rename sweep cannot see the end of a name it does not own

**Context.** ADR-086 renamed 744 occurrences across 219 files, and the parts of
that living in this repository were correct. Every failure since has been a name
whose *other end* is outside it.

Four of them, found one at a time and each only when something broke or was
about to:

- **`JOTACULAR_APP_PASSWORD`** in the release's required list. The vault key was
  never renamed, so the deploy asked for a name nothing answered to and stopped.
  ADR-090.
- **`kv-jotacular-prod-cus`** in `17-shared-infrastructure.md`, five times. That
  vault does not exist; ADR-086 deliberately kept `kv-jotdojo-prod-cus`.
- **`stjotacularprodcus`**, the blob account. Azure storage account names are
  globally unique and immutable — the doc named an account that *cannot* exist,
  in the same table that explained why it could not be renamed.
- **`brandonkorous/jotacular`**, in the OIDC trust comment, the roadmap, and
  three image paths. The GitHub repository is still `brandonkorous/jotdojo`.

The routing table was the dangerous one. It named a `jotacular-web` Service —
and a `jotdojo-web` before the sweep. **Neither has ever existed.** The Services
are `web`, `api` and `mcp`; the namespace is the half that carries the product
name. So the sweep rewrote a wrong string into a differently wrong string, and
nothing noticed, because nothing resolves a name in a document.

**Decision.** Where the name is ours, it moved. Where the other end lives in
Azure, GitHub or sparx's repository, it stays and the document says so.

**Consequences.** The failure mode is specific and worth naming: **a rename is
verified by whatever resolves it.** An import is checked by the compiler, a
package name by the installer, a k8s Service by DNS at request time. A name in
prose is resolved by a person, months later, under pressure — and one in a
`required=` array is resolved by a vault at deploy time, which is the only
reason ADR-090's was caught at all rather than in six months.

The Caddy blocks are the same shape and were caught before doing harm. They said
`jotacular.com` and proxied to `web.jotdojo.svc.cluster.local` — right hostname,
wrong namespace, invisible from outside because the old namespace answers
perfectly well. Deploying into that would have renamed `jotdojo_app` out from
under the pods actually serving traffic while the healthy new pods sat where
nothing routed.

**A sweep proves that a string changed everywhere it appears. It proves nothing
about whether the thing the string named agreed to change with it.**

### ADR-092 - Text reveals finish on `entry`, never on `cover`

**Status.** Superseded by ADR-093, 2026-08-24. The defect it describes was
real and is worth keeping; the fix was not. `entry` finishes as soon as the
element is fully on screen, and `view()` measures the ELEMENT -- so on a
one-line tagline that is 24px of scroll, over before anybody sees it. There
was no correct range because scroll position was the wrong driver. Reveals are
one-shot animations now.

**Context.** ADR-088 gave the marketing page scroll-driven motion, and three of
those animations clip TEXT: `jd-write` runs `clip-path: inset(... 100% ...)` to
`inset(... -0.9em ...)`, so the words are literally written on. All three were
ranged on `cover`.

`cover` measures the subject's whole passage through the scrollport - from
first appearing at the bottom to finally leaving the top. A range ending at
`cover 34%` therefore does not finish until the element is somewhere near the
middle of the viewport. Which means:

- **"Connect your AI" shipped unreadable.** Scroll to that band and stop, which
  is what a reader does, and it says *"Paste one link into Claude's settin"*,
  *"Sign in, and pi ... reach."*, and for the third step nothing at all. The
  stagger made it worse the further down the list you looked.
- **The footer tagline stopped at "Where the thought lanc"** and stayed there
  forever. At the bottom of a document `cover` progress is capped by how much
  scroll is left, and there is none - the comment above that rule had already
  worked this out for the footer columns and then kept `cover` for the tagline,
  reasoning that a hand line caught mid-stroke still reads as a hand line. It
  does not. It reads as a bug.

**Decision.** Anything that clips text ranges on **`entry`**, which is measured
against the element arriving in the viewport rather than against the scroll
remaining. `entry 100%` is the moment the element is fully on screen, so a range
that ends before it is guaranteed to complete - at the bottom of the document as
readily as in the middle of it.

`jd-fade` and `jd-rise` keep `cover`. Their partial state is dim or slightly
displaced, which is legible; a clip's partial state is a different sentence.

**Consequences.** The rule generalises: **a reveal whose half-state is wrong,
rather than merely quiet, must complete on `entry`.** Opacity and transform can
be caught anywhere and still say the right thing. `clip-path`, `width` and
anything that hides characters cannot.

The animation itself did not change. `jd-write` still writes, `view()` still
drives it - only the range moved, in three declarations.

`.jd-note-hand > p` also uses `jd-write`, on the named `--jd-story` timeline
rather than on `view()`, and it is left alone: that one is the handwritten note
being written inside a pinned scene, where the whole point is watching it
happen, and it completes before the scene releases.

### ADR-093 - A reveal plays once, and never plays backwards

**Status.** Accepted, 2026-08-24. Supersedes the mechanism in ADR-088.

**Context.** ADR-088 built the page's motion on `animation-timeline: view()`.
That is not a trigger. It is a *function of scroll position* - the animation's
progress is wherever the scrollbar is, so scrolling up plays every reveal in
reverse. A reader who scrolls back to find something they have already read
watches it un-fade, un-rise and un-write itself.

That is the wrong behaviour for the same reason ADR-076 removed the opacity:
somebody scrolling around is looking for something, and hiding it again is the
one thing the page must not do.

Being a function of scroll also made the reveals impossible to time. ADR-092
had already caught the "Connect your AI" steps truncating mid-word, and the
footer tagline was worse: three different scroll ranges, three different
failures. `cover` could not finish because at the bottom of a document its
progress is capped by the scroll left below. `entry` finished instantly because
`view()` measures the element, and the tagline is one line tall - 24px of
scroll. Borrowing the footer's timeline moved the whole stroke off the bottom
of the screen, so it completed before it was visible. There was no correct
range, because the mechanism was wrong.

**Decision.** Reveals are **one-shot, time-based animations**, held paused until
`components/site/Reveal.tsx` marks their section seen with an
IntersectionObserver, and never unmarked. `both` fill shows the from-state while
paused and holds the to-state forever after.

The pause is one rule, not a rewrite of every selector:

    [data-motion] :is(.jd-site-main section, .jd-site-foot, .jd-story):not([data-seen]) *

`.jd-story` is listed beside the sections because it is a scene inside one, and
its thirteen beats must not start when the band's first pixel appears.
Pseudo-elements need their own copy of the rule - `*` does not match `::before`,
and two of the reveals are drawn that way.

`[data-motion]` is set by the component rather than assumed. Without JavaScript
the rule matches nothing, no animation is ever paused, and the page is simply
the page - which is the only acceptable failure mode for a mechanism whose
resting state is *invisible*.

**Consequences.** The lake story loses its scrub. That was the best thing on
the page: thirteen beats under the reader's thumb, runnable backwards to watch
the note write itself again. It is now a 3.3-second sequence that plays once.
The delays are the old percentages at about 55ms each, so the order and the
pauses the story was written around survive - the beat of nothing before the pen
goes back, the weeks that pass before the question. A scene that rewinds is
still a thing that hides what somebody already read, and the page holds one rule
about that everywhere.

**Two animations stay scroll-driven, and they are not reveals.** The bar
reports how far down the page you are; the dot grid drifts under the quiet
band. Both are continuous state rather than content arriving, and both are
*meant* to run backwards when you scroll back.

`@supports (animation-timeline: view())` came off everything else. A time-based
animation needs no gate, so browsers without scroll-driven animations now get
the motion too - they previously got a completely static page.

### ADR-094 - The paper is not blank, and the first touch clears it

**Status.** Accepted, 2026-08-23.

**Context.** ADR-076 put the running canvas beside the pitch, and it worked --
except that what it showed was an empty rectangle with a placeholder in it. The
Open Graph card (ADR-078) does the opposite: a jot with a list on it and a
drawing under the list, which is what somebody clicked the link expecting. They
arrived to nothing, and the one thing the hero exists to say -- *type it or draw
it, either is a note* -- was left entirely to a sentence in the status bar.

**Decision.** A jot is already on the paper: four typed lines, one handwritten
annotation, and a line drawing, the same three objects as the card. It arrives
the way it was made -- lines land, strokes draw themselves along their own
paths, the pen writes the last word -- and the first touch anywhere in the hero
clears it.

Three things make it safe to put content on a surface that is really writable:

- **It is a sibling of the textarea, not its value.** `components/site/HeroJot`
  renders above the input at `z-index: 2` with `pointer-events: none`. Nothing
  decorative can reach `useDraft`, so nothing decorative can reach Postgres, and
  "Keep this" still hands over exactly what the visitor wrote.
- **It waits for the server to say the paper is empty.** `useDraft` now reports
  `ready`, set when the resume round trip returns. A returning visitor with a
  draft never sees a demo flash over their own words, because the jot is only
  mounted when that round trip comes back with nothing.
- **Clearing is the engagement rule that already existed.** It hangs off
  `data-engaged`, the same attribute that straightens the frame -- so choosing a
  pen clears the paper before a pointer reaches it, and the jot is gone by the
  time the first stroke starts.

**Consequences.** The hero shows both capture modes above the fold without a
screenshot, a video, or a claim. The cost is that the placeholder now has to
wait its turn: `:has(.jd-hero-jot)` holds it at `opacity: 0` while the demo is
on the paper and fades it back in after the clear, so the two never sit on top
of each other. The jot is mounted for the rest of the visit, hidden -- unmounted
it could not be faded, and a demo that vanishes on the first keystroke reads as
a bug rather than as room being made.

**One grid, found on the way.** Putting a drawing on the hero surfaced a defect
that had been there since the stage got its dots: pick up a pen and the ink
layer mounts its own grid (ADR-053) at a 24px pitch over the stage's 22px one,
and the two moire. The stage's dots now stop where the ink layer's begin --
`:has(.jd-ink-mount)` -- because only one of them tracks the pan.

### ADR-095 - The redirect guarded nothing, so it is gone

**Status.** Accepted, 2026-08-24.

**Context.** The rename moved a post from `connect-jotdojo-to-claude` to
`connect-jotacular-to-claude`, and `next.config.ts` grew a permanent redirect
to keep the old URL working. Its own comment justified itself: *"the old slug
is in other people's bookmarks and in the index -- a 404 there costs the one
piece of SEO we actually have."*

Neither half of that was true. The site was about a day old. Nothing linked to
it, no crawler had indexed it, and there were no bookmarks because there were
no readers. The rule was protecting a past that did not exist.

It was also the only outage-shaped bug the rename produced. The sweep rewrote
**both** ends of it in the same commit that created it, so the post 308'd to
its own URL -- an infinite loop, on the one page the footer and the "Connect
your AI" band both link to (ADR-091 caught six other over-renames, all of them
prose; this was the one in live code).

**Decision.** Delete it. `redirects()` is empty, so the whole hook goes.

**Consequences.** A cost that only existed on paper is gone, and with it the
config's single riskiest line. The check that caught the loop stays: the site
smoke asserts **every** post the index lists returns 200, not just `slugs[0]`.
Four working posts hid one broken one, and that will not be how we find out
again.

The general rule is worth naming, because the rename produced several
decisions of this shape. **A compatibility shim is a debt against real users,
and it is only worth taking on when there are some.** Ask who breaks if it is
absent before writing it; on a day-old product the honest answer is usually
nobody. ADR-086 made the same call about the hostnames, for the same reason,
and was right for the same reason.

### ADR-096 - A green apex is not a healthy database

**Status.** Accepted, 2026-08-24.

**Context.** Migration `0034` renamed `jotdojo_app` to `jotacular_app` in
production, and `DATABASE-URL` in Key Vault was updated to match. Twenty
minutes later the vault secret was set back to `jotdojo_app` by a hand that
reasonably believed the rename was being skipped -- the question *"should we
just leave the db role?"* was live at the time.

From that moment every service in the cluster held a connection string for a
role that no longer existed.

**Nothing looked wrong for the next hour.** jotacular.com returned 200. The
pods reported `1/1 Running` and never restarted. Two properties conspired: the
marketing pages are statically prerendered, so they serve perfectly with no
database behind them, and postgres-js connects lazily, so a pod that is never
asked for a row never discovers it cannot get one. Every signal we had was
green while the app, the API, the MCP server and the worker were all cut off
from their data.

It surfaced only by running the pods' own connection string against the server:

    FATAL:  password authentication failed for user "jotdojo_app"

**Decision.** Three things follow.

**A schema change and the credential it invalidates are one change.** `0034` and
`DATABASE-URL` cannot be decided separately, because reverting either one alone
produces a system that is broken and silent. If the role rename is being
reconsidered, the migration is what gets reconsidered -- not the secret.

**Health is proved against the thing that can fail, not against the thing in
front of it.** `curl https://jotacular.com/` proves the CDN, Caddy, the pod and
the prerender. It proves nothing at all about Postgres. The check that means
something is a query:

    kubectl run pg -n jotacular --rm -i --restart=Never --image=postgres:18-alpine       --overrides='...secretKeyRef: jotacular-secrets/DATABASE_URL...'       -- sh -c 'psql "$DATABASE_URL" -tAc "select current_user"'

**Editing the vault does not fix the cluster.** `release.yml` builds the
`jotacular-secrets` Secret from Key Vault *at deploy time*, so a corrected
secret reaches running pods only on the next deploy. The repair was a rerun of
the release, not a `kubectl patch` -- patching by hand would have left the
cluster and the vault agreeing by luck rather than by pipeline.

**Consequences.** `az keyvault secret list-versions` turned out to be the tool
that explained this: the revert was a timestamp twenty minutes after the fix,
which is what made "somebody changed this" a fact rather than a theory. Secret
history is an audit log, and it is worth reaching for before theorising.

The deeper point is about **what a deploy actually validates**. The release
pipeline gates on the presence of every required vault key (ADR-090) and it
correctly found this key present -- it just had the wrong value in it. A
presence check cannot catch a *wrong* secret. The only thing that can is using
it, which is what `db-migrate` and `db-role-password` already do -- and both of
those had run and passed, because both connect as the OWNER. Nothing in the
pipeline ever connected as the application role. That is the gap, and it is a
candidate for the next smoke: one query as `DATABASE_URL`, in the deploy,
before the rollout is called good.

### ADR-097 - A loopback redirect cannot register its port

ChatGPT's desktop app reached our consent screen on 2026-08-24 and was turned
away: *"That redirect address is not registered for this application."* It is a
native client, and it identifies itself with a Client ID Metadata Document:

    https://chatgpt.com/oauth/codex/MC-iJv6DUvOJ/client.json

That document lists two redirect addresses, and neither has a port:

    http://127.0.0.1/callback/MC-iJv6DUvOJ
    http://localhost/callback/MC-iJv6DUvOJ

The request that arrived asked for `http://127.0.0.1:52143/callback/…`, because a
native app takes a free port from the operating system at the moment the flow
starts. It cannot know that port when the document is written, and the document
is served by OpenAI to every user, so it could not carry one anyway. Our check
was `redirectUris.includes(redirectUri)` -- exact, no exceptions -- so every such
client was refused. This is the case RFC 8252 s7.3 exists for, and it says the
authorization server MUST allow any port for a loopback address.

**Decision.** Exact match stays the rule, with a single exemption: when the
requested address is `http:` on `127.0.0.1`, `localhost` or `[::1]`, it matches a
registered address that agrees on scheme, host, path and query, whatever the
port. The exemption is scoped to the loopback interface and cannot be reached by
a public host, so `https://claude.ai:8443/…` is still refused against
`https://claude.ai/…`. Path and query are still compared exactly, so a client
that listens on the loopback cannot claim a redirect it did not register.

The matcher is `packages/domain/src/oauth-redirect.ts`, its own file rather than
another function in `oauth.ts`: "does this address belong to this client" is the
one question the whole consent screen turns on, and it should be readable
without reading five hundred lines of grant plumbing around it.

**Consequences.** The token exchange is deliberately left alone. It compares the
`redirect_uri` presented at exchange against the one recorded when the code was
issued -- the real address, port and all -- not against the registered pattern,
so the loosened comparison never reaches it and the code stays bound to the exact
socket that asked for it.

The failure was invisible from our side. Nothing errored, nothing logged: a page
rendered, the user read it, and the connection simply did not happen. The URL in
their address bar was the entire diagnosis, and we had no other copy of it. A
refused authorization is a thing worth recording.

### ADR-098 - A failed LISTEN must not leave a client behind

The account page returned Next's generic server error on 2026-08-24, digest
`659896347`. It was not the account page. The pod's log carries the whole story:

    remaining connection slots are reserved for roles with the SUPERUSER attribute
    code: '53300', routine: 'InitPostgres'

The shared server was at `max_connections`, so nothing that needed a connection
could render -- and `/account` needs six. 117 of these in twenty minutes, all
from `web`; `api`, `mcp` and `worker` were quiet, because a process that already
holds its pool never asks for another connection and never finds out.

**What our own code did to that.** `subscribeRaw` opened a dedicated client for
`LISTEN`, outside the pool and one per process. On failure it set
`listening = null` so the next subscriber would try again -- and dropped the
failed client on the floor without ending it. A `postgres()` client owns a socket
and a reconnect timer; losing the reference closes neither. Meanwhile EventSource
reconnects by itself, so every browser with a note open came back within seconds
and made another one. A shortage of connections became a source of them.

**Decision.** Two changes, both in `packages/db/src/live.ts`.

`startListening` ends its client when `LISTEN` rejects. A client that never
subscribed has nothing to keep.

A failed attempt shuts the channel for five seconds. Subscribers inside that
window are refused without touching the database, which turns a reconnect storm
into one attempt every five seconds per pod.

`apps/web/app/api/live/[noteId]/route.ts` now subscribes before it builds the
`Response`, so a refusal is a 503 rather than a stream that dies mid-pipe and
logs `failed to pipe response`. The page has never needed the live channel to
work; it needed it to fail quietly.

**Consequences.** This does not explain where fifty connections went, and the fix
does not claim to. It removes our contribution to the pile and stops a transient
shortage from sustaining itself -- the difference between a bad minute and a
morning. Finding the holder means `pg_stat_activity` grouped by
`application_name`, on a server we share with sparx (docs/17), and that is the
next question, not this one.

The wider lesson is the same one as ADR-096, from the other end. There the signals
were green while the database was unreachable; here the database was the whole
story and the signal was a digest on a page that had nothing wrong with it. Both
times the answer was in the pod's log and nowhere else.

### ADR-099 - The ceiling is 35, and there are two of us on the cluster

ADR-098 fixed our contribution to the connection exhaustion and said finding the
holder was the next question. This is the answer, and it is two answers.

**The ceiling was never 50.** `max_connections` is 50, which is what
docs/17 budgeted against. Azure also sets, and will not let anyone change:

    superuser_reserved_connections  10   isReadOnly: true
    reserved_connections             5   isReadOnly: true

So an ordinary role gets **35**. The last fifteen are held for privileges
`jotacular_app` does not have, which is why the refusal says *reserved for roles
with privileges of the `pg_use_reserved_connections` role* rather than *too many
clients already* -- a different message for a different wall, and the one we
never wrote down. Azure's metric agreed the server was at 43 of 50 and looked
fine while the app could not open a single connection.

The floor tells the story better than the peak. Maximum-per-hour never moved
much; the MINIMUM climbed and stayed: 20 through 23 August, 27 overnight, **36
from 06:12** on the 24th. A rising floor is somebody holding, not somebody busy.
Once it passed 35 the app was locked out, and it stayed locked out.

**And there are two jotDOJOs.** The rename left the old namespace running:

    jotdojo     api mcp web worker   deployments 35h old, pods 10h
    jotacular   api mcp web worker   the one Caddy actually routes to

`jotdojo` has its own `jotdojo-config` and `jotdojo-secrets`, and its worker is
in a retry loop against a password the role rename invalidated -- `28P01
auth_failed`, seven attempts in five minutes and still going. Its web, api and
mcp hold almost nothing, because pools are lazy (ADR-031) and nothing routes to
them. So the duplicate is not what ate the connections. It is dead weight that
has been failing quietly for ten hours, and it is the same rename that ADR-095
already caught halfway through.

**Decision.** The budget in docs/17 is recomputed against 35 and says so. The
`jotdojo` namespace goes, because a deployment nothing routes to and whose worker
cannot authenticate is not a fallback, it is a second thing to be wrong.

**Consequences.** 35 shared with sparx, against our own 16 plus one live channel,
is not a comfortable number and no amount of pool trimming makes it one. The next
real decision is the tier -- docs/17 already prices it -- and it belongs to sparx
because the server does.

The lesson is narrower than ADR-096's and worth keeping separate: **a quota you
did not read is a quota you do not have.** Three parameters decided this, two of
them read-only, none of them in any document we wrote.
ter.

### ADR-100 - Two small servers, not one bigger shared one

ADR-099 found the wall: 35 usable connections, shared with sparx, and no way to
raise the reserved fifteen. This is what we did about it.

**Decision.** jotacular gets its own Postgres. `psql-jotacular-prod-cus`, B1ms,
in its own delegated subnet `snet-psql-jotacular` (10.20.16.16/28), reusing
sparx's private DNS zone. sparx keeps `psql-sparx-prod-cus`, unchanged and
untouched.

The alternative on the table was scaling the shared server to B2s. Two B1ms at
~$18 beat one B2s at ~$60 on price, and they beat it on the thing that actually
failed: **a bigger shared server is still shared.** B2s would have raised the
ceiling far enough that this morning could not recur, and left the coupling in
place for whatever grows next. Isolation was the point, not headroom.

**The server admin IS `jotacular_owner`**, which deletes a step rather than
moving it. On sparx's server the owner had to be minted by sparx's data stage
from `JOTDOJO-OWNER-PASSWORD`, because a server-level role is not something a
tenant of that server can create for itself. On our own server it exists the
moment the server does, and `DATABASE-ADMIN-URL` works with no bootstrap.

**And the connection strings finally say jotacular.** This was not cosmetic and
it is the part worth remembering. Terraform still emitted `jotdojo_app`, and
`0034` renamed that role out of existence -- so the next apply of that file, for
any reason at all, would have written `DATABASE-URL` naming a role that does not
exist. That is ADR-096 exactly, waiting for an unrelated trigger. ADR-091 logged
it as the one thing a key-name workaround could not fix. It is fixed: the
strings name `jotacular_app`, `jotacular_owner`, and the database `jotacular`.

**What deliberately did not move.** The vault KEY names -- `JOTDOJO-APP-PASSWORD`
and `JOTDOJO-OWNER-PASSWORD` -- still say jotdojo. They carry `prevent_destroy`,
and `release.yml` names them in its required list, so renaming them is a
coordinated change across two repositories rather than a substitution. ADR-086
kept `kv-jotdojo-prod-cus` for the same reason. A key name is bookkeeping; a
role name inside a connection string is not.

The old `jotdojo` database stays on sparx's server as the rollback until the new
one has served traffic. Deleting it is a later, deliberate commit.

**Consequences.** The terraform apply was scoped with `-target`, because a full
plan in that workspace needs a Cloudflare token this machine does not have. Four
added, two changed, zero destroyed, and the two changes were the two connection
strings. A targeted apply is a thing to notice in the state, not a thing to
repeat.

There was no data to move -- jotacular had no users -- so the new database is
built by the migrations rather than restored. That is the cheapest this will
ever be, and it is the second time in one day that "nobody is using it yet" paid
for a move that would otherwise have needed a window (ADR-086's rename was the
first). It is worth being blunt about the corollary: **both of these got done
because they got done early.** Neither is a manoeuvre we could repeat in a month.

---

### ADR-101 - The toolbar overflowed, and two kinds of thing were sharing one rail

**Status.** Accepted, 2026-08-24.

**Context.** A screenshot from an iPhone showed the pill with its last icon cut in
half. That is not a matter of taste, it is arithmetic: `chrome.css` grows every
button to 44px on a coarse pointer, and the pill held ten of them — search, five
modes, voice, photo, remarks, the avatar — plus two seams and its padding. About
484px inside `calc(100vw - 1.5rem)`, on a viewport of 390pt. It had been
overflowing since the day voice and photo were added.

The interesting half is *why* there were ten. `ToolRail` carried an `action?:
boolean` flag, and that flag was the design admitting something: **modes and
actions are different things wearing the same button.** A mode changes what the
canvas does, only one is true at a time, and it can be `aria-pressed`. Voice and
photo produce content and then finish. They were in the rail because the rail was
where buttons went.

**Decision.** Actions leave. `AddMenu` — a `+` — holds photo, voice, and *a note
on the canvas*, which is the same three the canvas menu offers on bare paper.
Two doors to one room beats one door somebody has to already know about, and a
menu that lists what CAN be added is how a stranger finds out voice exists at all.

Below 30rem the five modes collapse to the one in hand, with a chevron drawn in
CSS on the chip rather than a second button beside it to hit by mistake. The
first tap opens the rail and chooses nothing — otherwise the one visible button
would mean both "the tool you are holding" and "the four you are not", and would
have to guess. Five buttons, about 250px, with room to spare.

`useNarrow` exists only so a *tap* can mean something different when the rail is
collapsed. The breakpoint itself lives in CSS and is the authority; the two share
one number and both say so.

**The tool is remembered per device.** `tool-memory.ts`, localStorage, guarded in
both directions because Safari can throw rather than return null. Deliberately
not a server preference like the chrome's left/right side: which hand holds the
pencil is a fact about a person, and which tool is down is a fact about a session
at a desk. Syncing it would hand the pen to a phone because a tablet had been
drawing. `textbox` is not remembered — it is a one-shot the app itself leaves
immediately (ADR-065), so restoring it would restore a state that does not exist.

**Consequences.** `chrome.css` reached the 250-line limit and split by
responsibility: `pen-size.css` is one control with a nib, a track and a readout,
and the other half of `components/PenSize.tsx`. `Canvas.tsx` reached it too, and
`use-canvas-tool.ts` came out — which tool is in hand is a small state machine
with three rules, each of which has a reason somebody has to be able to find.

"Put a text box here" left the text tool's options for the add menu. ADR-065 put
it there because a box is "the additional thing you go looking for"; the `+` *is*
where you go looking, and one home beats two.

---

### ADR-102 - The camera was fenced to the ink tools, and so was the menu

**Status.** Accepted, 2026-08-24.

**Context.** Two complaints arrived as separate bugs — *the context menu only
works when the pen is selected*, and *this is a zoomable canvas, not an infinite
one* — and they are one line of CSS:

    .jd-ink-mount { pointer-events: none; }
    .jd-ink-mount[data-active="true"] { pointer-events: auto; }

`data-active` is `isInk(tool)`. On the spine — the tool the app opens with, and
the tool most people are in most of the time — the ink surface takes no pointers
at all. `ViewGestures` lives under it, so two fingers did nothing. `CanvasMenu`
wrapped it, so a hold did nothing. And on a note nobody had drawn on yet the
whole layer was unmounted, so there was no menu to have.

The canvas has been genuinely endless since ADR-053 — unbounded `panBy`,
0.1x-8x zoom, world-space strokes, a grid that tracks the camera. Nothing was
missing from the surface. It was fenced off from the tool people were holding.

**Decision, three parts.**

*The camera feeds itself.* `ViewGestures` takes an optional outer element and
listens there in the CAPTURE phase, so a pinch reaches it before whatever is
underneath — which on the spine is a textarea that would otherwise scroll. It
gains an `ignores` predicate, and a textarea is what it ignores: a field owns
scrolling its own words, and a pinch that panned the world out from under a
half-selected sentence is not a gesture anybody asked for. When no outer element
is given it is driven by `InkInput` exactly as before, which is why the hero and
`smoke-gestures.ts` needed no change.

*The menu wraps the page, not the ink.* `CanvasMenuHost` moved out of `InkCanvas`
and now wraps the whole shell, above the spine as well as the ink. The spine
stops the event where it starts, because a hold on words is the system's
text-selection gesture and that is the right one there — ADR-084 made the same
call for notes on the plane. The ink layer is also mounted unconditionally now: a
page that waited for somebody to pick up a pen before it had a camera or a menu
was a page you could not pan, pinch or hold on.

*The spine is only as tall as its words.* This is the part that makes the rest
mean anything. `.jd-canvas-input` was `height: 100%` of a `100dvh` shell, so a
page with four words on it was a text field from edge to edge: every hold, every
right-click and every empty inch of "canvas" belonged to the textarea. **There
was no blank paper to put a menu on because there was no blank paper.** `Spine`
measures itself after every change and caps at the page. A tap on the paper below
still puts the caret at the end, so ADR-008's contract is unchanged — the wrapper
is transparent to pointers and the shell catches it.

**Not decided.** The spine stays a screen-space layer; the body text is not an
object on the plane. That is the larger version of this change, it reopens the
sub-300ms capture contract, and it deserves its own decision rather than being
arrived at.

**Consequences.** A long note fills the screen again and scrolls its own words,
which is correct — by then there is no blank paper, because somebody used it.
`ink-input.ts` was at the limit and split: `ink-input-select.ts` holds the one
tool whose gesture cannot be named until the pointer lifts.

---

### ADR-103 - A photograph goes on the page, not in a tray beside it

**Status.** Accepted, 2026-08-24.

**Context.** A photo taken in the app landed in a strip along the bottom of the
screen with a caption under it. It could not be moved, could not be drawn on,
could not be put next to the note it was about — and it took `max-height: 40vh`
of a phone to say so. It looked like something was happening. Nothing was.

**Decision.** The bytes stay where they are and only the *placement* is new.
`blocks` keeps the file, the direct-to-storage upload, the vision transcript and
the search index; none of that wants re-uploading because somebody nudged a photo
two centimetres left. Where the picture sits is `doc.images[]` in the layer
document, beside the strokes and the text boxes.

That split is the whole design, and ADR-065 wrote the argument already: objects in
the layer inherit ADR-058 whole — id-named, commutative deltas, one version, one
subscription. A `blocks` row per placement would put N objects on one optimistic
counter, which is the conflict machine that ADR explicitly refused. Moving a photo
is four numbers in a delta.

A third array rather than one polymorphic list, for the reason `texts` is a second
one: `toSvg` renders `doc.strokes`, so nothing on the plane can reach the
recogniser by accident. Keeping the arrays apart makes that impossible rather than
merely unlikely.

Everything the canvas can already do works on a photo with no new machinery — the
same whole-object containment rule (ADR-033), the same tap-to-select (ADR-084),
the same drag, the same one delta for a mixed selection. It scales about its own
centre, so a row of photos does not walk off down the page as somebody presses
"bigger" three times.

**Photographs taken before this existed have a row and nowhere to be.** Left
alone they would be stored, transcribed, searchable and invisible on the page
somebody took them for — which reads as loss whatever the database says. The
canvas asks `noteImages` once on mount and gives a home to whatever has none,
laid out in a row above the existing content. Somewhere to start, not somewhere
to stay. After the first time it returns nothing new.

**Consequences.** Three files reached the 250-line limit and split by
responsibility, as the rule asks:

    ink-object-plane.ts   BOTH plane layers under one owner -- the engine had a
                          `texts?.` at six call sites and a second layer would
                          have doubled every one of them
    ink-engine-live.ts    what another device did, of every kind
    ink-engine-size.ts    how big a caught thing is, and what shape it turned
                          out to be

`ink-delta.ts` had two near-identical merges and was about to have three.
`mergeById` is now one function for strokes, boxes and pictures — the third copy
is what made the duplication a liability rather than a smell.

#### The camera has no surface of its own

The first cut of this replaced the 40vh strip with a small pill at the foot of
the page saying "Adding your photo…", and that pill was wrong for a reason worth
writing down: **ADR-061 collapsed four live-status surfaces into one line**, and
a pill of our own floating over the foot of the page was quietly the fifth. The
fix was not to style it better. It was to delete it and publish to the line, the
way the autosave, the ink sync and the agent's remarks already do.

The wording had to change with the venue. The line never wraps — it ellipsises —
so "The photo did not upload. It is still on your device — try again." arrived as
about half of itself. It is one clause now, sentence case, no full stop: *That
photo did not upload — it is still on your device.* Reaching for the camera again
clears it, because that is the retry.

**Nothing is said on success.** The picture appearing on the page is the
confirmation, and a line that repeats what somebody can already see is exactly
the noise ADR-061 exists to remove.

Trouble on the line also gained weight it did not have. Before this, a failed
upload and "Jot saved." were the same object with one different opacity. It is
still the same small pill in the same place — it does not grow, jump, or take
the middle of the screen — but it is drawn at full strength, ringed in the error
colour, and rises once on arrival. Once, and never again: a status that keeps
moving is a status people learn to ignore.

#### What a browser found that the suites did not

All of the above was green — typecheck, lint, twenty-two domain checks against
real Postgres — before any of it was opened. Three things only a browser knew:

**A slot with no bytes is not a photograph.** Asking for an upload URL writes the
block and the asset row *before* anything is sent, so an upload that fails on the
wire leaves one behind with no picture in it. The rescue pass adopted those
happily and put empty rectangles on the page — a picture of nothing, which is
worse than the tray it replaced. `noteImages` now requires `byteSize`, which
`finalizeMedia` sets and nothing else does.

**A picture whose bytes will not load shows nothing**, rather than a framed empty
rectangle. The placement stays — a page is not ours to edit because a URL
expired — but it stops claiming there is a photograph there.

**The API served every media file as `application/octet-stream`**, and no browser
will decode an image it has been told is a byte stream. The line was already a
ternary whose two branches were identical, which is the shape of an intention
that never landed. It reads the type from the extension the key already carries
(`mediaKey` builds it from the content type at upload), so nothing new is stored.
This predates all of the above and made every photograph invisible in local
development, with a 200 and the right bytes on the wire the whole time. Azure
serves its own type and never reaches that code.

Then it was watched working end to end: adopted, rendered at the right aspect
ratio, framed by the camera, tapped to select, dragged, and the new position read
back out of `jsonb` — on a 390px viewport.

**What this does NOT do yet.** Export renders strokes and text; a selection saved
as an image will not carry the photograph in it. The renderer would have to embed
the bytes, and that is a separate piece of work with its own decisions about size
and signing. It is a gap, and it is stated here rather than discovered la
