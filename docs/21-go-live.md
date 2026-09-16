# 21 — Turning the paid features on

Everything in this file is **switched off in production right now**, on purpose.
[infra/k8s/01-config.yaml](../infra/k8s/01-config.yaml) says why: *leave these unset to ship
with the features OFF rather than wrong.* Recognition, semantic search, voice, the triage
agent and billing are all built, tested and inert until somebody approves the spend.

This is the order to turn them on in, and what to check after each one. Every switch is a
Key Vault secret plus a redeploy. **None of it needs a code change.**

---

## 0. Find out what is already on

There is no health endpoint that reports provider state, and a green apex proves nothing
(ADR-096). Ask the cluster. This prints key NAMES only, never values:

    kubectl -n jotacular get secret jotacular-secrets \
      -o go-template='{{range $k,$v := .data}}{{$k}}{{"\n"}}{{end}}' | sort

Look for `VISION_PROVIDER`, `EMBEDDING_PROVIDER`, `SPEECH_PROVIDER`, `TRIAGE_PROVIDER`
and `BILLING_PROVIDER`. Absent means off.

A vault entry is named with hyphens, not underscores — `az keyvault secret set --name
vision-provider` becomes `VISION_PROVIDER` in the container. `release.yml` does the
translation.

**A switch without its keys now fails the deploy** rather than producing a 503 the first
time somebody uses the feature (ADR-113). Set both, or set neither.

---

## 1. Handwriting and photographs — the hero demo

Nothing else on this list matters as much. Until this is on, you can photograph a napkin
and nothing reads it — which is the demo docs/00 calls the moment the product makes sense.

    az keyvault secret set --vault-name <vault> --name vision-provider   --value anthropic
    az keyvault secret set --vault-name <vault> --name anthropic-api-key --value sk-ant-...

Redeploy. Then:

- Draw a page on a real iPad. Wait ten seconds. The transcript appears under the canvas.
- Ask Claude over MCP to read the note back. It should quote your handwriting.
- Photograph something written on paper. Same.

**Every page ever drawn becomes readable the moment this lands.** The strokes were kept
rather than a raster, which is the whole argument in docs/08 — so old notes silently catch
up. That backfill is `pnpm reread` (ADR-046), dry run by default.

Cost lands per page read. Metering is already enforced (ADR-036): over the allowance a
reading is **deferred, not failed**, and capture never stops.

## 2. Semantic search

    az keyvault secret set --vault-name <vault> --name embedding-provider --value openai
    az keyvault secret set --vault-name <vault> --name openai-api-key     --value sk-...

Redeploy. Then search for something by **meaning** — "what did I decide about pricing" on a
note that never uses the word pricing.

**`EMBEDDING_MAX_DISTANCE` is a starting value, not a tuned one.** Nothing has ever measured
recall against a real embedding model; `search:smoke` runs against a hash projection with no
semantics. Expect to move that number once there are real notes behind it.

## 3. Voice

    az keyvault secret set --vault-name <vault> --name speech-provider --value openai

Uses `OPENAI_API_KEY` from step 2. Record a voice note; the transcript should arrive with
word timestamps.

## 4. The triage agent — last, and deliberately

    az keyvault secret set --vault-name <vault> --name triage-provider --value anthropic

This is the one provider whose cost arrives **without anybody asking for it**: it runs on a
schedule over notes that settle. It is Team-only and off per space until an owner turns it
on, so nothing happens the moment you set this.

docs/12 is blunt about the risk: the prompt in `packages/reason/src/provider.ts` is a first
draft nobody has tuned against real notes, and the failure mode is not a crash — it is a
well-behaved agent saying something obvious on every third note until somebody switches it
off. Turn it on for one space, read a week of its remarks, and decide.

---

## 5. Money

Six secrets and a redeploy. **All six together** — `release.yml` refuses a deploy with the
switch and not the keys (ADR-113), which is the failure that used to be silent.

    az keyvault secret set --vault-name <vault> --name billing-provider       --value stripe
    az keyvault secret set --vault-name <vault> --name stripe-secret-key      --value sk_live_...
    az keyvault secret set --vault-name <vault> --name stripe-webhook-secret  --value whsec_...
    az keyvault secret set --vault-name <vault> --name stripe-price-solo      --value price_...
    az keyvault secret set --vault-name <vault> --name stripe-price-family    --value price_...
    az keyvault secret set --vault-name <vault> --name stripe-price-team      --value price_...

### Before that, in Stripe

**Three prices**, matching `PAID_PLANS` in `packages/billing/src/provider.ts`. The plan ids
are `solo`, `family`, `team` — those strings are also what `spaces.plan` holds and what
`app_apply_subscription` will accept, so they cannot drift:

| Plan | Price | What the page sells |
|---|---|---|
| solo | $5/mo | one person, 1,000 readings |
| family | $9/mo | up to 6 people, 2,000 readings |
| team | $19/mo | up to 25 people, 10,000 readings, triage agent |

**One webhook**, pointing at:

    https://app.jotacular.com/api/billing/webhook

Subscribe it to subscription created / updated / deleted. The signing secret it gives you is
`stripe-webhook-secret`.

> **A deployment with the key but no registered webhook takes money and grants nothing.**
> The webhook is the only way a space ever becomes paid (ADR-038). This is the exact failure
> ADR-049 found: entitlement rules, SQL doors and 35 passing checks, and no way for a person
> to actually pay.

### After the redeploy, check in this order

1. **The account page offers something.** With no provider it shows nothing to buy, so a
   visible price is the first proof the switch arrived.
2. **Buy one, with a real card.** Use Solo on your own space — $5 is the cheapest honest
   test and it exercises the whole path.
3. **The plan actually changed.** The account page should say Solo, and the reading
   allowance should jump from 100 to 1,000 immediately. If you paid and it still says free,
   **the webhook is not reaching us** — that is the one failure worth stopping for.
4. **The portal opens.** An owner who has paid gets a "manage" link. Somebody who never paid
   gets nothing, which is correct.
5. **Cancel it.** The space should fall back to free at the end of the period, and a failing
   card must NOT take the plan away mid-month (`app_apply_subscription` keeps `past_due` on
   its plan — a failed card is a conversation, not a downgrade).

### What is enforced the moment money works

- **Free reads, paid writes.** An agent on a free space can read and cannot write (ADR-042),
  checked at use time so an upgrade takes effect immediately.
- **Readings.** 100 / 1,000 / 2,000 / 10,000 per space per month. Over the line a reading is
  deferred, never refused, and capture is untouched (ADR-007).
- **Seats.** 1 / 1 / 6 / 25, counted at invite time and again at accept time (ADR-112).
  A free space holds one person, so **sharing is something you buy**.

---

## What is still not true after all of this

Worth writing down so nobody reads a green deploy as a finished product.

- **Nothing has measured quality.** Recognition, embeddings and triage have all only ever
  run against `fake` providers. The pipelines are proven; the answers are not.
- **Directory listings.** OpenAI first (no org needed), Anthropic second (needs a 2-seat
  Team org on a business email). docs/18 has the checklist. This is the acquisition bet and
  it is still unplaced.
- **Annual billing.** docs/01 says "annual equals two months free" and only monthly prices
  exist.
- **Per-member overage.** The pricing page says "more than twenty-five people? write to us",
  which is honest and manual. Quantity-based subscriptions would change that; ADR-112 says
  what it would take.
