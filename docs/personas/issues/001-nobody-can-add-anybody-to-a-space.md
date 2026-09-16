# 001 — A family can pay for six people and there is nowhere to add the other five

**Status:** open
**Severity:** blocker
**Found by:** discovery, before any run · 2026-09-16
**Surface:** app › everywhere. There is no screen for this at all
**Filed:** 2026-09-16
**Fixed:** —
**Confirmed by:** —
**Blocked on:** scope

This one is filed before a run because it was found by enumerating the product's
axes of variance, and it removes two of them. P05 and P06 will hit it as their
first act, and the point of filing it now is that they should not have to discover
it as a surprise.

## What happened

Jotacular sells four plans. Two of them are sold on **how many people they hold**:

> **Family** · $9/mo · up to 6 · "Solo, pooled across the house, shared spaces"
> **Team** · $19/mo · up to 25 · "Family, shared spaces, triage agent"

There is **no screen anywhere in the app** that lets anybody:

- create a second space
- create a family or team space
- invite a person
- see who is in a space
- accept an invite
- change somebody's role
- remove somebody
- see how many of their seats are used

The domain layer has all of it. `packages/domain/src/members.ts` exports
`createSpace`, `inviteToSpace`, `listInvites`, `revokeInvite`, `acceptInvite`,
`listMembers`, `setMemberRole`, `removeMember` and `spaceUsage`.

**Every single caller of every one of those functions is a smoke script.** Nothing
in `apps/web`, `apps/api` or `apps/mcp` calls any of them.

The suites are green. `pnpm members:smoke` is 29 checks and `pnpm seats:smoke` is
29 more, and between them they prove invites, roles, seat counting at invite time
and again at accept time, and pending invites holding a seat. All of it works. None
of it is reachable.

## What should have happened

A person who pays $9 for "up to 6" can add five people. That is the entire
difference between Family and Solo, and it is the only thing they are buying.

[docs/01-audience-and-pricing.md](../../01-audience-and-pricing.md) states the
seat limits as enforced — "Seat counts ARE enforced (ADR-112, migration 0036)" —
and they are. The limit is real. The door is missing.

## How to reproduce

1. Sign in at `http://localhost:3400` as any account.
2. Open `/account`. Read every section: Toolbar position, Plan and usage, Triage
   agent, Connect to Claude, Connected agents, Capture tokens, Export, Sign out.
   None of them mentions people.
3. Open `/dashboard`. The Spaces section renders each space as a `badge`. It is not
   a link, there is no "new space" control, and there is nothing to click.
4. Open the ⌘K palette on the canvas. It offers notes, "Dashboard", and "Account
   and capture tokens". Nothing else.
5. Search the whole web app for the words "invite" or "member":
   `grep -rn "invite\|member" apps/web/app apps/web/components`. Every hit is a
   comment or an unrelated word.

Every time. It is not a state, it is an absence.

## Why it matters

**Wrong money.** Billing went live at the last deploy (ADR-114, ADR-049). A Family
or Team subscription can be bought today, from the checkout on the account page,
and it grants the buyer nothing they did not already have on Solo. That is money
taken for a capability the product cannot deliver.

**A sentence on the marketing site is false.** `/pricing` sells members and shared
spaces. `apps/web/components/site/*` sells shared spaces. Under RULE #3, false copy
is a `major` on its own; here it sits on top of the money.

**It removes a whole axis from this exercise.** The role axis — owner versus member
— cannot be walked by any persona, so nothing in this roster ever sees the product
through a second person's eyes. Presence, live updates, comments from another human
and "who else is here" are all built and all unreachable in the same way, because
they need a second person in a space.

## Where it lives

- `packages/domain/src/members.ts` — the whole feature, with no product caller
- `packages/db/migrations/0003_provision_user.sql:44` — the one space anybody ever
  gets, named `Personal`
- `packages/db/migrations/0000_init.sql:77` — `kind IN ('personal','family','team')`.
  Nothing in the product can ever produce `family` or `team`
- `apps/web/app/dashboard/page.tsx` — renders space names as badges and stops
- `apps/web/app/account/page.tsx` — the eight sections, none about people

## The fix

Not attempted. `Blocked on: scope` — this is a screen that does not exist, not a
repair to one that does, and it needs a decision from Brandon first:

**Option A — a Members section on `/account`.** Cheapest. Lists the spaces you own,
their seat usage from `spaceUsage`, the members from `listMembers`, and an invite
form. Fits the page's existing shape. Does not solve creating a family space.

**Option B — a space screen at `/s/[id]`.** Members, seats, role changes, invites
and rename in one place, linked from the dashboard badges (which become links) and
from the ⌘K palette. More work, and it gives spaces a home, which they currently do
not have.

**Either way, invites need a delivery mechanism and there is none.** This repo has
no mail library in any `package.json` and no send path anywhere. `inviteToSpace`
writes a token row and nothing else happens. So an invite has to be a **copyable
link the owner sends themselves** (which suits a family — they are in the same
house), or email has to be built. That is the second decision.

Issue 003 covers the space name, which Option B would fold in.

## One consequence removed — 2026-09-16

Issue 007 found that a missing space switcher was not only a missing feature: it
was stranding people's first thought, because claiming a jot silently gave them a
second space and nothing could open it. Migration `0037_one_space_not_two.sql`
stopped the second space being created.

**This issue is unchanged.** Nobody can still create a space, invite anybody, see a
member list, or accept an invite, and Family and Team are still sold on a number of
people that cannot be reached. What has gone is the accident where a person ended
up owning something they could not see.

## Confirmed by

—

## Rating effect

None yet. When this is built, the new screens are new rows in
[rating.md](../rating.md) and the denominator moves — regenerate it with
`node scripts/persona-screens.mjs` rather than adding rows by hand.
