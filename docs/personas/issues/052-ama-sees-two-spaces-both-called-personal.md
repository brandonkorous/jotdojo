# 052 — Ama joins the house and sees two spaces, both called Personal

**Status:** fixed
**Severity:** major
**Found by:** P05 · Kwabena Ballantyne-Osei · act 5 (the guest's end)
**Surface:** app › Dashboard › Spaces
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** Ama, on her dashboard · 2026-09-16
**Blocked on:** —

## What happened

Kwabena invited his wife Ama to the space he pays for. She opened the link, was
let in, and landed on the dashboard. This is her whole Spaces list:

```
Spaces
  Personal
  Personal
```

One of those is hers. The other is his, the one with the boiler cover and Grace's
dose in it. **Nothing on the screen says which is which** — no owner, no role, no
badge, no order she could rely on.

In the database they are as different as two rows get:

```
01787c97…  Personal  personal  family  owner p05.kwabena@jotacular.test   she is member
37139aad…  Personal  personal  free    owner ama.ballantyne-osei@…        she is owner
```

## What should have happened

A space she was let into should say whose it is. She came here to read what her
husband wrote; the one thing she needs is to tell his from hers.

## How to reproduce

Every time, and it needs two people — which is why it has never been seen.

1. Owner A (space still called `Personal`) puts their space on a paid plan.
2. A invites B and B accepts.
3. B opens `/dashboard`. Two entries, both reading `Personal`.

## Why it matters

**This is the moment the product is sold on.** P05 exists to buy Family so other
people can read what he wrote, and the first screen the other person sees cannot
tell them which notebook is his.

It is also the half of issue [003](003-every-space-is-called-personal.md) that
003's fix cannot reach. 003 gave the **owner** a rename control, and that is right
— but neither person here will use it. Ama cannot rename his (she is not the
owner, and [SpaceName.tsx:19](../../../apps/web/components/SpaceName.tsx#L19)
correctly renders a plain badge for her). Kwabena has no reason to rename his own
personal space: to him it IS Personal, and the app chose the name.

**Nobody is doing anything wrong and the screen is still unusable.** That is the
shape — *absence behaves like fine*: two correct rows render identically.

## Where it lives

- [dashboard/page.tsx:31-35](../../../apps/web/app/dashboard/page.tsx#L31-L35) —
  renders `SpaceName` with `id`, `name` and `owner`. It already knows she is not
  the owner and shows nothing extra.
- [SpaceName.tsx:19](../../../apps/web/components/SpaceName.tsx#L19) —
  `if (!owner) return <span className="badge badge-neutral">{value}</span>`.
- `listSpaces` in [spaces.ts](../../../packages/domain/src/spaces.ts) returns
  `{ id, name, kind, role }`. **There is no owner on it**, so the screen could not
  say whose it is even if it wanted to. That is the real gap.

## The fix

**The owner travels with the name**, and only when there is somebody to name.

`SpaceSummary` gains `ownedBy: string | null` — the owner's display name, or their
address if they have no name, and **null when you are the owner yourself**, because
there is nothing to tell yourself. `listSpaces` fills it from the `space_members`
row holding `role = 'owner'`, earliest joined, rather than from `spaces.created_by`:
ownership can be handed over with `setMemberRole`, and the person who made a space
is not always the person who owns it.

`SpaceName` then renders it beside the badge on the not-owner branch that was
already there. The owner's branch — the in-place rename from issue 003 — is
untouched.

**RLS did not need widening.** `users_read` from migration 0002 already says *"read
yourself, and anyone who shares a space with you"*, so a member can read their
owner's name and a stranger still cannot.

**The sibling check was made and it was WRONG, and P06 found that out an hour
later.** The first pass said Account's people section was safe *"because it already
prints every member by name"*. It does — but the **section headings** are the
space names, and Sowande's Account showed two sections both headed `Personal`:

```
Personal              3 of 25 seats taken      <- Fenn's
  p06.fenn   owner
  sowande    member
Personal              1 of 1 seat taken        <- his own
  sowande    owner
```

The member list underneath does distinguish them. The heading a person reads first
does not, which is the same defect one component across. `peopleBySpace` now passes
`ownedBy` through and `SpacePeople` prints it beside the heading.

**This is the shape the rulebook names — "a fix leaves its neighbour behind" — and
it was written into this issue as *checked* before it was true.** The remaining
callers were re-checked properly: `plans-view` filters to `role === "owner"` so it
can only ever show your own; `/oauth/authorize` lists spaces to grant an agent, all
of which you can reach; `oauth-grant` uses ids only; and the MCP `list_spaces` tool
returns the field to the agent untouched.

## Confirmed by

**2026-09-16**, driven as Ama Ballantyne-Osei on her own dashboard after accepting
Kwabena's invite.

```
before        Spaces          after         Spaces
              Personal                      Personal   p05.kwabena’s
              Personal                      Personal
```

Hers carries nothing, because she owns it. His says whose it is.

**And again on Account, as Sowande** after P06 found the heading:

```
before    Personal   3 of 25 seats taken      after    Personal  p06.fenn’s  3 of 25 seats taken
          Personal   1 of 1 seat taken                 Personal              1 of 1 seat taken
```

**Kwabena's own dashboard is unchanged** — he owns both of his, so neither is
tagged, and the page has no apostrophe-s on it at all.

Measured on the same screen:

| | |
| --- | --- |
| light | **7.04** |
| dark | **6.64** |
| 360px | no horizontal scroll, 0 elements past the edge |

`invite:smoke` carries it now too, 19 of 19 — a guest's shared space names its
owner, a guest's own space names nobody, and an owner is told about none of theirs.

## Rating effect

`Dashboard — Ease 7 → 8`. Recorded in [rating.md](../rating.md).
