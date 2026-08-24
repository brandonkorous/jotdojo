# 18 — App directories

How Jotacular reaches the people who will never learn the word "MCP", and the checklist any
of our products can reuse to do the same.

Researched 2026-08-22 against Anthropic's Software Directory Policy, the Claude connector
submission docs, and OpenAI's Apps SDK submission guidelines. **Directory programmes move
quarterly — re-read the sources in [Sources](#sources) before acting on this doc if it is
more than a quarter old.**

## The problem this solves

[01-audience-and-pricing.md](01-audience-and-pricing.md) names three buyers. Exactly one of
them — the founder with a napkin — will read a blog post, copy `https://mcp.jotacular.com/mcp`,
find the right settings screen in their client, and paste it. The family logistics hub and
the six-person startup will not, and they are the two the per-space pricing was designed for.

The pricing table sells the feature as **"read-only MCP"** and **"full MCP (write + comment)"**.
Those are unreadable to the people they are aimed at, and they break the rule in
[11-copy-and-tone.md](11-copy-and-tone.md): write to the reader's life, not our engineering.

A directory listing fixes both halves at once. The user finds Jotacular inside the client they
already pay for, taps install, signs in with Google, and is done. No URL, no vocabulary.

## What a listing actually is

**It is the MCP server we already have.** Not a port, not a second product. Both directories
list remote MCP servers over streamable HTTP with OAuth 2.0 in front. We built the expensive
part — [06-auth.md](06-auth.md) — a year before it paid for itself.

What a listing adds is discovery and an install button. What it costs is a review process,
some metadata, and a permanent constraint on how our tools are described.

| | Anthropic Connectors Directory | ChatGPT app directory |
|---|---|---|
| What it lists | Remote MCP servers, MCPB desktop extensions, MCP Apps | Apps built on the Apps SDK (MCP underneath) |
| Submit from | Claude.ai org settings → submission portal | platform.openai.com |
| Prerequisite | **Team or Enterprise org, Owner role** — see [the account](#getting-into-the-anthropic-directory-the-account) | **Verified identity** for the publishing name. No org, no seats |
| Fallback if unlisted | Prefilled install link — a real button, any plan | **None a non-technical person can use.** Developer mode only |
| Default outcome | Listed as a *community* connector after an automated policy scan | Reviewed, then you publish manually once approved |
| Higher tier | Anthropic escalates useful listings to *verified* — every tool functionally tested. Not requestable | — |
| Reach | Claude.ai, Desktop, mobile, Code, Cowork — one catalog | ChatGPT |
| Bonus | Directory entries are eligible for **Suggested Connectors** — in-chat recommendation, automatic, usage-ranked | Directory browse + in-chat discovery |

Anthropic requires no domain-ownership proof; that applies to the open MCP Registry, not the
directory. Ranking on both is usage-based, like any app store.

## Requirements, and where we stand

### Tool annotations — the blocking gap

Both directories require, and both name as the most common rejection reason:

- `title` — human-readable, on every tool
- `readOnlyHint: true` — tools that do not change state
- `destructiveHint: true` — tools that modify or delete
- `openWorldHint` — OpenAI additionally wants this on tools touching external systems

**We shipped none of them.** Annotations are not decoration: Claude uses them for
auto-permissions. A read-only tool runs without per-call confirmation; a destructive tool
always prompts. Fixed in ADR-069, and guarded by `pnpm mcp:tools`.

ADR-070 then removed the only destructive tool there was, so **nothing on the surface prompts**:
an agent reads, adds and comments, and cannot replace a note. That is the smoothest possible
review and the smoothest possible install, and it is a better sentence for a listing than any
description we could have written.

### Descriptions must not steer

Rejected if a description instructs Claude to call other software, interferes with Claude
calling other tools, contains hidden or encoded instructions, or tells Claude how to behave
rather than what the tool does.

Our descriptions did all of this in good faith — `update_note` said "Almost always the wrong
tool: use comment_on_note", which is honest, correct, and exactly the disallowed shape. The
honest ending was to remove the tool rather than to describe it more carefully. ADR-069,
ADR-070.

### Split read from write

A single tool taking both safe and unsafe operations is rejected outright — no `api_request`
with a `method` parameter. Our surface was already split this way for other reasons.

### Everything else

| Requirement | Where we stand |
|---|---|
| Streamable HTTP (SSE deprecated) | Done — `StreamableHTTPServerTransport` |
| OAuth 2.0, certificates from recognised authorities | Done — [06-auth.md](06-auth.md). Pure `client_credentials` is rejected; we use auth code + PKCE |
| Tool names ≤ 64 characters | Done — longest is `list_note_comments` |
| First-party API only | Done — we own every endpoint the server touches |
| Graceful, actionable errors | Partly. Generic "Internal Server Error" fails review; our `DomainError` codes are specific but the MCP transport flattens some |
| Token usage commensurate with task | Done — `search_notes` returns ranked snippets, not dumps |
| No conversation-data collection | Done — we never read Claude's memory, chat history or files |
| Privacy policy URL | Have one — [privacy.md](../apps/web/content/legal/privacy.md) |
| Public documentation by publish date | Have blog posts; they are written for developers. Needs a plain-language page |
| Support contact | Needed |
| Every tool succeeds for valid input | Fixed. `create_note` required a scope that is not grantable and threw `Forbidden` for every agent that ever called it — ADR-070 |
| Test account, fully populated | **Needed.** A reviewer gets a stranger's-eye run of every tool; an empty account fails |
| Three worked example prompts | **Needed** |
| Icon, tagline (55 char), description (2000 char), 1–5 categories, permanent slug | **Needed** |

### Prohibited, and whether it touches us

Anthropic bars financial transactions and asset transfers, AI generation of images/video/audio,
and advertising or promotional vehicles. OpenAI additionally bars digital products,
subscriptions, tokens and credits, **promoting upgrades or initiating new subscriptions**, and
requires external checkout on our own domain.

None of this blocks Jotacular, but one thing follows from it directly: **the `plan_read_only`
refusal must state the fact and must not sell.** The message in
[plans.ts](../packages/domain/src/plans.ts) — "This space is on the free plan, where an agent
can read but not write" — is correct as written. Do not turn it into an upsell.

OpenAI also bars restricted data in tool schemas: payment card data, health information,
government identifiers, credentials. We do not request any of it. Notes are freeform and a
user may write anything into one, which is a storage question our privacy policy already
answers, not a schema question.

## The button you can ship without asking anyone

A directory listing needs a Team org and a review queue. **Removing the URL from the user's
path needs neither.** Custom connectors take a prefilled install link:

    https://claude.ai/customize/connectors?modal=add-custom-connector
      &connectorName=Jotacular
      &connectorUrl=https%3A%2F%2Fmcp.jotacular.com%2Fmcp

A **Connect to Claude** button pointing at that opens Claude's add-connector dialog with the
name and URL already filled in. The person confirms, signs in with Google, and is connected.
No copying, no settings screen, no vocabulary. The link only prefills — it grants nothing the
user has not confirmed, and it works for a signed-out visitor, who is prompted to sign in and
lands back on the dialog.

What it does not buy is discovery: directory browse and search, and **Suggested Connectors** —
Claude recommending Jotacular in-chat when it is relevant, which every directory entry gets
automatically and no custom connector ever does. That is the acquisition win, and it is what
the Team seat is actually for.

So the two are not alternatives. The button fixes the funnel today; the listing is what makes
people find us at all.

## There is no ChatGPT button, and there cannot be one

Researched 2026-08-23, because most non-technical people reach for ChatGPT first and the
obvious move was to copy the button across. It does not transfer, and the reason matters more
than the answer.

**ChatGPT has no prefilled install link.** Nothing equivalent to Claude's
`?modal=add-custom-connector` appears in OpenAI's documentation.

**Adding an unlisted server requires Developer mode**, a toggle the user has to find in
settings — and OpenAI describes it, in its own words, as *"powerful and dangerous, intended
for developers who understand how to safely configure and test apps"*, with warnings about
prompt injection and destructive writes shown to whoever enables it. It is a testing facility,
not an install path.

**It is not on the free tier** — Plus, Pro, Business, Enterprise or Education only. On Business
and Enterprise an admin must additionally allow custom connectors.

**And the location keeps moving.** The toggle has lived under Connectors → Advanced, then
Security and login, then Apps → Advanced settings, and "Connectors" was renamed "Plugins"
around July 2026. Any walkthrough we write goes stale in a quarter.

**Corrected 2026-08-24.** All of the above is about ChatGPT *on the web*, and it still
holds there. The desktop app is a different surface: **Settings -> MCP servers -> Add
server** takes a Streamable HTTP address with no developer mode and no warning screen, and
the desktop app, the Codex CLI and the IDE extension share that one configuration. It
authenticates by Client ID Metadata Document on a loopback port, which is what ADR-097 is
about. So ChatGPT does now have a fallback -- it just costs the reader an app download,
which the Claude one does not.

### What follows from that

For the audience this whole document is about, **the ChatGPT directory listing is not the
better path, it is the only path.** Claude has a working fallback that costs nothing; ChatGPT
has no fallback a non-technical person can use.

And the OpenAI submission needs **no organisation, no Team plan, and no seats** — a verified
platform account and identity verification for the publishing name. It is the cheaper of the
two directories and the one aimed at the larger non-technical audience.

**So OpenAI goes first.** That reverses the order this document originally implied, and it is
the single most useful thing the ChatGPT research produced.

## Getting into the Anthropic directory: the account

The submission portal lives in organisation settings, so it needs a **Team or Enterprise
organisation with you as Owner**. Confirmed against the docs and against a real account on
2026-08-23: an individual plan has no portal.

| | |
|---|---|
| Where | [claude.ai/upgrade](https://claude.ai/upgrade), signed into the existing account |
| Email | **Must be a business domain.** gmail/yahoo/hotmail are rejected |
| Minimum | 2 seats (down from 5 in July 2026) |
| Cost | ~$20/seat/month annual, ~$25 monthly — so **~$40–50/month** for the smallest org |
| Owner | Decide the Primary Owner **before** signup; changing it later needs a support request |

Two things worth knowing before it is paid for:

- **Upgrading creates a SEPARATE organisation.** The personal account survives and you toggle
  between them from your initials. **You do not lose a personal Max subscription** by creating
  a Team org — which is what makes a minimal 2-seat org viable purely as a submission vehicle.
  Team seats come in Standard and Premium (~$100–125); whether Premium carries Max-equivalent
  limits is worth checking at checkout, but nothing about submitting needs it.
- **Do not migrate the personal account into the org.** You will be offered it. It moves chats,
  projects, files and memory, cancels the individual subscription, and **cannot be undone**.
  The org is a business account and a submission vehicle; it is not where existing work needs
  to live.

The business mailbox is the real first step, and it is not wasted: the directory listing needs
a **support contact** and OpenAI needs **identity verification** for the publishing name. One
address unblocks all three.

**Status 2026-08-23: deferred by a week or two.** Nothing else is blocked by it — the code is
done, the button is live, and OpenAI does not need it.

## The plan

**Phase 1 — make the server submittable. DONE 2026-08-22.** Annotations on all ten tools,
descriptions rewritten to drop cross-tool steering, the edit tool removed, and `create_note`
fixed — it had never once succeeded for an agent. ADR-069, ADR-070. `pnpm mcp:tools` guards it
in CI.

**Phase 2 — make the product legible, and ship the button. DONE 2026-08-22.** A **Connect to
Claude** button on the account page, and "MCP" gone from every surface a buyer sees. The word
survives in the blog, where it is credibility for people who already know it. Still to do: the
button on the marketing site, which is where a visitor who has not signed up yet will meet it.

**Phase 3 — submission assets.** Populated demo account with a reset procedure, three worked
prompts, icon, tagline, description, categories, support contact, a plain-language docs page.

**Phase 4 — submit to OpenAI.** No organisation and no seats required, and it is the directory
our least technical audience actually browses. Identity verification for the publishing name is
the only lead-time item.

**Phase 5 — submit to Anthropic.** Business mailbox, then a 2-seat Team org, then the portal.
Deferred to early September 2026. The Connect to Claude button carries Claude users in the
meantime, so nothing is waiting on this.

**Phase 6 — reconsider the funnel.** [16-web-presence.md](16-web-presence.md) assumes the
website acquires. If a listing works, the directory acquires and the site is where people
land afterwards. Do not build more SEO on the old assumption until the listing has data.

Deliberately not in scope: **MCP Apps**. Anthropic supports interactive UI widgets, and
`view_note` is the obvious candidate. It adds a screenshot requirement (3–5 PNGs, ≥1000px
wide, cropped to the response, no prompt visible) and a second review surface. Ship the plain
listing first, learn from it, then decide.

## What practitioners report that the docs do not

From first-hand submission accounts rather than Anthropic's own pages, so treat these as
leads to verify rather than settled requirements.

- **Annotations are reportedly behind roughly 30% of rejections.** Consistent with both
  directories naming them first. We now fail CI rather than fail review.
- **Review takes about two weeks by Anthropic's own estimate, and one account waited over a
  month.** Plan the launch around a listing arriving late, which is another argument for
  shipping the button first.
- **The redirect URI Claude registers is `https://claude.ai/api/mcp/auth_callback`.** We do
  exact matching with no wildcards, and Claude registers its own URI through DCR, so this
  should hold — worth confirming against a real connection before submitting.
- **Origin-header validation comes up repeatedly, and in both directions.** One account says
  reject anything not from `https://claude.ai`; another lists *"origin validation rejecting
  legitimate Anthropic requests"* as a rejection cause. **We do none**, which is the safe side
  of that trade: for a remote server the bearer token and the RFC 8707 audience check are the
  real defence, and a strict Origin rule would break Claude Code, MCP Inspector, ChatGPT and
  our own smokes, none of which send a browser origin. Do not add one on the strength of a
  blog post; ask the review team if it is ever raised.
- **Populate the test account with several items of different kinds**, not one of each. A
  reviewer running `list_notes` against a near-empty account cannot tell working from broken.
  For us that means typed notes, a handwritten page with legible words, a handwritten page
  that is a *diagram* (so `view_note` shows what only we can do), a photo, comments from both
  a person and an agent, and enough history that `changes_notes` has a feed.
- **A listing is "a distribution multiplier, not a prerequisite."** The same account ran as a
  custom connector while waiting. That is exactly the button above.

## The reusable checklist

For kanninja and anything after it. Ordered by lead time, longest first.

1. **Open the account gates now.** Claude Team org with an Owner who can reach the submission
   portal; OpenAI identity verification for the publishing name. Weeks, not days, and nothing
   else can finish without them.
2. **Annotate every tool.** `title`, plus `readOnlyHint` or `destructiveHint`, plus
   `openWorldHint` where it touches an external system. Assume this is checked mechanically,
   because it is.
3. **Read your descriptions as a reviewer.** Anything of the form "prefer this over X", "always
   do Y", "use this first" is steering. State what the tool does. Let annotations carry safety.
4. **Split read from write.** No tool takes a `method`. Split writes further by action where
   the domain allows.
5. **Make errors specific.** Every tool returns something useful for valid input, and something
   actionable for invalid input. Generic 500s fail review.
6. **Populate a demo account and write down how to reset it.** A reviewer who has never seen the
   product runs every tool from it. An empty account is a rejection.
7. **Audit user-facing copy for protocol words.** MCP, OAuth, endpoint, server, token. If a buyer
   would not say it, do not print it.
8. **Check the prohibited list against your monetisation** *before* designing the upgrade path.
   OpenAI's ban on promoting upgrades in-app is the one that surprises people.
9. **Write the public doc page.** Required by publish date on Anthropic's side; a help-centre
   article is enough.
10. **Exercise every tool through MCP Inspector and as a custom connector** before submitting.
    Both directories ask you to confirm you did.

kanninja's 42 tools make step 2 forty-two pieces of work and step 3 a genuine audit. Start it
early, and note that a large surface is itself a review risk in a way eleven tools is not.

## Sources

- [Anthropic Software Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy) — the binding text; supersedes the old MCP directory policy, consolidated 2026-04-15
- [Submitting to the Connectors Directory](https://claude.com/docs/connectors/building/submission) — portal steps, asset specs, prerequisites
- [Pre-submission checklist](https://claude.com/docs/connectors/building/review-criteria) — what reviewers actually test
- [Connectors directory](https://claude.com/docs/connectors/directory) — how the catalog and Suggested Connectors work
- [OpenAI app submission guidelines](https://developers.openai.com/apps-sdk/app-submission-guidelines) — requirements, prohibited categories, rejection reasons
- [Submitting apps to the ChatGPT app directory](https://help.openai.com/en/articles/20001040) — process
- [MCP Apps](https://claude.com/docs/connectors/building/mcp-apps/getting-started) — interactive UI, later material
- [Directory vs custom connectors](https://claude.com/docs/connectors/building/directory-vs-custom) — where the prefilled install link is documented
- [How to submit your MCP server to Anthropic's connector directory](https://dev.to/qrflows/how-to-submit-your-mcp-server-to-anthropics-connector-directory-from-someone-who-did-it-143m) — first-hand account; the source for the practitioner section
- [ChatGPT Developer mode](https://developers.openai.com/api/docs/guides/developer-mode) and [Test your integration](https://developers.openai.com/apps-sdk/deploy/testing) — why there is no ChatGPT button
- [Get started with the Team plan](https://support.claude.com/en/articles/9267247-get-started-with-the-team-plan) — the org, the business-email rule, and what migrating costs
