# 01 — Audience and pricing

## Who this is for

Three groups, all sub-10 people, all already living in Google accounts.

### 1. The founder with a napkin
Building something. Ideas arrive constantly and at bad times. Already pays for Claude or ChatGPT. Wants the idea captured now and turned into a plan later without retyping it.
**Buys because:** the note to agent to kanninja loop is the only reason they'd switch off Apple Notes.

### 2. The family logistics hub
One or two adults running the household calendar in their head. Wifi password, vet's number, the contractor's quote, kid's shoe size, what the teacher said at pickup. Kids may scrawl on a shared list with a finger.
**Buys because:** "ask Claude what the vet's number is" works on anyone's phone, and because it's cheap and everyone's already on Gmail.

### 3. The six-person startup
No IT department, no procurement, no appetite for Notion Enterprise. Wants a shared place where each person's own agent can read what the company knows.
**Buys because:** "our agent knows what our company knows" for the price of two coffees.

## Who this is explicitly not for

- Enterprises. No SSO, no SCIM, no procurement process, no security questionnaire treadmill.
- PKM power users who want graph views, backlinks, and plugin ecosystems.
- Anyone whose primary need is task management — that's kanninja.
- Regulated-data users (clinical, legal privileged) until [13-security-and-privacy.md](13-security-and-privacy.md) grows teeth we haven't built yet.

## Pricing

Priced on the "affordable" value. Per **space**, not per seat — families will not do seat math and small businesses resent it.

| Plan | Price | Members | What you get |
|---|---|---|---|
| **Free** | $0 | 1 | Unlimited typed notes, search, **an assistant can read your notes**, 100 readings/mo (a page, a photo or a started minute is one) |
| **Solo** | $5/mo | 1 | Everything, **an assistant can also add notes and comment**, 300 readings/mo |
| **Family** | $9/mo | up to 6 | Solo limits, pooled, shared spaces |
| **Team** | $19/mo | up to 5, then $4/member | Family limits scaled by members, shared spaces, triage agent |

Annual equals two months free. No trial gate — the free tier is the trial and it never expires.

> **What is actually enforced, as of 2026-08-21.** All four plans exist, are sellable, and
> can now actually be BOUGHT: there is a checkout on the account page and a webhook behind
> it (ADR-049). Until then the pricing was a leaflet -- a card could have been charged and
> the space would have stayed free, because nothing was listening (ADR-043). **Free reads, paid writes** is enforced at use time, in the domain layer, for
> agent actors only (ADR-042). Metering is a single "recognition units" allowance per space
> — 100 free, 1000 solo, 2000 family, 10000 team — where a unit is a page of handwriting,
> a photo, or a minute of audio; the separate voice-minute and image counts in the table
> above are not modelled separately and nothing depends on them being so. **Seat counts are
> NOT enforced**: nothing stops a seventh person joining a Family space, because Team's
> per-member overage needs quantity-based subscriptions before a cap is honest. **The triage
> agent is built** (ADR-048): Team only, off until an owner turns it on, and one run counts
> as one recognition unit whether or not it had anything to say.

### Why free gets read-only MCP

This is the most important pricing decision in the doc and it is easy to get wrong.

The instinct is to make MCP the paywall, since it's the differentiator. That instinct is wrong. The magic of this product is unbelievable until you see it — someone has to watch Claude read a photo of their napkin before they understand what they're buying. Gating that behind a card kills the word-of-mouth that is our only distribution channel.

So: **free tier proves the magic (read), paid tier makes it useful (write, comment, triage).** The fence sits exactly where the product goes from "neat demo" to "part of my workflow," which is also exactly where our costs start.

### Metering philosophy

**Meter what costs us money. Never meter note count.**

Notes are cheap to store and capping them is hostile to the one behavior we need most — that people capture without thinking. Recognition (ASR, VLM, embeddings) and triage runs are the real COGS, so those are what carry limits.

