# 037 — A new page was blank, and said nothing

**Status:** fixed
**Severity:** major
**Found by:** screen scoring · `canvas › The spine` · 2026-09-16
**Surface:** app › the canvas (`/n/[id]`) — the spine
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** 2026-09-16
**Blocked on:** —

## What happened

Press **New note** while the last tool you held was a pen, and the page that opens
is **completely empty**. No words, no invitation, no cursor you can see. Just paper.

Measured in the live page, on a brand-new note:

```
{ present: true, placeholder: "\"\"", value: "\"\"", activeTool: "Handwriting" }
```

The spine textarea is there. It is focusable. It has **no placeholder**, so nothing
on the screen tells a first-time visitor that they may type, or where.

## What should have happened

A blank page says **`Start jotting.`** That is the product's whole first sentence to
a new customer, and `docs/02-product-spec.md` builds the capture contract on it:
the canvas IS the app (ADR-008), so the canvas has to be the thing that invites you.

## The cause — one word borrowed the wrong meaning

`apps/web/components/Canvas.tsx:168` read:

```tsx
placeholder={inkStarted ? "" : "Start jotting."}
```

The intent is right and the comment beside it says so: once there is handwriting on
the page, an invitation printed *through* somebody's own strokes is telling them to
begin a thing they have visibly already begun.

But `inkStarted` does not mean "somebody has drawn". It means **"the ink layer must
be mounted"**, and `apps/web/lib/use-canvas-tool.ts` sets it at mount from the
remembered tool, before any pointer has touched the glass:

```ts
useEffect(() => {
  const saved = rememberedTool();
  if (!isInk(saved)) return;
  setInkStarted(true);     // mounts the ink layer for the remembered pen (ADR-047)
  setTool(saved);
```

So the two meanings agree for somebody who has only ever typed, and disagree for
everybody else. **Anyone whose last tool was a pen got a blank page on every new
note, forever** — and that is the majority of the product's own audience. The one
person it never affected is the one running it for the first time on a fresh device.

## Why it matters

**It is the emptiest possible failure.** There is no error, nothing is slow, nothing
is lost. The page simply does not speak, and a person who does not already know that
bare paper is typeable has no way to learn it from the screen.

It also lands hardest on the exact person the fix for issue 012 was for: somebody
who has just pressed **New note** and is waiting to be told what to do.

And it is a variant of the shape named in the rulebook — *a state the renderer has
no branch for* (issues 027, 030). Here the branch exists; it is reading the wrong
flag, which is worse, because the code looks correct and carries a comment
explaining why it is correct.

## The fix

One word. `hasInk` is the note's own fact — passed from the server, true only when
this note actually has strokes on it — and it is already a prop on this component:

```tsx
// A prompt to start, and only that. Once there is ink on the page it
// is showing through somebody's handwriting to tell them to begin
// something they have visibly already begun.
// `hasInk`, not `inkStarted`: the latter is true the moment a
// remembered pen mounts the ink layer (ADR-047), so a brand-new
// empty note opened by somebody whose last tool was a pen showed
// a completely blank page and no invitation. Issue 037.
placeholder={hasInk ? "" : "Start jotting."}
```

`hasInk` was already being passed into `useCanvasTool` on the line above, for this
same distinction. The placeholder was the one reader that reached for the other flag.

### The file had to be split to take the fix

`Canvas.tsx` reached **251 lines** with the new comment — one over the repo's hard
limit. Split by responsibility, per `CLAUDE.md`, rather than by line count:

| | |
| --- | --- |
| `apps/web/lib/use-blank-tap.ts` | 46 lines — whether a pointer on bare paper was a tap or a pan, which is six pixels of arithmetic and a ref nothing else read |
| `apps/web/components/Canvas.tsx` | 223 lines — what is on the page |

The gesture took its own constant (`TAP_SLOP`), its own ref and its own ADR-102
paragraph with it, and the shell now spreads three handlers instead of declaring
them inline.

## Confirmed by

**2026-09-16**, on a brand-new note with the remembered tool set to a pen:

```
{ url: "/n/3a9ee731-7628-400f-9ccd-dcf767e9e3d8",
  remembered: "pen",
  inkMount: "true",          <- the ink layer IS mounted, as ADR-047 wants
  placeholder: "\"Start jotting.\"",
  value: "\"\"" }
```

The ink layer still mounts for the remembered pen; only the sentence came back.

**The split was re-proved as a gesture, not as a diff.** Three pointer sequences
dispatched at the shell on a fresh page:

| Gesture | Caret afterwards | Wanted |
| --- | --- | --- |
| tap — down and up in one place | `TEXTAREA` | focus the spine |
| pan — up 80px from down | `BODY` | leave the camera alone |
| second finger — `isPrimary: false` | `BODY` | leave the camera alone |

Six suites green afterwards — `canvas`, `gestures`, `ink`, `marks`, `viewport`,
`objects`. Typecheck and lint clean.

## Rating effect

`canvas › The spine` is scored for the first time in [rating.md](../rating.md), on
the fixed build. Before the fix its Ease could not have gone above 2: the screen's
primary control was invisible to anybody who had not used it before.
