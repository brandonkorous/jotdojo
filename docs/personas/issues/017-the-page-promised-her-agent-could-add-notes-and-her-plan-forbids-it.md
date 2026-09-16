# 017 — The page promised her agent could add notes, and her plan forbids it

**Status:** fixed
**Severity:** major
**Found by:** P01 Marisol · act 7 · 2026-09-16
**Surface:** app › Account › Let an assistant read your notes
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P01 Marisol · act 7 · 2026-09-16
**Blocked on:** —

## What happened

Marisol scrolled to **Let an assistant read your notes** to connect Claude. The
paragraph under the heading said:

> Then you can ask it what the vet said, what the quote was, or what you wrote down
> on Tuesday — without opening Jotacular at all. **It can add to your notes and
> leave comments.** It can never change or delete what you wrote.

Two of those three sentences are false for her.

Her space is on `free`. Read from the database at the moment she read the page:

```
SELECT plan FROM spaces WHERE id = '739e5257-...';
free
```

And `assertAgentMayWrite` refuses every write an agent attempts on `free` or `anon`:

```ts
const READ_ONLY = new Set(["free", "anon"]);
...
throw new PlanRequired(
  "This space is on the free plan, where an agent can read but not write",
);
```

It guards four call sites — creating a note, replacing one, appending to one
(`notes.ts`), and leaving a comment (`comments.ts`). **So "it can add to your notes"
is refused and "leave comments" is refused.** Only the third sentence held.

## What should have happened

The page says what her agent can actually do.

## Why it matters

**It is a promise in copy that the server refuses**, which the rulebook names as its
own failure shape, and it is made at the exact moment somebody decides to connect an
assistant — the moment this whole product is sold on.

**It contradicts itself two sections up its own page.** `What you are on` shows
`Personal · free · 2 of 100 read this month` in the same scroll. A person reading
top to bottom is told they are on free, and then told their agent can write.

**It sets up a broken act 9.** P01's act 9 exists to judge the refusal her agent gets
when it tries to add a note. That refusal was always going to read as a bug rather
than a rule, because the page that talked her into connecting had said the opposite.

It is `major` rather than `blocker` because nothing is lost and no money changes
hands on this sentence — but it is the single most misleading sentence found in this
run so far.

## Where it lives

- `apps/web/components/ConnectToClaude.tsx:24-27` — the paragraph
- `packages/domain/src/plans.ts` — `READ_ONLY`, the fence it contradicted
- `apps/web/app/account/page.tsx:71` — where the section is rendered

## The fix

The fence got a name, so a screen can describe it instead of guessing:

```ts
/** Whether an agent may write in a space on this plan. Exported so a screen can
 *  describe the fence rather than guess at it, and so both answers come from
 *  the same set. Issue 017. */
export const agentMayWrite = (plan: string): boolean => !READ_ONLY.has(plan);
```

The account page passes the answer down — `mayWrite={plans.some((p) => agentMayWrite(p.plan))}` — and the paragraph
branches:

> **On your plan it can only read.** It can never change or delete what you wrote,
> and adding a note or a comment comes with a paid plan.

Three things about that wording are deliberate:

- **"On your plan"**, not "on the free plan". It is about her, and it stays correct
  if she is on Solo, which is also read-only for agents today.
- **It names the upgrade without selling it.** She is two sections away from the
  prices and does not need them repeated here.
- **The true sentence survives.** *"It can never change or delete what you wrote"* is
  the reassurance that makes people connect an assistant at all, and it is still
  the first thing after the fence.

`agentMayWrite` is derived from the same `READ_ONLY` set the server enforces, so the
sentence cannot drift from the rule — which is how it drifted in the first place.

## Confirmed by

**P01 Marisol, act 7, 2026-09-16.** Read from the live page at 360px, signed in as
her, on her free space:

> Then you can ask it what the vet said, what the quote was, or what you wrote down
> on Tuesday — without opening Jotacular at all. On your plan it can only read. It
> can never change or delete what you wrote, and adding a note or a comment comes
> with a paid plan.

The paid branch is **reasoned, not measured** — no space in this run is on a paid
plan. It is the string that was already there, moved behind a condition.

## Rating effect

`Account › Connect to Claude` is scored in act 7. Without this fix its Ease would
have been a 4: the screen worked perfectly and told her something untrue about what
she was about to get.
