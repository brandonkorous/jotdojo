# 05 — MCP server

## Transport and shape

Streamable HTTP at `https://mcp.jotacular.com/mcp` — matching the sibling's shape (`https://mcp.kanninja.com/mcp`). OAuth 2.1 protected resource; see [06-auth.md](06-auth.md).

The server is a **thin adapter**. Each handler resolves the actor from the token, calls one domain method, and formats the result. No SQL, no permission logic, no business rules live here.

For consistency with kanninja, also support an **API key** path for terminal agents (`JOTACULAR_API_KEY`) alongside OAuth for web clients. Same identity model underneath; the key is simply another credential resolving to a user and a grant.

## Tool surface discipline

**Jotacular ships under a dozen tools.** This is a hard budget.

The reason is sharper now that kanninja is live: **kanninja exposes 42 tools.** An agent doing the flow we care about — read a note, build a plan — is holding both servers at once. That agent already carries 42 tools before Jotacular says a word. Every tool we add is spent from a shared budget, and agents degrade measurably as that budget fills.

This also strengthens ADR-002 rather than weakening it. A *merged* Jotacular + kanninja server would ship 50+ tools and be worse at both jobs. Two focused servers an agent composes is the better architecture, and the tool counts are the evidence.

## Naming: namespace against the sibling

Because agents commonly hold both servers, **no Jotacular tool may share a name with a kanninja tool.** kanninja already owns the generic names — `search`, `list_comments`, `add_comment`, `get_task`, `create_task`.

Rule: **every Jotacular tool name ends in `_note`, `_notes`, or `_spaces`.** No bare verbs.

### Read

| Tool | Purpose |
|---|---|
| `search_notes` | Hybrid lexical + semantic search. **The most important tool we ship.** Ranked snippets with note ids, dates, confidence |
| `get_note` | Full note as markdown, with per-block provenance |
| `list_notes` | Reverse-chronological, for "what did I capture this week" |
| `list_spaces` | Spaces this token reaches, with granted scopes |
| `list_note_comments` | Comments on a note, human and agent, threaded |
| `changes_notes` | What has HAPPENED in a space, newest first. Not the same question as `list_notes` |
| `view_note` | The handwriting itself, as an image. **The only tool that returns a non-text block** |

### Write

| Tool | Scope | Purpose |
|---|---|---|
| `create_note` | `notes:append` | New note from agent-supplied markdown. Touches nothing that exists |
| `append_to_note` | `notes:append` | Add blocks to the end. Non-destructive by construction |
| `comment_on_note` | `notes:comment` | **The default agent output.** Leaves a remark without touching content |

**Ten tools, and not one of them can lose anything.** `search_notes` and `list_notes` take `since` and `until` rather than each spawning a dated variant — the budget does not allow a tool per filter.

There is no edit tool. `update_note` and the `notes:edit` scope were removed on 2026-08-22: a capability that was off by default, deliberately awkward, and granted by almost nobody was still costing a slot, a scope, a consent-screen row and the surface's only confirmation prompt. **An agent can add to a note and cannot change one**, which is a property of the server rather than a promise about it. ADR-070.

### Descriptions may not rank each other

A tool description says what the tool does and what it is for, and stops. It may not tell a model to prefer one tool over another, however true that is — both directories reject a description that steers, because steering toward a neighbour is indistinguishable from steering anywhere else. Safety is carried by `readOnlyHint` and `destructiveHint`, which enforce rather than ask. ADR-069, and `pnpm mcp:tools` is the guard.

### Why `changes_notes` is worth a slot

`list_notes` says which notes are **recent**. That is a different question from what has **happened**: a page whose handwriting was finally read, or that somebody left a comment on, has changed in a way its position in a list cannot express — and an agent asked "anything new?" had nothing to call.

It reads `audit_log`, which already had the shape and the index, and **excludes `note.read`**. `get_note` writes one of those per call, so reads outnumber everything else put together; a feed containing them is a feed nobody can use. ADR-063.

### Why `view_note` is worth a slot

A transcript carries words and nothing else. An arrow, a box, a crossed-out line, a freehand table, a sketch of a room — recognition returns `[handwritten, nothing legible on it]`, which is true and useless, and an agent that stops there reports a blank page.

We keep the strokes, so we can redraw the page at any size and hand it over. **Nobody holding a photograph of that page can do this**, and nothing else in the budget buys a capability that is ours alone.

It returns a caption alongside the image, and the caption is not decoration. It says the drawing is the record and the transcript is a reading of it, and which way a disagreement goes. An image arriving unframed is one a model describes as though somebody had sent a photograph. ADR-068.

## Scopes

| Scope | Grants | Default |
|---|---|---|
| `notes:read` | search, get, list | On, included in free tier |
| `notes:comment` | comment_on_note | On for paid |
| `notes:append` | append_to_note, create_note | On for paid |
| `capture:write` | the Shortcuts endpoint only | Separate credential, see [09-shortcuts.md](09-shortcuts.md) |

