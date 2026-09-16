# 007 — Her idea vanished the second time she opened the app

**Status:** fixed
**Severity:** blocker
**Found by:** P01 · Marisol Okonkwo-Vance · act 4
**Surface:** app › The canvas · app › Dashboard
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** re-ran P01 act 4 as Marisol — see below
**Blocked on:** —

## What happened

Marisol jotted her idea on the apex, signed in to keep it, and landed on it. That
part works (issue 006).

She came back, signed in, and opened the app. **The canvas was blank.** No note, no
text, nothing — the same empty surface a brand-new account sees.

She opened the Dashboard looking for it. Under **Spaces** it shows two badges,
`Personal` and `From the web`, neither of which is a link. Under **History** there
is one entry:

> **Untitled**
> 9/16/2026, 2:14:44 AM

That "Untitled" is an empty note the app created for her when she opened the blank
canvas. Her actual idea is not on the screen anywhere.

Confirmed in the database — the thought is not deleted, it is stranded:

| Space | Created | Notes |
| --- | --- | --- |
| `From the web` | 09:04:53 | 1 — `route planner should assume the walker knows the roads…` |
| `Personal` | 09:05:59 | 1 — the empty Untitled the blank canvas made |

## What should have happened

She opens the app and her thought is there. It is the only thing she has ever
written in this product and it is the reason she made an account.

## How to reproduce

1. Signed out, jot something into the hero on the apex, tap **Keep this**.
2. Sign in as a brand-new account. You land on the note — correct.
3. Sign out. Sign in again, or just open `http://localhost:3400/`.
4. The canvas is blank.

Every time, for every account created through the hero.

## Why it matters

**It is the one thing this product promises never to happen.** docs/00 puts it
first: close the gap between having the thought and the thought being useful.
docs/01 calls losing a thought "the one unforgivable failure".

The thought is not deleted, so this is recoverable — but she cannot know that.
There is no space switcher anywhere in the product (issue 001), so from inside the
app the note is **unreachable**. An empty canvas and a lost note look exactly the
same, which is the failure mode that costs a customer.

It is filed as `blocker` on those grounds: from the person's side, the thought is
gone.

## Where it lives

Two things combine, and the second is the dangerous one.

**1. A person who jots before signing up ends up with two `personal` spaces.**
`app_claim_anon_space` (migration `0018_anon_shadow_user.sql`) turns the anonymous
space into a real one — `kind = 'personal'`, named `From the web`. Provisioning
(`0003_provision_user.sql`) separately creates a space called `Personal`. Nothing
merges them.

**2. `defaultSpaceId` picks between them arbitrarily.**

```ts
// packages/domain/src/spaces.ts
const personal = all.find((s) => s.kind === "personal") ?? all[0];
```

and `listSpaces` has **no `ORDER BY` at all** — it is a plain select with a join.
Postgres is free to return those two rows in either order, and to return them in a
different order on a later query.

So "which space is my home" is not merely wrong, it is **unstable**. Two visits can
legitimately land on two different spaces.

## The fix

`packages/domain/src/spaces.ts`, in two small parts, no migration needed:

- **`listSpaces` now orders by `created_at` ascending.** A query whose result
  order decides which space is somebody's home cannot be unordered. This is the
  part that matters: it removes the instability, not just the wrong answer.
- **`defaultSpaceId` keeps taking the first personal space**, which now means
  *the personal space they have had longest*. For anyone who jotted on the apex
  before signing up, that is the space their first thought is in — it was created
  the moment they started typing, a minute before the provisioned `Personal`.

Fixed at `listSpaces` rather than inside `defaultSpaceId` because every other
caller was reading the same unordered list: the Dashboard's Spaces badges, the
space pickers on Account › Capture tokens and Account › Export. All four now agree
on an order.

**That was the first half.** It made her thought reachable but left her owning a
second, empty space that no screen can open. Brandon asked for the root cause, so
it was then fixed properly.

### The root cause — migration `0037_one_space_not_two.sql`

Claiming a jot no longer leaves anybody with two personal spaces.

**Three parts, because deleting a space turned out to be impossible.**

1. **`app_guard_last_owner` now lets a space be deleted.** Every foreign key into
   `spaces` is `ON DELETE CASCADE`, so dropping a space removes its
   `space_members` rows — and the last-owner guard from 0014 fired on each one
   and refused, because the space was indeed about to lose its last owner. The
   guard exists so a space that must keep working keeps an administrator; a space
   that no longer exists does not need one. It now returns early when the parent
   row is already gone, which is exactly what a cascade looks like from inside the
   trigger.

2. **`app_space_is_untouched(space)` defines "never used", and it had to be
   written carefully.** Opening the canvas writes rows by itself — an empty note
   (ADR-008: the cursor is live with zero clicks) and an ink layer holding
   `"strokes": []`. So "this space has rows in it" is not the same as "somebody
   used this space". Untouched means: no block with a non-empty body, no photo or
   audio, no ink layer with an actual stroke in it, no capture token, no comment,
   and exactly one member.

3. **`app_claim_anon_space` absorbs.** After adopting the anonymous space it looks
   for a personal space the user has never touched, deletes it, and renames the
   survivor to `Personal` — because it is now their only space and should be
   called what everybody else's is called, not where it happened to come from.
   That also retires the worst instance of issue 003.

**And the people already split.** 61 accounts in this database were carrying the
second space, including every persona account created so far. The migration ends
with a one-off pass applying the same rule. **60 were repaired. One was correctly
left alone** — `loopback-check@example.test`, whose `Personal` space holds eight
real ink and photo assets from earlier work, so it is genuinely used. That is the
guard doing its job rather than failing quietly, and it is the reason "untouched"
was defined by content rather than by row count.

## Confirmed by

> Re-ran P01 act 4 as Marisol. Signed in as `p01.marisol@jotacular.test` and opened
> `http://localhost:3400/`. The canvas shows
> **"route planner should assume the walker knows the roads better than the map
> does"** — her own words, the note she wrote before she had an account. Seen in a
> screenshot, by eye.
>
> Then fetched `/` three times in a row and checked the rendered HTML each time:
> note present, note present, note present. The instability is gone, not masked.

**Then re-proved again after the migration, with another brand-new account.**

> Signed out. Jotted "one space not two — she should land on this and have nothing
> else" into the hero on the apex, tapped **Keep this**, signed in as
> `p01.onespace@jotacular.test`. Landed on the note.
>
> Opened the Dashboard. Under **Spaces**: one badge, `Personal`. Under **History**:
> her note, with its preview and date. Nothing else. Seen in a screenshot, by eye.
>
> In the data: one row. `Personal` · `personal` · 1 note.

**Regression check.** Ten smoke suites re-run after the migration, all green:
`db:smoke` (the RLS tenancy boundary), `anon:smoke`, `members:smoke`, `seats:smoke`,
`search:smoke`, `export:smoke`, `billing:smoke`, `triage:smoke`, `live:smoke`,
`comments:smoke`.

**What was run, and where.** `pnpm db:migrate` against the local dev Postgres in
the `jotacular-postgres` container. The runner applies each migration inside a
transaction, so a failure would have rolled back untouched. The migration has not
been run anywhere else.

## Rating effect

`app › The canvas` and `app › Dashboard` are scored post-fix in
[rating.md](../rating.md).
