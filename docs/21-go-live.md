# 21 — Turning the paid features on

_Checked against the live cluster on 2026-09-16._

**Most of this is already done.** The four model seams run, in production, against a real
Azure OpenAI account. What is left is one vault entry for billing, and one thing to confirm
in the Stripe dashboard.

Every switch is a Key Vault secret plus a redeploy. **None of it needs a code change.**

---

## 0. What is actually on

There is no health endpoint that reports provider state, and a green apex proves nothing
(ADR-096). Ask the cluster. This prints key NAMES only, never values:

    kubectl -n jotacular get secret jotacular-secrets \
      -o go-template='{{range $k,$v := .data}}{{$k}}{{"\n"}}{{end}}' | sort

A vault entry is named with hyphens and arrives as underscores — `vision-provider` becomes
`VISION_PROVIDER`. `release.yml` does the translation, and a name on neither of its
allow-lists cannot reach a container at all.

**A switch without its keys now fails the deploy** rather than producing a 503 the first
time somebody uses the feature (ADR-113). Set both, or set neither.

---

## 1–4. The models — already on, and Azure, not OpenAI

ADR-051 settled this: all four seams run against **one** Azure OpenAI account created by
sparx's Terraform in `terraform/envs/azure/jotacular.tf`. Azure startup credits pay for it.
**The key is written by Terraform and never typed** — the same property as the generated
database passwords, because a hand-transcribed credential is a crashloop two stages later
with nothing pointing at the typo.

As of 2026-09-16 the live secret holds all of it:

| | |
|---|---|
| `VISION_PROVIDER` | `azure` |
| `EMBEDDING_PROVIDER` | `azure` |
| `SPEECH_PROVIDER` | `azure` |
| `TRIAGE_PROVIDER` | `azure` |
| `AZURE_OPENAI_ENDPOINT` | `oai-jotdojo-prod-eus2`, in **eastus2** |
| `AZURE_OPENAI_API_KEY` | written by Terraform |
| `AZURE_OPENAI_API_VERSION` | `2024-10-21` |
| deployments | `jotdojo-vision`, `jotdojo-embedding`, `jotdojo-speech`, `jotdojo-triage` |

And the worker says so out loud on boot, which is the check worth making:

    kubectl -n jotacular logs deploy/worker --tail=30 | grep draining

    [worker] draining block.embed (jotdojo-embedding) block.recognize/vision (jotdojo-vision)
             block.recognize/speech (jotdojo-speech) block.structure (jotdojo-vision)
             note.triage (jotdojo-triage)

Deployment names rather than `fake-*` is the difference between a pipeline that is proven
and one that is running.

**`01-config.yaml` still shows these commented out, and that is correct.** It is the
default for a deployment nobody has approved spend for. The vault is what this one
actually runs on, and the vault wins.

### eastus2 is not a preference

`whisper` is listed in the platform's `centralus` with SKU `None` — in the catalogue, not
deployable. Azure OpenAI is reached over HTTPS and is not VNet-bound like Postgres and AKS,
so it sits where the model exists. It has to be whisper rather than
`gpt-4o-mini-transcribe`, because `packages/speech` asks for `verbose_json` with word
timestamps and the gpt-4o transcribe models support neither.

`text-embedding-3-small` is not a free choice either: it is natively 1536 dimensions,
`block_embeddings.embedding` is `vector(1536)`, and the provider refuses any other width.
Changing it is a migration **and** a full re-embed.

### What to actually verify

- Draw a page on a real iPad. Wait ten seconds. A transcript appears under the canvas.
- Ask Claude over MCP to read it back. It should quote your handwriting.
- Photograph something written on paper. Same.
- Search for something by **meaning** — "what did I decide about pricing" on a note that
  never uses the word pricing.

**Every page ever drawn becomes readable the moment recognition runs**, because the strokes
were kept rather than a raster (docs/08). The backfill is `pnpm reread` (ADR-046), dry run
by default, scoped with `--space`.

