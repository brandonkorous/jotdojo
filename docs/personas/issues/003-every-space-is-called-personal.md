# 003 — Her space is called "Personal" and she cannot change it

**Status:** fixed
**Severity:** minor
**Found by:** discovery, before any run · 2026-09-16
**Surface:** app › Dashboard › Spaces · app › Account › Capture tokens · Account › Export
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** `rename:smoke`, 10 of 10 · 2026-09-16
**Blocked on:** —

## What happened

Every account gets exactly one space, and its name is decided by a database
function at provisioning time:

- signed up normally → the space is called **`Personal`**
  (`packages/db/migrations/0003_provision_user.sql:44`)
- came in through a hero jot and claimed it → **`From the web`**
  (`0017_anonymous_capture.sql:110`, `0018_anon_shadow_user.sql:91`)

There is no way to change it. Not in the app, and not in the domain layer either —
`packages/domain/src/spaces.ts` exports `listSpaces`, `defaultSpaceId`,
`assertMember`, `getToolbarSide` and `setToolbarSide`, and nothing that writes a
space name. The function does not exist to be called.

So the name shows up in three places and is meaningless in all three:

- `/dashboard` renders a Spaces section whose whole content is one badge reading
  `Personal`
- `/account` › Capture tokens asks which space a token belongs to, in a picker with
  one option called `Personal`
- `/account` › Export asks which space to export, the same way

## What should have happened

**space** is a first-class word in this product — the copy guide makes it the
required noun over workspace, team, org and vault, and the pricing page sells
"shared spaces". A noun the customer is taught and cannot use is a strange thing to
teach them.

A person who came in through the hero has a space called "From the web", which
describes how it was made rather than what is in it, and it is the only name they
will ever see.

## How to reproduce

1. Sign in as a new account at `http://localhost:3400`.
2. Open `/dashboard` from the ⌘K palette. Under Spaces there is one badge:
   `Personal`.
3. Look for a way to rename it. There is none on that screen, on `/account`, or in
   the palette.
4. Repeat starting from `http://jotacular.localhost:3400`: jot in the hero, claim
   it, and the badge reads `From the web`.

Every time.

## Why it matters

`minor` today, honestly: with one space per person the name carries no information
and nothing is lost by it being wrong. Somebody with one drawer does not label the
drawer.

**It becomes `major` the moment issue 001 is fixed.** A family with a House space,
a Kids' school space and a Holiday space needs to tell them apart, and the picker
on Capture tokens and on Export is the screen where that bites: three options all
called `Personal` is not a picker.

It is filed separately from 001 rather than inside it because a solo person also
wants to name their own space, and because the fix is small and independent.

## Where it lives

- `packages/db/migrations/0003_provision_user.sql:44` — `VALUES ('Personal', 'personal', v_user_id)`
- `packages/db/migrations/0017_anonymous_capture.sql:110` and
  `0018_anon_shadow_user.sql:91` — `name = 'From the web'` on claim
- `packages/domain/src/spaces.ts` — no write path for a space name
- `apps/web/app/dashboard/page.tsx` — the badge list
- `apps/web/components/CaptureTokens.tsx`, `apps/web/components/ExportSection.tsx` —
  the two pickers

**Do not edit those migrations.** They are a record of what ran (root CLAUDE.md).
The default name stays; what is missing is the rename.

## The fix

Not attempted. The shape:

1. `renameSpace(actor, spaceId, name)` in `packages/domain/src/spaces.ts`, guarded
   by `assertOwner` — which already exists in `members.ts`.
2. A place to call it. If issue 001 is taken as Option B, it belongs on the space
   screen. If 001 is still open, the dashboard badges are the cheapest home: make
   each one editable in place.
3. Trim on write and refuse an empty name, so nobody ends up with a blank badge.

No migration is needed — `spaces.name` is already a plain `text` column.

## Partly overtaken by 007 — 2026-09-16

Migration `0037_one_space_not_two.sql` (issue 007) removed the **`From the web`**
half of this. Somebody who jots on the apex and signs up now ends with one space
called `Personal`, the same as everybody else, rather than one named after how it
was made.

**What is left is the original complaint, unchanged:** every space is called
`Personal` and there is no way to rename it. Still `minor` while a person has one
space; still becomes `major` the day issue 001 gives them several.

The three screens that show the name — the Dashboard badge, Account › Capture
tokens, Account › Export — now show one honest badge instead of two, which is why
the Dashboard's Ease score moved.

## Confirmed by

—

## Rating effect

None yet. It will show up as the gap to 10 on `Dashboard`,
`Account › Capture tokens and the Shortcut` and `Account › Export` when a persona
first scores them.

---

## Fixed, 2026-09-16 — the rename exists, on the badge

Brandon took this off the blocked list. The shape is the one sketched above, and the
sketch was right on every point but one.

**1. `renameSpace(actor, spaceId, name)`** in `packages/domain/src/spaces.ts`, guarded
by the `assertOwner` that already existed in `members.ts`. It trims, collapses runs of
whitespace, caps at `MAX_SPACE_NAME = 60`, and refuses a blank.

**It names one column on purpose.** The owner UPDATE policy on `spaces` is row-scoped
and cannot name columns, so what stops a rename reaching `plan` is that the statement
does not mention it. See [048](048-the-column-grant-that-guards-plan-was-never-the-only-grant.md),
which this work turned up.

**2. The dashboard badges are editable in place** — `apps/web/components/SpaceName.tsx`.
Click the badge, it becomes an input; Enter or blur saves, Escape puts it back. **A
member who is not the owner gets the plain badge**, not a control that will refuse them.

**3. Trimmed on write, blank refused**, as the sketch asked.

### The one thing the sketch had wrong

> *No migration is needed — `spaces.name` is already a plain `text` column.*

The column being plain text is not the question; **whether the app role may UPDATE it
is**, and `0024_triage.sql` deliberately narrowed that grant to `triage_enabled`. So
this was checked before a line was written, against the live database rather than
against the migration:

```
grantee jotacular_app, UPDATE on spaces:
  created_at, created_by, id, kind, name, plan, triage_enabled, triage_last_run_at
```

`name` is there, so **the conclusion held and no migration was needed** — but for a
different reason than the one given, and the reason it holds is itself a defect. That
is [048](048-the-column-grant-that-guards-plan-was-never-the-only-grant.md).

## Confirmed by

**2026-09-16.** `pnpm rename:smoke`, a new suite — **10 of 10**:

```
ok    a new space starts as Personal
ok    the owner can rename it
ok    ...and the dashboard sees the new name
ok    whitespace is tidied, not stored              "  Ilé  Ifẹ̀   notes " -> "Ilé Ifẹ̀ notes"
ok    an accent survives the round trip
ok    a very long name is cut to the limit rather than refused
ok    a blank name is refused
ok    ...and the old name survives the refusal
ok    a stranger cannot rename a space they are not in
ok    ...and it is untouched
```

The last two are the standing isolation check: RLS scopes the row and `assertOwner`
scopes the role, and a stranger is refused by both.

Real data throughout, per RULE #2 — *The Okonkwo house* and *Ilé Ifẹ̀ notes*, with the
accents and the diacritic that a naive trim or a byte-counting cap would break.

## What this does NOT do

**It does not name a space at creation.** A new space is still called `Personal`, which
is right while a person has one — somebody with one drawer does not label the drawer.
The moment [001](001-nobody-can-add-anybody-to-a-space.md) gives them several, the
create flow will want a name field, and that belongs with 001.
