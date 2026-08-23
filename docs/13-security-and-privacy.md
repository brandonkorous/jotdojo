# 13 — Security and privacy

## What makes this different from a normal CRUD app

Two things, and both come from agents:

1. **Note content is untrusted input that gets fed to a language model.** A note can contain text engineered to hijack the agent reading it. This is not theoretical — the GitHub MCP incident of May 2025 saw a malicious issue in a public repository hijack an agent into pulling private repository data and leaking it through a public pull request.
2. **Spaces are shared.** In a family or team space, one member's captured content reaches another member's agent. If someone photographs a page with hostile text on it, that text is now in a space we hand to somebody else's Claude.

Everything below follows from those two facts.

## Threat model

| Threat | Control |
|---|---|
| Prompt injection via note content | We cannot stop it. We refuse to amplify it: tool descriptions and error strings are static, never interpolated from user content. Agent writes are non-destructive and reviewable |
| Confused deputy — agent acts with server privilege | Every MCP call executes with the **granting user's** authority. Workers are the only cross-space component and are unreachable from MCP |
| Token replay against a sibling service | RFC 8707 resource indicators, audience-bound tokens. A Jotacular token must not work at kanninja |
| Leaked capture token | Scope is `capture:write` on one space. Cannot read, list, or search. Blast radius is "a stranger can add notes" |
| Over-broad agent grant | Per client, per space. Consent screen defaults to personal space only, never pre-selects a shared space |
| Agent silently destroying content | **Impossible: no MCP tool can replace a note's content** (ADR-070). Comment by default; every agent write adds a revision; review inbox; soft delete only |
| Application bug crossing tenants | Postgres RLS keyed to space membership. A bug becomes an error, not a leak |
| SSRF via Client ID Metadata Document fetch | Scheme allowlist, private-range blocking, size and time caps, aggressive caching |
| Runaway agent burning money | Per-client rate limits, not just per-user |
| Anonymous-space abuse | Hard caps, no recognition until claimed, per-IP limits, 30-day expiry |

## Non-negotiable rules

1. **Agent authority is always derived from a user.** An agent can never reach a space its granting user cannot, and never holds rights the user does not.
2. **Nothing an agent does is irreversible.** Soft delete only. Every mutation writes `note_revisions`.
3. **Every MCP tool call is audited.** One row, always, including reads.
4. **No secrets in images or environment variables.** Key Vault via CSI driver with Workload Identity.
5. **Raw artifacts are never proxied through the API.** SAS URLs, short-lived, scoped to one blob.
6. **The `-content` contrast gate is a security-adjacent control**, because the agent-ink distinction must remain legible. See [10-design-system.md](10-design-system.md).

## Data handling

**What we store:** notes and their raw artifacts, account identity from Google (`sub`, email, name, avatar URL), space membership, agent grants, and the audit log.

**What we do not store:** payment card details (Stripe holds those), Google credentials or refresh tokens beyond the sign-in exchange, any biometric or location data.

**Third parties that see note content:**
- The recognition provider. As of 2026-08-22 this is **Azure OpenAI** in `eastus2`: `whisper` for audio, `gpt-4o-mini` for handwriting and photographed pages (ADR-051).
- The embedding provider — **Azure OpenAI** `text-embedding-3-small`, same account.
- The triage provider — **Azure OpenAI** `gpt-4o-mini`, same account — **only for spaces where an owner has switched the triage agent on** (ADR-048). It is off by default, it is the only thing here that sends a note to a model without somebody asking, and switching it off stops it immediately — including work already queued.
- Nobody else.

Choose providers that contractually exclude training on our data, and **say who they are on the privacy page**. Our users are handing us the thing their business starts on; opacity here is not survivable.

**Retention:**

| Data | Kept |
|---|---|
| Notes and artifacts | Until deleted by the user |
| Deleted notes | 30 days in soft-delete, then purged |
| Anonymous spaces | 30 days if unclaimed |
| Audit log | 12 months |
| Revisions | Lifetime of the note |

**Deletion means deletion.** Deleting a space purges its blobs, not just its rows. This must be a tested job, not an intention.

**Export** is available from day one: a zip of markdown files plus original artifacts. Markdown as the native format makes this credible rather than a checkbox — and a product people can leave is a product people trust enough to join.

Built as of 2026-08-22 (ADR-067), and it was a false claim on a live page until then. `GET /export/space/<id>` is the archive this paragraph describes, linked from the account page; `GET /export/note/<id>?format=md|svg|png|zip` is one note. Handwriting exports as SVG — the strokes themselves, not a picture of them — so what leaves is what a better recognizer could still be run over. Where an archive hits its size ceiling its `README.txt` names every file left out, because a silent truncation is this same failure one layer down.

## What we promise users

Plainly, on a page anyone can read:

- Your notes are yours. Export everything, any time, in a format that opens anywhere.
- Agents only see what you grant, per space, per client, and you can revoke instantly.
- You can see every action an agent has taken.
- We do not train on your notes, and we say which providers process them.
- Nothing an agent does to your notes is permanent.
- Nothing reads your notes on a schedule unless you switched it on, and off takes effect at once.

## What we do not promise

Being honest here protects us. **We are not built for regulated data.** No HIPAA, no BAA, no SOC 2, no data residency guarantees, no SSO. If someone asks, the answer is a clear no and a recommendation to look elsewhere — not a roadmap promise.

Handwritten and voice notes pass through third-party recognition services, which is a real disclosure and belongs in the privacy page, not buried in terms.

## Operational security

- Dependabot or Renovate on, with a weekly cadence.
- Secrets scanning in CI. A leaked capture token in a commit is a plausible early incident.
- Postgres backups tested by actually restoring, quarterly, not merely configured.
- One dashboard: recognition queue depth, MCP tool-call rate per client, auth failure rate, capture endpoint p99. If the capture endpoint p99 crosses 500ms, that is a page.
- An incident means telling users what happened, plainly, quickly. We will not be judged for having one; we will be judged for hiding it.
