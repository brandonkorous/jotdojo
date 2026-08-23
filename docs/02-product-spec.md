# 02 — Product spec

## Core objects

Four. Resisting a fifth is a design goal.

| Object | Is | Is not |
|---|---|---|
| **Space** | A container people share — a family, a team, or just you | An org chart, a workspace hierarchy |
| **Note** | An ordered list of blocks, plus a title we usually infer | A page tree, a database row |
| **Block** | One unit of captured content: text, ink, audio, or image | A rich nested layout primitive |
| **Comment** | A remark on a note, by a person or an agent | A task, a mention system |

Deliberately absent: tags-as-taxonomy, due dates, assignees, statuses, folders. If a note needs a status, it belongs in kanninja.

Notes may be pinned and archived. That is the entire organizational system in v1. Search does the rest.

## The capture contract

Non-negotiable. Everything else bends to it.

> From intent to captured must be under one second, and capture must never block on anything intelligent.

Concretely:

1. Tap capture, input is live in 300ms or less. No spinner, no auth round-trip, no model load.
2. Content persists locally and starts uploading immediately — per keystroke batch, per stroke batch, per audio chunk.
3. The sheet dismisses the instant the user is done. It never waits for transcription, embedding, titling, or recognition.
4. Everything smart happens after, in the background, and the note visibly updates when it lands.

A capture that fails must fail loudly and recoverably: content preserved locally, retried, and surfaced. Silent loss is the product's death.

## Capture modes

Shipped in this order. See [12-roadmap.md](12-roadmap.md).

### Typed
The baseline. Plain markdown, autosave on a debounce, optimistic concurrency on revision number.

**There is a formatting toolbar, and it writes markdown rather than rich text** (ADR-045): bold, italic, underline and three sizes, applied to the text itself with the usual shortcuts. The surface stays a real `<textarea>`, so Scribble keeps working and the body an agent reads is the body that was typed. A rich-text *document* model is still not something we are building — see the list at the bottom of this file.

### Shortcuts on iOS — P0, ships with typed
Say "Hey Siri, jot", dictate, and it POSTs to the API. Works from a locked phone, from the share sheet, from the Action Button. This is the true bar-napkin path and it costs us no audio pipeline. Full detail in [09-shortcuts.md](09-shortcuts.md).

### Handwritten
Finger and stylus. Two sub-modes:

- **Scribble on iPadOS, free.** Apple Pencil writing directly into a normal text field. Zero engineering, produces real text.
- **Ink canvas.** True stroke capture with pressure and tilt, recognized asynchronously into a transcript.

Full detail in [08-ink.md](08-ink.md).

### Voice
In-app recording for long-form: a meeting, a rant in the car. Audio always retained, transcript generated server-side. Short voice capture should go through Shortcuts dictation instead — faster, and free for us.

### Image
Camera or upload. An `input` element with `accept` set to images and `capture` set to environment opens the camera directly on iOS Safari. Processed into OCR text plus a VLM description, both searchable.

Photographing an actual napkin and having it become searchable, agent-readable text is the product's hero demo. Treat it as a marketing asset, not just a feature.

## What happens after capture

Every block, regardless of modality, ends up with the same four fields. This is the whole architecture in one line:

    raw_artifact, transcript, transcript_source, confidence

See [07-capture-pipeline.md](07-capture-pipeline.md).

Consequences:

- Search covers everything, including handwriting and speech.
- MCP exposes everything as uniform markdown.
- Raw artifacts are kept forever, so notes get more legible over time as models improve. Re-running recognition on old notes is a feature we can ship any Tuesday.

## Search

Hybrid. Three strategies, all required, fused with reciprocal rank fusion.

- **Lexical** via Postgres tsvector. Finds exact strings and proper nouns.
- **Semantic** via pgvector over block embeddings. Finds "what did I decide about pricing" when the note never used the word pricing.
- **Fuzzy** via pg_trgm. Finds it when you typed "kubernets" one-handed on a phone. tsvector stems, it does not spell-correct, so without this the misspelling returns nothing at all.

Every result reports **which strategies found it**. This is for the agent, not for decoration: a hit found only semantically is a guess about what you meant, one found by all three is close to certain, and an agent that can see the difference can hedge instead of asserting.

Semantic recall has a **distance floor**. Vector search returns its k nearest neighbours no matter how far away they are, so without one, searching for something you never wrote returns your entire notebook, ranked and confident. Below the floor, the honest answer is "no notes match" — and search says so plainly, so an agent does not conclude the tool is broken and go looking for another way in.

Semantic search is the single most valuable MCP tool we expose. An agent asking about a decision needs meaning, not keywords. It stays inside Postgres rather than moving to a dedicated search engine, because that is where the tenancy boundary lives — see ADR-023.

## The review inbox

Where agent-authored changes land for approval. Shows what changed, which agent and model did it, when, and a one-tap revert.

This is a safety control wearing a product feature's clothes, and it is a genuine differentiator — no note app has one, because none of them designed for agents writing.

## Agent write policy (settled)

- **Comment by default.** An agent's normal output is a comment on a note, not an edit to it.
- **Edits require an explicit per-space grant**, off by default, revocable.
- **Every mutation is attributed and reversible**: author type, agent identity, model, timestamp, prior revision.
- Nothing an agent does is destructive. Delete is always soft.

## v1 non-goals

Concurrent editing of the same paragraph by two people (CRDTs — live multi-device updates
and presence DO ship, ADR-058), a rich-text document model (the markdown toolbar in ADR-045 is not one), attachments beyond images and audio, note templates, reminders and notifications, public share links, import from other apps, browser extension, offline-authoritative editing.

Several of these are good ideas. None of them is "the thought lands in under a second."