**Nothing has measured quality.** `EMBEDDING_MAX_DISTANCE` is a starting value; `search:smoke`
runs a hash projection with no semantics. The triage prompt in
`packages/reason/src/provider.ts` is a first draft nobody has tuned, and its failure mode is
not a crash — it is a well-behaved agent saying something obvious on every third note.
Triage is Team-only and off per space until an owner turns it on, so nothing happens by
itself.

---

## 5. Money — already configured; the next deploy switches it on

The live secret already holds **all five** Stripe values, and the secret key is a **live**
one, not a test key:

    STRIPE_SECRET_KEY        live mode
    STRIPE_WEBHOOK_SECRET    a whsec_ signing secret
    STRIPE_PRICE_SOLO        a price id
    STRIPE_PRICE_FAMILY      a price id
    STRIPE_PRICE_TEAM        a price id

**There is nothing left to set.** ADR-114 removed the switch: Stripe is derived from its
keys, because a `BILLING_PROVIDER=stripe` sitting beside five secrets was a fact the
environment already knew, stated twice — and the two can disagree, which is exactly how
those five ended up inert.

So **the next deploy turns billing on**, and the key is a live one. That is the intent, and
it is also the reason the check below is no longer optional.

### First, confirm the webhook in Stripe

The one thing a vault listing cannot tell you, and the one thing that must be true before
the deploy rather than after. The webhook must point at:

    https://app.jotacular.com/api/billing/webhook

subscribed to subscription created / updated / deleted, and its signing secret must be the
`whsec_` already in the vault.

> **A deployment with the key but no registered webhook takes money and grants nothing.**
> The webhook is the only way a space ever becomes paid (ADR-038). This is exactly the
> failure ADR-049 found: entitlement rules, SQL doors and 35 passing checks, and no way for
> a person to actually pay.

### After the redeploy, in this order

1. **The account page offers something.** With no provider it shows nothing to buy, so a
   visible price is the first proof the switch arrived.
2. **Buy one, with a real card.** Solo on your own space — $5 is the cheapest honest test
   and it exercises the whole path. The key is live, so this is real money.
3. **The plan actually changed.** The account page should say Solo and the allowance should
   jump from 100 to 1,000 immediately. If you paid and it still says free, **the webhook is
   not reaching us** — that is the one failure worth stopping for.
4. **The portal opens.** An owner who has paid gets a manage link; somebody who never paid
   gets nothing, which is correct.
5. **Cancel it.** The space falls back to free at the end of the period. A failing card must
   NOT take the plan away mid-month — `app_apply_subscription` keeps `past_due` on its plan,
   because a failed card is a conversation, not a downgrade.

### What is enforced the moment money works

- **Free reads, paid writes.** An agent on a free space can read and cannot write (ADR-042),
  checked at use time so an upgrade takes effect immediately.
- **Readings.** 100 / 1,000 / 2,000 / 10,000 per space per month. Over the line a reading is
  deferred, never refused, and capture is untouched (ADR-007).
- **Seats.** 1 / 1 / 6 / 25, counted at invite time and again at accept time (ADR-112).
  A free space holds one person, so **sharing is something you buy**.

---

## What is still not true after all of this

- **Quality is unmeasured.** The models are running; nobody has judged the answers.
- **Directory listings.** OpenAI first (no org needed), Anthropic second (needs a 2-seat
  Team org on a business email). docs/18 has the checklist. This is the acquisition bet and
  it is still unplaced.
- **Annual billing.** docs/01 says "annual equals two months free" and only monthly prices
  exist.
- **Per-member overage.** The page says "more than twenty-five people? write to us", which
  is honest and manual. ADR-112 says what quantity-based subscriptions would take.
- **Managed identity.** ADR-051 calls it the right end state for the Azure key: it needs
  `roleAssignments/write` (which the release identity deliberately lacks), bearer-token auth
  in all four seams, and AKS workload identity. A project, not a line.
