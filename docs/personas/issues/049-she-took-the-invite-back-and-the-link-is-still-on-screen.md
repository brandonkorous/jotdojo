# 049 — She took the invite back and the link is still sitting there

**Status:** fixed
**Severity:** major
**Found by:** P01 · Marisol Okonkwo-Vance · act 3 (invite, re-run on the screen)
**Surface:** app › Account › Who is in your spaces
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** 2026-09-16, on Account as Marisol
**Blocked on:** —

## What happened

Marisol invited `adaeze.okonkwo.vance@okonkwohouse.test` to *The Okonkwo house*.
The screen gave her a link and this sentence:

> Send them this link. It lasts a fortnight and only works for that address.

She changed her mind and pressed **Take it back**. The pending row disappeared
from the list, which is right. **The link did not.** The box, the sentence and
the **Copy** button were all still on screen, offering
`http://127.0.0.1:3400/invite/jd_inv_0yvOVJFHZNt8VWSEjAc4gj6BLBV5HBM2` — a link
that is now dead.

Opening it says *"That invite was taken back. Ask whoever sent it."*

## What should have happened

The link should have gone away when the invite it belongs to did. The sentence
beside it makes a promise — "send them this link" — that the app has just made
untrue. It is the same promise-in-copy shape the rulebook lists.

## How to reproduce

Every time.

1. Sign in as the owner of a space with a spare seat (a **family** space on the
   family plan seats 6).
2. Account › *Who is in your spaces* › type an address › **Make an invite**.
3. Press **Take it back** on the pending row that appears.
4. The row goes. The link box stays, still holding the revoked link.

## Why it matters

She sends a dead link to a real person, who opens it and is told they cannot
come in. She has no way to tell from this screen that it went stale — nothing
about the box changes. The most likely next move is that she blames the guest,
or sends it twice.

It is the same shape after an invite is **accepted**: the guest is in, and the
screen still says "send them this link".

## Where it lives

- [InviteForm.tsx:14](../../../apps/web/components/InviteForm.tsx#L14) — `link`
  is client state that nothing ever clears.
- [SpacePeople.tsx:56](../../../apps/web/components/SpacePeople.tsx#L56) — revoke
  lives in the parent, so the server re-render replaces the LIST while the child
  keeps its own state. `InviteForm` is never unmounted, so `link` survives.
- [people-actions.ts:32](../../../apps/web/app/people-actions.ts#L32) —
  `inviteAction` returns `{ token, expiresAt }` and drops the `inviteId` that
  `inviteToSpace` already gives it. That id is what was missing to tie the two
  together.

## The fix

**The link is derived during render instead of being stored.** It exists only
while the invite it belongs to is still pending:

```tsx
const link = made && pendingIds.includes(made.inviteId) ? made.url : null;
```

Three small changes carry that one line:

- `inviteAction` now returns the `inviteId` that `inviteToSpace` already handed
  it and it was throwing away.
- `InviteForm` holds `{ inviteId, url }` rather than a bare string.
- `SpacePeople` passes `pendingIds={pending.map((i) => i.id)}` — the same
  `pending` array the list itself is drawn from.

Deriving rather than clearing is what makes the second case work too. Nothing
tells the owner's browser that a guest accepted, so a handler has nothing to
fire on; but `pending` already filters `!i.acceptedAt && !i.revokedAt`, so the
next render the page does for any reason drops the link on its own.

**Checked for the sibling shape.** `InviteForm` is the only place a token is
ever shown. The invite mail path does not exist — ADR-118 says the link IS the
delivery — so there is no second renderer to leave behind.

## Confirmed by

**2026-09-16**, driven on Account as Marisol Okonkwo-Vance, owner of *The
Okonkwo house* (family plan, 6 seats).

**Taken back:**

```
invite chidi.okonkwo.vance@okonkwohouse.test
  link box     http://127.0.0.1:3400/invite/jd_inv_ydvjDqHaljt5nRNSch7Zd0LRnhZ1iMFa
  pending row  present
press "Take it back"
  link box     []            <- gone
  "Send them this link"      <- gone
  pending row  gone
```

**Used by the guest**, which is the case no handler could catch:

```
invite ngozi.okonkwo.vance@okonkwohouse.test
  link box     http://127.0.0.1:3400/invite/jd_inv_08TqEp5X1YqAv9DXY05oqMei2YjhLF0K
Ngozi accepts it in another session
Marisol's page re-renders (she pressed "Take out" on Tolu)
  link box     []            <- gone
  members      marisol owner, ngozi member   2 of 6 seats
```

Before the fix, the first of those left the dead link, the sentence and the
**Copy** button on screen.

## Rating effect

`Account › Who is in your spaces — Ease 8 → 9`. The screen no longer offers a
link that will refuse the person it is sent to.
