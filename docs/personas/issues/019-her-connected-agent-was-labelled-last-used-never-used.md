# 019 — Her connected agent was labelled "last used never used"

**Status:** fixed
**Severity:** nit
**Found by:** P01 Marisol · act 7 · 2026-09-16
**Surface:** app › Account › Connected agents
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P01 Marisol · act 7 · 2026-09-16
**Blocked on:** —

## What happened

The moment Claude appeared in **Connected agents**, its line read:

> Marisol's Claude
> connected 9/16/2026 · **last used never used**

## The cause

A helper returning a fragment for four of its five branches and a whole phrase for
the fifth, with the caller supplying the missing words:

```tsx
const relative = (date: Date | null) => {
  if (!date) return "never used";        // a whole phrase
  ...
  if (mins < 60) return `${mins}m ago`;  // a fragment
};
...
connected {c.createdAt.toLocaleDateString()} · last used {relative(c.lastUsedAt)}
```

`last used` + `never used`. It only shows on a connection nobody has used yet —
which is every connection, for the first minute of its life, which is exactly when
somebody is looking at the screen to check it worked.

## The fix

The helper owns the whole phrase, and is named for it:

```tsx
/** The whole phrase, not a fragment: a null date read as "last used never used"
 *  when the caller prefixed it. Issue 019. */
const lastUsed = (date: Date | null) => {
  if (!date) return "never used";
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "used just now";
  if (mins < 60) return `last used ${mins}m ago`;
  ...
};
```

`"just now"` became `"used just now"` for the same reason — it was the other branch
that only read correctly with the caller's prefix in front of it.

## Confirmed by

**P01 Marisol, act 7, 2026-09-16.** Read from the live Connected agents row:
`connected 9/16/2026 · never used`, and `used just now` after her agent answered its
first question through MCP.

## Rating effect

Part of the gap to 10 on `Account › Connected agents`, scored in act 7.