| Metered | Not metered |
|---|---|
| Voice transcription minutes | Number of notes |
| Images processed (OCR + caption) | Storage of typed text |
| Handwriting pages recognized | Ink strokes stored |
| Triage agent runs | MCP read calls (within fair use) |
| — | Number of spaces |

When a limit is hit: capture still works, recognition queues until next cycle, and we say so plainly. **We never refuse a capture.** Losing a thought because of a billing limit is the one unforgivable failure.

## Rough unit economics

Per active paid user per month, order of magnitude:

- Voice: 300 min ASR is roughly $1 to $2
- Images: 300 VLM captions is roughly $0.50 to $1.50
- Handwriting: VLM-based HTR, bursty, roughly $0.50
- Embeddings, storage, egress: roughly $0.25
- **COGS lands around $2.50 to $4.50 against $5 to $9 revenue.**

Margins are thin at Solo pricing if someone maxes their limits. Watch this; the limits above are the lever. Infrastructure is the bigger fixed problem — see the cost note in [03-architecture.md](03-architecture.md).

### SETTLED FOR NOW: the credit pays, and that is a runway not a business

**Decided 2026-08-22 (ADR-051): Azure OpenAI, funded by Azure startup credits.**
The four seams are provisioned by sparx's Terraform and switched on from the
vault; nothing in this repo changed to adopt it. That buys the launch.

**It does not answer the question below, it defers it.** Credits expire. When
they do, every figure in the table above is once again somebody else's API bill,
charged per use, against a $5 subscription — a Family plan is six people sharing
$9 while we pay per page, per minute and per photo. That is a rented margin, and
at the limits it is not a margin at all.

**What changes in the meantime is that we will know the number.**
`recognition_usage` meters every reading per space from the first day of the
first deploy, so the decision below gets made against measured cost per space
instead of the arithmetic we were doing before any of it shipped.

**Two of the blockers named below are already gone**, because Azure serves the
same models OpenAI does: `text-embedding-3-small` is natively 1536 dimensions,
so `vector(1536)` fits with no migration and no re-embed. The per-seam base URL
is still needed the day any seam moves to a container we run.

**The seams already allow the alternative, which is the good news.** All four
model packages (`vision`, `speech`, `embeddings`, `reason`) accept an
OpenAI-compatible base URL, so pointing them at a container we run is
configuration rather than a rewrite. Two things stand in the way and both are
small:

- All four read the **same** `OPENAI_BASE_URL`. Running embeddings on one host
  and speech on another needs a base URL per seam.
- `vector(1536)` is hardcoded in `_columns.ts` and migration 0000. Local
  embedding models are usually 384 or 768 dimensions, so switching is a
  migration and a re-embed, not a config change.

**What is genuinely cheap to self-host, today, on CPU:**

- **Embeddings.** Text Embeddings Inference or Infinity, both OpenAI-compatible.
  Milliseconds per query, no GPU. This one is close to free and should go first.
- **Speech.** `faster-whisper` behind an OpenAI-compatible `/v1/audio/transcriptions`.
  Runs on CPU at usable speed for note-length audio.

**What is not cheap, and is the honest hard part: handwriting.** Open HTR is
materially worse than a frontier VLM on messy handwriting, and a self-hosted VLM
wants a GPU. Note that docs/08 already has a tier that costs us nothing: Apple
Scribble converts handwriting to text ON THE DEVICE, in any web input, before it
ever reaches us. The cheapest page to read is the one that arrives as text.

**The trap to avoid: swapping a marginal cost for a fixed one too early.** An
API bill scales to zero when nobody is using it. A GPU node bills whether or not
anyone writes a word. At the current user count — nought — every container we
run is strictly worse than the API it replaces. The order that follows from
that is: embeddings and speech on CPU now, because their floor is near zero;
handwriting stays on an API until the volume justifies a GPU, and Scribble
carries the iPad case for free in the meantime.

## Positioning line

> **jotdojo — where the thought lands.**

Not "AI-powered." Not "supercharge your notes." See [11-copy-and-tone.md](11-copy-and-tone.md).
