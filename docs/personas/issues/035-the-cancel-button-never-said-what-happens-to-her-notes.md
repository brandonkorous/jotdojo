# 035 — The cancel button never said what happens to her notes

**Status:** fixed
**Severity:** minor
**Found by:** P08 Ruth · act 7 · 2026-09-16
**Surface:** app › Account › What you are on
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P08 Ruth · act 7 · 2026-09-16
**Blocked on:** —

## What happened

Ruth has two years of notes and is deciding whether to keep paying. She went to
cancel. The whole of what the product told her:

> **Change plan or cancel**
> Switching plans and cancelling both happen here.

That is a button to a payment portal and a sentence about where the button goes.
**Nothing anywhere says what happens to her notes.**

For a person cancelling a notes app after two years, that is the only question. Not
the proration, not the renewal date — *do I lose what I wrote?*

## What actually happens, measured

Cancelling is handled properly. Before and after the cancel webhook, on her space:

| | Before | After |
| --- | --- | --- |
| plan | `solo` | **`free`** |
| allowance | 1,000 | **100** |
| **notes** | **1** | **1** |

**Nothing is deleted.** The space drops to free, the allowance drops with it, the
export section is still there, and the Connect-to-Claude copy flips back to the free
wording by itself. The behaviour is exactly right.

**So the product does the reassuring thing and does not say it** — at the one moment
somebody is most afraid, on the one screen where they are deciding.

## Why it matters

`minor` — nothing is lost and nothing is wrong. It is filed because of *where* the
silence is.

The marketing site makes this promise in as many words:

> **Your notes are yours.** Export every one of them, any time, as markdown that
> opens anywhere. **Leaving is a supported operation, not a support ticket.**

And the account page's own export section says *"Nothing is deleted by exporting
it."* So the sentence exists, twice, in places she is not standing. The place she is
standing sends her to a payment provider, which cannot answer a question about her
data and will not try.

It is the mirror of the other findings in this run: elsewhere the product said
something untrue (017, 027, 030); here it says nothing where the true thing would
help most.

## The fix

One clause, next to the button:

```tsx
{/* The second sentence is the one somebody cancelling actually
    wants, and this button hands them to a payment portal that
    cannot answer it. Measured: cancelling drops the plan to
    free and deletes nothing. Issue 035. */}
<span className="text-sm opacity-50">
  Switching plans and cancelling both happen here.
  {" "}Your notes stay either way — nothing is deleted by cancelling.
</span>
```

**"either way"** is doing the work: it covers a downgrade as well as a cancel, which
is the other thing she was about to do and the other thing nobody told her about.

## Confirmed by

**P08 Ruth, act 7, 2026-09-16.** Read from the live account page on a paid space:

> Switching plans and cancelling both happen here. **Your notes stay either way —
> nothing is deleted by cancelling.**

## What else act 7 and act 8 measured, all passing

The transition machinery is the best-behaved part of the product found in this run:

| | |
| --- | --- |
| Solo → Family | plan, **seats 1 → 6**, allowance 1,000 → 2,000 |
| Family → Solo, same day | plan, **seats 6 → 1**, allowance 2,000 → 1,000 — it goes back down |
| Cancel | → `free`, allowance → 100, **notes untouched** |
| After the fall | triage returns to `part of the Team plan · Off`; the agent copy flips back to *"On your plan it can only read"*; export unchanged; nothing hidden |

That last row is the **third** independent measurement of issue 017's fix — free,
then paid, then back to free — and it tracked the plan correctly every time.

## Rating effect

`Account › Plan and usage` — the Design and Ease scores on its row already carry
issues 032 and 033. This is the third thing on that screen, and the only one of the
three that was a silence rather than a wrong number.
