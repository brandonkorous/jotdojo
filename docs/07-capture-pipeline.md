# 07 — Capture pipeline

## The shape

One pipeline, many recognizers. This is the design that makes "add video in 2027" a Tuesday instead of a rewrite.

    capture (text | ink | voice | image)
      |
      +-- SYNCHRONOUS  (must complete in well under 1s)
      |     persist raw artifact
      |     create block with transcript_state = pending
      |     write outbox row in the same transaction
      |     return 201
      |
      +-- ASYNCHRONOUS  (worker, no deadline the user can feel)
            recognizer(kind) -> transcript + confidence
            embed(transcript) -> pgvector
            maybe infer note title
            mark ready, push SSE to any open client

**The synchronous half never calls a model.** Not for transcription, not for titling, not for embedding, not for anything. If a model is in the capture path, the capture contract in [02-product-spec.md](02-product-spec.md) is broken.

## The recognizer interface

Every modality implements the same tiny contract, in `packages/recognizers`:

    interface Recognizer {
      kind: 'ink' | 'audio' | 'image'
      recognize(artifact: MediaAsset, ctx: Ctx): Promise<{
        transcript: string
        confidence: number      // 0..1
        source: string          // e.g. 'htr:vlm', 'asr:azure'
        cost: { units: number, unit: 'minutes' | 'images' | 'pages' }
      }>
    }

Adding a modality is: write one class, register it, add a `kind` enum value. No schema change, no new table, no new endpoint.

## Recognizers, v1

| Kind | Implementation | Notes |
|---|---|---|
| `text` | identity | `transcript = body`, confidence null |
| `ink` | render strokes to PNG, send to a VLM | Start here. Zero licence cost. Swap to MyScript iink if accuracy or unit cost demands it |
| `audio` | Azure Speech (or Whisper) | Already in the Azure stack. Keep word-level timestamps for later playback sync |
| `image` | Azure AI Vision Read for OCR + a VLM for description | Two passes, concatenated. OCR gets the receipt total right; the VLM explains what the picture is |

**Images produce two things and both matter.** OCR alone on a photo of a whiteboard gives you fragments. A VLM caption alone loses the exact numbers. Store both, concatenated, and search covers each.

For sketches and diagrams, do not attempt transcription — generate a description. "Whiteboard sketch of a deploy pipeline: three boxes labelled build, test, ship." That makes drawings searchable and agent-legible, which nobody else does.

## Idempotency and failure

- Outbox rows carry `attempts`; workers claim with `FOR UPDATE SKIP LOCKED` and a `locked_until` lease.
- Recognition is idempotent by block id. Re-running overwrites the transcript, which is exactly what we want for the re-recognition feature.
- Backoff: 1m, 5m, 30m, 2h, 12h. After five attempts, `transcript_state = 'failed'` and the UI offers a manual retry.
- **A failed transcript never loses the artifact.** The ink, the audio, the photo are all still there and still viewable. Failure degrades searchability, never content.

## Cost control

Recognition is the whole COGS story, so the pipeline enforces the plan limits, not the API layer:

1. On capture, the block is created regardless of quota. Always.
2. The worker checks the space's remaining allowance before calling a model.
3. Over quota, set `transcript_state = 'deferred'` and re-queue for the next billing cycle.
4. The UI says so plainly: "transcription paused until your limits reset on the 4th."

**We never refuse a capture for billing reasons.** Losing a thought to a quota is the one unforgivable failure — see [01-audience-and-pricing.md](01-audience-and-pricing.md).

Other levers:
- Batch embedding calls; they are cheap but chatty.
- Skip embedding for blocks under ~15 characters. "milk" does not need a vector.
- Cache by artifact hash. Re-uploading the same photo should not cost twice.

## Re-recognition

Because raw artifacts are kept forever, a better model can be run over old content at any time:

    worker: reprocess(space_id, kind, since?) -> re-queue block.recognize

Users see old handwriting quietly get more accurate. This is a genuinely good feature to have in reserve and it costs nothing to design for now — it only requires that we never throw the raw away.

## Title inference

Notes usually get no title, because typing one violates the capture contract. The worker infers one from the first block once recognition lands, and stores `title_source = 'inferred'`. A user editing the title flips it to `'user'` and inference stops touching it forever.

Keep inferred titles short and literal. This is not a place for cleverness.

## The triage agent

Built. ADR-048, `packages/reason`, `note.triage`, `triage:smoke` (42).

A scheduled pass over notes that have STOPPED changing since the space was last looked at:

    for each settled note:
      read what it says
      is there an action here? a date? a person waiting?
      if yes -> leave a COMMENT
      never edit the note

This is what makes the app feel alive rather than inert, and it fits the comment-by-default
policy exactly (ADR-004). It costs real tokens per user, which is why it sits on the Team
plan and is metered — one run is one unit, charged whether or not it had anything to say.

It is off until an owner turns it on, and **off means off**: the check runs when work is
queued and again when it is claimed, so a job queued last night does not speak this morning
to somebody who switched it off in between.

Three settings, all with defaults that make it an assistant rather than an interruption:

| Setting | Default | What it controls |
|---|---|---|
| `TRIAGE_QUIET` | 15 minutes | how long a note must be untouched before it is read |
| `TRIAGE_LOOKBACK` | 24 hours | how far back a space looks the first time it is switched on |
| `TRIAGE_EVERY_MS` | 5 minutes | how often the worker looks for notes that have settled |

**What is not met.** Everything is proven against the `fake` reasoner, which cannot judge
anything — it speaks when it sees a word like "Monday" and stays quiet otherwise. Whether a
real model's remarks are worth reading is entirely unmeasured, and the prompt in
`packages/reason/src/provider.ts` is a first draft that nobody has tuned against real notes.
