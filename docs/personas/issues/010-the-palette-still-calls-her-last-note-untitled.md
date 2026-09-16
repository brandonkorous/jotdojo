# 010 — The palette still calls her last note "Untitled"

**Status:** fixed
**Severity:** minor
**Found by:** P01 Marisol · act 5 · 2026-09-16
**Surface:** app › the ⌘K palette › NOTES
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P01 Marisol · act 5 · 2026-09-16
**Blocked on:** —

## What happened

Marisol wrote note 11, then pressed ⌘K to start note 12. The note she had finished
ten seconds earlier was listed as **`Untitled`**.

The database disagreed. Read back at the same moment:

```
11 | hosting is £34.20/mo which is fine until it is 300 walkers and then it …
```

The note had a name. The palette was showing a list it had fetched when the page
first mounted, and the chrome never unmounts — `router.push` moves between notes
without remounting it — so the list stayed as it was at sign-in for the whole
session. Reloading the page fixed it, which is what proved it was staleness rather
than a second instance of issue 008.

## What should have happened

The list she is looking at describes the notes she has.

## How to reproduce

1. Sign in and open any note.
2. Write a new note and give it words.
3. Press ⌘K without reloading.

The new note is `Untitled`, and every note renamed this session shows its old name.

## Why it matters

`minor`, because the preview line underneath is current and nothing is lost.

It still lands on the worst possible sentence. She has just written something down
and the first list she opens tells her it has no name — in a product whose entire
promise is that a thought she hands over is safe. The reassurance she came for is
the thing that looks broken.

It was also nearly mistaken for issue 008 not being fixed, which is the practical
cost: a stale view and a broken writer look identical from the screen.

## Where it lives

`apps/web/components/Chrome.tsx`. The effect loaded the list once per mount:

```ts
// Preloaded once so filtering is instant with no round trip. [...]
useEffect(() => {
  startTransition(async () => {
    const recent = await listNotesAction();
    ...
  });
}, [router]);
```

`[router]` never changes for the life of the session, so this ran exactly once.

## The fix

Load it when the palette opens instead of when the chrome mounts:

```ts
useEffect(() => {
  if (!open) return;
  startTransition(async () => { ... });
}, [router, open]);
```

The original intent survives intact — the list is still fetched in one go and
filtered locally with no round trip per keystroke. It just fetches at the moment
somebody asks to see it, which is the one moment a round trip is affordable.

## Confirmed by

**P01 Marisol, act 5, 2026-09-16.** Note 12 written, then ⌘K pressed with no
reload. The palette's top row:

```
she called it "the 4 o'clock panic" — that ...
she called it "the 4 o'clock panic" — that phrase i...
```

## Rating effect

The ⌘K palette has not been scored yet — it is scored at the end of act 6, which is
the act that actually uses it to find something.
