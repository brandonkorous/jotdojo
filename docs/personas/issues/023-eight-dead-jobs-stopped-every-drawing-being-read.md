# 023 — Eight dead jobs stopped every drawing on this database being read

**Status:** fixed
**Severity:** blocker
**Found by:** P01 Marisol · act 10 · 2026-09-16
**Surface:** worker › structural reads (`block.structure`)
**Filed:** 2026-09-16
**Fixed:** 2026-09-16 — `0038_a_dead_job_must_not_hold_the_queue.sql`, run by Brandon's grant
**Confirmed by:** 2026-09-16
**Blocked on:** —

## What happened

`pnpm structure:smoke` failed eight checks, starting at the first one:

```
the pipeline
  FAIL  drawing queued a structural read, and the worker got to it
          gave up after 25 cycles with the queue still non-empty
```

The suite is not flaky and its own comment predicted this shape:

> *The queue is shared, so a previous run of this suite — or anything else that
> drew — leaves jobs in front of ours [...] a test that depends on nobody having
> gone first is a test that fails for a reason it does not name.*

It named it this time. **The structure queue on this database is dead**, and had
been for hours before the suite noticed.

## What is actually wrong

`app_claim_structure_jobs` picks the oldest due jobs in a CTE, then JOINs them to
`blocks` and `media_assets` to fetch the strokes:

```sql
UPDATE outbox o
   SET attempts = o.attempts + 1
  FROM claimed c
  JOIN blocks b ON b.id = (... payload ->> 'blockId' ...)
  JOIN media_assets a ON a.id = b.artifact_id
 WHERE o.id = c.id AND b.kind = 'ink'
RETURNING o.id, b.id, b.space_id, a.strokes;
```

**A job whose block no longer exists matches nothing**, so the UPDATE touches no
row. It is not leased. `attempts` stays 0. `completed_at` stays null. `last_error`
stays null. And the very next call selects exactly the same rows again.

It is a head-of-line block, and it is total rather than partial: with `batch = 8`
and eight dead jobs at the front, **every claim returns zero**, and the worker reads
zero as "the queue is empty".

## The measurement

```
 pos | orphan | available_at
   1 | t      | 2026-09-16 00:48:47
   2 | t      | 2026-09-16 00:50:10
   3 | t      | 2026-09-16 07:10:40
   4 | t      | 2026-09-16 09:17:00
   5 | t      | 2026-09-16 09:25:29
   6 | t      | 2026-09-16 09:37:20
   7 | t      | 2026-09-16 09:53:20
   8 | t      | 2026-09-16 10:02:30
   9 | f      | 2026-09-16 10:12:08
  10 | f      | 2026-09-16 10:12:12
```

```
SELECT count(*) FROM app_claim_structure_jobs(8);
 0
```

**Eight dead, nineteen healthy behind them, zero claimed.** Of 27 pending jobs, 19
have a block and 8 do not.

## Why nothing noticed

This is the part worth keeping. Every signal a person would look at says fine:

- **no error** — `last_error` is null on all of them
- **no retries** — `attempts` is 0, so no backoff, no "failed six times and parked"
- **the worker is healthy** — it claims 0 and sleeps, which is what an empty queue
  looks like
- **queue depth is not a metric**, so 27 pending forever reads the same as 0

A feature stopped working and every dial stayed green. That is the same shape as
[jotdojo-green-signals-hide-db-outage] and as issues 001 and 013 — the product
cannot tell absence from health.

## Where the orphans came from here

**Migration 0037, which this exercise wrote.** Issue 007's fix deletes a spare
untouched personal space; every foreign key into `spaces` is `ON DELETE CASCADE`,
so the blocks went with it and the outbox rows pointing at them did not.

**That does not make this 0037's bug.** The queue has to survive a block being
deleted whatever deleted it, and the sibling queue already does. What 0037 did was
produce eight of them at once and make a latent defect visible.

## The proof it is not the metering fix

Issue 022 changed `applyInkDelta` in the same hour. It was ruled out by reverting
that one line and running the suite again: **the same eight checks failed**, with
the same message. The line was then restored.

## Where it lives

- `app_claim_structure_jobs` — created by the ADR-066 migration
- `app_claim_recognize_jobs` — **the same job, done correctly**

The recognition queue has never had this problem. It leases first, unconditionally,
and then completes whatever turns out to have nothing to read — and its comment
names the exact case structure forgot:

> *Nothing to read. Per kind: an ink page erased back to empty, or an image or
> audio block whose bytes never arrived. Plus, for every kind, a note that was
> deleted [...]*

Structure was written later and did not copy the lesson. *A fix leaves its
neighbour behind*, again, with the neighbour's comment describing the fix.

## The fix

**Written, not run:** `packages/db/migrations/0038_a_dead_job_must_not_hold_the_queue.sql`.

It gives structure the shape recognition already has:

1. **Lease first, unconditionally** — whether the page still exists is a question
   about the job, and a job has to be held before it can be asked anything.
2. **Complete the ones with nothing to read**, with `last_error` saying so, so a
   dead job is a fact somebody can find rather than a silence.
3. **Return what is left**, which is real work.

Plus a one-time `UPDATE` closing the jobs already stuck, because until those eight
are closed they hold the head of the queue whatever the code does.

`CREATE OR REPLACE FUNCTION`, so it is safe to run twice.

## Blocked on: pipeline

**This has not been run.** `docs/personas/CLAUDE.md` is explicit — *"Never run a
migration from a run. `pnpm db:migrate` is Brandon's. If a fix needs one, write the
migration file and mark the issue `Blocked on: pipeline`."* Migration 0037 ran only
because Brandon asked for that specific fix in those words.

    pnpm db:migrate

**Until it runs, `pnpm structure:smoke` stays red**, and it is red for this reason
rather than for a new one. Nothing else in the suite set is affected: twenty-four
other suites are green.

## Confirmed by

**2026-09-16.** Brandon stopped the dev server and granted the migration. It applied
as `0038_a_dead_job_must_not_hold_the_queue.sql`.

**It had grown since it was filed.** Measured immediately before running:

```
pending structure jobs      342
  dead, blocking the head    19
  healthy, stuck behind     323
app_claim_structure_jobs(8)   0 rows
```

Nineteen dead jobs were holding **three hundred and twenty-three** real ones. The
issue was filed at 8 and 19.

Immediately after:

```
closed as dead               19   last_error = 'the page this job was for no longer exists'
pending                     323
app_claim_structure_jobs(8)   8 rows
```

`pnpm structure:smoke` — **all good**, every check.

**The first run of it after the migration failed seven checks, and that was my
doing, not the product's.** Calling `app_claim_structure_jobs(8)` to verify the fix
leases those jobs for 120 seconds, so the smoke script's own job sat behind my lease
and its pipeline assertions had nothing to read. The lease expired and the next run
was clean. Verifying a queue by claiming from it changes the queue — worth knowing
before reading a red suite as a regression.

## Rating effect

None. No screen shows this, which is precisely the complaint.
