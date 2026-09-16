# 012 — She could not write a single word without a mouse

**Status:** fixed
**Severity:** major
**Found by:** P01 Marisol · act 5 · the keyboard-only standing check · 2026-09-16
**Surface:** app › A note (the canvas) › Add › "A note on the canvas"
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P01 Marisol · act 5 · 2026-09-16
**Blocked on:** —

## What happened

The keyboard-only standing check asks for three of the fourteen notes written with
no pointer at all. The first four steps worked:

1. **Ctrl+K** opened the palette.
2. **Enter** took `New note`, the default, and a fresh note opened.
3. **Tab** three times reached the ⊕ button, with a visible focus ring the whole way.
4. **Enter** opened the Add menu, and **Down** moved between its three items.

Then it stopped. Choosing **A note on the canvas** selected the Text tool — the `T`
lit up in the toolbar — and did nothing else. **No box was placed and there was
nowhere for the caret to be.**

Everything typed after that went into the void. Measured in the live page a moment
later:

```
boxes: 0
active: DIV|Photo          <- the menu had not even closed
```

Typing letters on the canvas did nothing. Pressing Enter did nothing. There was no
way forward.

## What should have happened

A menu item called *A note on the canvas* puts a note on the canvas.

## How to reproduce

With a keyboard only, from a fresh note: Tab to ⊕, Enter, Down twice, Enter. Then
try to type. Every time.

## Why it matters

**The one thing this product is for could not be done without a pointer.** Not a
secondary screen or an edge case — writing a note, which is the whole app.

`ink-plane.ts` already states the promise this broke, in its own words:

> *docs/10 also requires that everything drawable is typeable.*

It was typeable only if you could point at where. The canvas is deliberately not
focusable — `use-canvas-keys.ts` explains why, and the reason is good: a tabindex
on the drawing surface would put a focus ring round the whole page every time
somebody picked up the pen. But nothing was put in its place. The full list of what
the canvas answers to is Escape, Delete, Backspace, and Ctrl+Z/Y/C/X/V/D. **Not one
of them places a text box.**

So a keyboard-only person, or anyone driving this with a screen reader or a switch,
could open the app, make a note, and never write in it.

`major` rather than `blocker` only because a pointer is present on a phone and on a
laptop trackpad, so nobody is locked out in practice — they are locked out of the
way they work.

## Where it lives

`apps/web/components/Canvas.tsx:212` — the Add menu was wired straight to
`armTextBox`:

```tsx
onTextBox={armTextBox} />
```

`armTextBox` (`apps/web/lib/use-canvas-tool.ts`) sets the tool to `textbox` and
waits for a tap. Its own comment says so:

> *Arm placing a note on the canvas. A one-shot, not a mode — the engine hands the
> tool back to the spine the moment a box lands.*

The moment a box lands. Nothing on the keyboard can land one.

**The machinery already existed.** The right-click canvas menu has offered *put a
note here* since ADR-102, through `engine.textAtClient(clientX, clientY)` —
`ink-engine-tap.ts:94`. The Add menu simply never used it.

## The fix

The Add menu now places the box rather than arming a tap:

```tsx
/** The Add menu PUTS a note on the page rather than arming a tap: no key
 *  places a box and the canvas is deliberately not focusable, so arming one
 *  left a keyboard-only person unable to write at all. Issue 012. */
const addTextBox = () => {
  armTextBox();
  requestAnimationFrame(() => {
    const r = shellRef.current?.getBoundingClientRect();
    if (r) engineRef.current?.textAtClient(r.left + r.width / 2, r.top + r.height / 3);
  });
};
```

Three things worth naming:

- **It still calls `armTextBox`** first, because that is what mounts the object
  plane and closes the tool options. The box is then placed on the next frame, once
  React has committed.
- **`textAtClient` focuses the box it makes** and fires `onTextPlaced`, which hands
  the tool back to `text`. So the state afterwards is exactly what a tap produces.
- **Tap-to-place is not gone.** The `T` in the tool rail still arms it, which is
  where somebody who wants to choose the spot will look.

It also makes the mouse path one tap shorter, and makes the label honest.

## Confirmed by

**P01 Marisol, act 5, 2026-09-16.** Notes 12, 13 and 14 — the three the standing
check asks for — written at 360px with **no pointer event at all**, start to finish:

```
Ctrl+K · Enter · Tab Tab Tab · Enter · Down Down · Enter · type · Escape
```

The focus ring was visible at every step. All three read back from the database
with the exact words, including the quotation marks in note 12 and the ampersand in
note 13.

## Still open, and deliberately not fixed here

**The Add menu does not close when its item is taken by keyboard.** Activating with
Enter leaves the dropdown open and returns focus to `Photo`; with a mouse it closes
normally. It stopped mattering the moment the box was placed and focused — the
caret is in the box either way — so it is recorded here rather than filed, and it
belongs to `@wizeworks/silicaui-react`'s `DropdownMenu` rather than to this repo.

## Rating effect

`A note (the canvas)` is scored in act 5 for the first time at 360px. This defect
and issue 009 are both fixed before it is scored, so the score describes the
repaired screen — and this note is the record that it was not that screen an hour
ago.
