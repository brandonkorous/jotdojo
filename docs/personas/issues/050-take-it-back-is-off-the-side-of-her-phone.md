# 050 — On her phone, "Take it back" is off the side of the screen

**Status:** fixed
**Severity:** major
**Found by:** P01 · Marisol Okonkwo-Vance · act 3 (invite, at 360px)
**Surface:** app › Account › Who is in your spaces
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** 2026-09-16, Account at 360px
**Blocked on:** —

## What happened

Marisol invited `ifeoma.okonkwo.vance@okonkwohouse.test` from her phone. The
pending row appeared:

> ifeoma.okonkwo.vance@okonkwohouse.test — invited, not in yet

The **Take it back** button that belongs to that row is drawn at x=415 in a
viewport 341 wide. It is **74px past the right edge**, and the page scrolls
sideways to reach it.

She cannot undo an invite on a phone without noticing the sideways scroll first.

## What should have happened

The row should fit. Every other list on this page does.

## How to reproduce

Every time, with a realistic address.

1. On a 360px viewport, sign in as the owner of a space with a spare seat.
2. Account › *Who is in your spaces* › invite
   `ifeoma.okonkwo.vance@okonkwohouse.test` (38 characters — an ordinary
   work address).
3. The pending row appears. **Take it back** is off the right edge.

A short address such as `a@b.test` fits, which is why this survived: it is only
visible with real data, the thing RULE #2 exists for.

## Why it matters

Taking an invite back is the one undo on this screen, and a phone is where a
family owner is most likely to send an invite in the first place. It is also a
horizontal scroll on a page that has none anywhere else.

## Where it lives

[SpacePeople.tsx:51-61](../../../apps/web/components/SpacePeople.tsx#L51-L61) —
the pending row is `flex` with a `flex-1` span and a button. A flex item's
default `min-width` is `auto`, so the span refuses to shrink below the width of
the address and pushes the button out of the box rather than wrapping.

The member row above it, [SpacePeople.tsx:37-50](../../../apps/web/components/SpacePeople.tsx#L37-L50),
is the same markup. It shows `m.displayName ?? m.email`, so it is safe only
while every member has a display name.

## The fix

Two classes on the text, one on the button, in both rows:

```
min-w-0 flex-1 break-words      on the span
btn ... shrink-0                on the button
```

`min-w-0` is the whole defect. A flex item's `min-width` defaults to `auto`,
which means "never smaller than my content" — so `flex-1` could grow the span
but never shrink it, and the button went over the edge instead. `break-words`
then lets the address wrap rather than ride on one line.

**The member row was fixed with it**, not because it was seen failing but
because it is the same markup one element away, and it shows a raw email
whenever a member has no display name. That is the "a fix leaves its neighbour
behind" shape, caught this time.

**A third one turned up in the same measurement.** The account address at the
top of the page, [account/page.tsx:46](../../../apps/web/app/account/page.tsx#L46),
is a plain `<p>` and a long address pushed it 26px past its column. It now has
`break-words` too. Same root cause: a real email is longer than a test one.

## Confirmed by

**2026-09-16**, Account measured in a 360px frame as Marisol, with
`ifeoma.okonkwo.vance@okonkwohouse.test` pending:

```
                          before      after
document scrollWidth        415         341
viewport width              341         341
horizontal scroll           YES         no
elements past the edge        1           0
"Take it back" right edge   415      inside
```

Then re-driven at 360px: invited `obi.okonkwo-vance@okonkwohouse.test` from the
narrow frame. The pending row and the link box both appeared **708ms** after
the press, and the page still had no horizontal scroll.

## Rating effect

`Account › Who is in your spaces — Design 8 → 8, Ease 8 → 8` (already moved by
049). Recorded in [rating.md](../rating.md) as the 360px note on the Account
row.