Granted **per client, per space**. The consent screen names the client and lists spaces in plain language. Revocation is one tap and immediate.

Free tier is read-only — reasoning in [01-audience-and-pricing.md](01-audience-and-pricing.md).

**Enforced at USE time, not at consent time.** `assertAgentMayWrite` in
`packages/domain/src/plans.ts` refuses an agent write into a space on the free plan, with
code `plan_read_only`, inside the same transaction as the write. Granting fewer scopes at
consent would leave a grant read-only after an upgrade and writable after a cancellation —
entitlement is a live property of the space. ADR-042, exercised by `mcp:smoke`.

## Response format

Uniform markdown with honest provenance. Ink and audio blocks carry their source and confidence:

    # Napkin idea, Tuesday
    _Captured 2026-08-19 21:14, Family space_

    The subscription thing could work if we bundle the onboarding.

    > [handwritten, confidence 0.82]
    > check with Dana about the margins first

    > [voice, 0.94] ...and if it works we should tell Marco before the
    > quarter ends.

Agents see what is uncertain rather than being handed a clean-looking string that might be wrong. Nobody else does this, and it measurably improves how agents treat the content.

When recognition has not finished, say so — never return an empty string:

    > [handwritten, transcription pending]

**And when a reading covers only part of a surface, say that too.** One block is capped at 32 rendered tiles, so a whiteboard photographed at arm's length can exceed what we will read in one pass:

    > [handwritten, confidence 0.71 — PARTIAL, roughly 34% of the surface.
    > The rest was not read. Do not describe this as the whole page]
    > agenda: pricing, hiring, the Thornton renewal

This is the failure mode that matters more than a bad transcript, because a bad transcript *looks* wrong and an incomplete one does not. Without the marker an agent reports a third of a board as the whole board, in the user's own voice, and everything downstream inherits it. A `null` coverage means nobody measured — which is true of every block read before this shipped — and is never presented as a claim that the reading was complete.

Confidence and coverage answer different questions. Confidence is *how sure are you about the words you read*; coverage is *how much did you look at*. A reading can be confident and badly incomplete, and that combination is the one most likely to mislead.

## Composing with kanninja

The intended flow needs **no integration code on our side**:

    user: "read my note from Tuesday and build me a plan in kanninja"
      agent -> jotacular.search_notes("Tuesday napkin")
      agent -> jotacular.get_note(id)
      agent -> kanninja.create_board_with_structure(...)
      agent -> kanninja.bulk_create_tasks(...)

The composition happens in the agent. We get the integration value for free, and the user keeps control of what a note becomes — which is the whole thesis.

Two things make this work in practice, and both are our responsibility:

1. **No name collisions** (above), so the agent never picks the wrong server's `search`.
2. **`get_note` returns clean markdown**, because that output becomes the input to kanninja's task creation. Ragged output here shows up as ragged cards there.

## Safety

Threat model in [13-security-and-privacy.md](13-security-and-privacy.md). The MCP-specific rules:

1. **Note content is untrusted input.** A note can contain text engineered to hijack the agent reading it. We cannot prevent that; we refuse to amplify it. Tool descriptions and error strings are static, never interpolated from user content.
2. **No confused deputy.** Every call executes with the granting user's authority, never the server's. Workers are the only cross-space component and are unreachable from MCP.
3. **Writes are attributed and reversible.** Every mutation writes a `note_revisions` row with client and model; the review inbox surfaces it.
4. **Audit everything** — one row per tool call, reads included.
5. **Rate limits per client**, not just per user. A looping agent hits a wall before it costs real money.
6. **Resource indicators enforced.** A Jotacular token must not work at kanninja. With a live sibling on the same account, this is not hypothetical.

The GitHub MCP incident of May 2025 — a malicious issue hijacking an agent into leaking private repository data through a public PR — is the precedent. Our equivalent is a shared family or team space where one member's captured content reaches another member's agent.

## Client compatibility

| Client | Status |
|---|---|
| Claude (web, desktop, mobile) | Primary target. Full custom remote connector support on consumer plans |
| ChatGPT | Developer-mode custom connectors on paid plans; **write-capable connectors restricted to Business, Enterprise, Edu** |
| Gemini consumer app | No custom connector support. API and Enterprise surfaces only |
| Claude Code, Codex, Cursor | Work today, and the best demo for the founder persona |

**Build and market for Claude first.** ChatGPT read-only works broadly, which suits a read-only free tier. Do not promise the Gemini app until it supports custom connectors.

## Local access

A small stdio shim (`npx @jotacular/mcp`) proxies to the hosted server with a stored token, for clients that still prefer stdio. The hosted server remains the real one — ADR-001.
