# 039 — "Who else is here" was drawn underneath the toolbar

**Status:** fixed
**Severity:** major
**Found by:** screen scoring · `canvas › Presence` · 2026-09-16
**Surface:** app › the canvas (`/n/[id]`) — the presence chip
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** 2026-09-16
**Blocked on:** —

## What happened

Opening the same note in two windows put a presence chip on the page, correctly:

```
says   : "Your other window is here"
faces  : [{ glyph: "•", self: true, writing: false }]
role   : status,  aria-live: polite
box    : x 14, y 12, w 190, h 31
```

**Nothing was visible on the screen.** The chip was rendered, positioned, styled
and announced to a screen reader — and covered completely by the tool pill.

```
presence   x 14 … 204   z-index 16
tool pill  x 12 … 346   z-index 20
```

`elementsFromPoint` at the centre of the chip returns the pill's button and its
icon. The chip is not in the top five elements at that point.

## The cause — a position defined as "opposite" something that moved

`presence.css` said, in its own opening comment:

> **Top-left, opposite the tool rail** and above the writing surface: it has to be
> visible without being reached for, because its whole job is to be noticed BEFORE
> somebody types into a paragraph another person is already in.

That was **true when it was written**. `toolbar-side.ts` records what happened next,
in an ADR-012 amendment:

> There used to be a hook here that measured the viewport: phone → bottom bar,
> tablet → left rail, desktop → right rail. All three are gone… One pill along the
> top edge is the right answer on every viewport.

So the rail that top-left was opposite to **was on the right**. When three toolbars
became one pill that the stored preference slides along the top edge, the pill
gained the ability to sit top-left — and presence, at a hard-coded `left: 0.9rem`,
stayed where it was.

## Who it hit, and it is not a minority

The preference has three values, and the collision is total on exactly one:

| `align` | pill | presence | |
| --- | --- | --- | --- |
| `auto` (the default) | centred | left | visible |
| `right` | right | left | visible |
| **`left`** | **left** | **left** | **completely covered** |

`toolbar-side.ts` says what `left` means: *"keep the chrome away from the hand
holding the pencil."* A right-handed person moves the chrome **left**. That is the
setting most people who pick up a pencil will choose, and it is the one that
silently removes the feature.

## At 360px it is worse

The same measurement in a 360px frame:

```
presence   x 14 …  52   (38px — the sentence is dropped by design)
tool pill  x 12 … 210
```

`presence.css` already drops `.jd-presence-says` below `30rem`, deliberately:
*"On a phone the band across the top is where the next line goes. Keep the faces,
drop the sentence."* So on a phone the entire signal is one 22px dot — and the dot
was behind the pill on every alignment, because at 360px a 198px pill is most of
the top edge whichever end it is pinned to.

A screenshot of the phone, with a second window provably open on the same note,
showed the toolbar and nothing else.

## Why it matters

**It is the one warning before the one thing this product cannot fix.** ADR-001 says
no CRDT yet, and `Presence.tsx` is honest about the consequence in its own comment:

> Two people typing into one paragraph still ends in a conflict, and rather than
> pretend otherwise, the product shows the collision coming and lets a person do the
> obvious human thing about it.

**Showing the collision coming is the entire mitigation.** Hidden, the mitigation is
gone and the conflict still arrives — as issue 034's `This note changed somewhere
else` line, after the fact, when the person has already typed.

And it is a fresh shape for the ledger: not a dead function, not a missing branch,
but **a correct element, correctly placed against a landmark that later moved.**
Every part of it works. Nothing can see it.

## The fix

Presence takes the side opposite the chrome, which is what its comment always
claimed. `align` was already a prop on `Canvas`; it is now passed down.

```tsx
/** Opposite the chrome, which MOVES. ADR-012 merged two rails into one pill
 *  that the toolbar preference slides along the top edge, and a fixed top-left
 *  then sat underneath it on the commonest setting. Issue 039. */
const opposite = (align: Align): Side => (align === "left" ? "right" : "left");
```

```css
/* The side is the chrome's opposite, not a constant. It shared the corner with
 * the tool pill and lost, at every width, on every screen. Issue 039. */
.jd-presence[data-side='left'] { left: 0.9rem; }
.jd-presence[data-side='right'] { right: 0.9rem; }
```

`auto` resolves to `left`, so the centred default keeps the placement it already
had and only the broken case moves.

**Raising the z-index was considered and rejected.** The chip has
`pointer-events: none`, so lifting it over the pill would float a label across live
buttons that taps pass straight through — it would look broken rather than be
covered, which is not an improvement.

## Confirmed by

**2026-09-16.** Two windows on note `3a9ee731`, one desktop and one 360px frame.

**Desktop**, chrome on the left: *"Your other window is here"* now reads at the top
right, clear of the pill, in DM Sans (see issue 038).

**360px**, same note:

```
side       "right"
presence   x 307 … 346
tool pill  x  12 … 210
overlaps   false
```

The dot is visible at the top-right of the phone.

**And the writing state was caught on the way past**, by recording the chip while
the phone typed into the same note:

| | says | face ring |
| --- | --- | --- |
| at rest | Your other window is here | `rgb(255,255,255)` |
| **+4.3s** | **Your other window is writing** | **`rgb(0,194,168)`** — the mint primary |
| +22.3s | Your other window is here | `rgb(255,255,255)` |

A ring, not a pulse, exactly as the CSS comment asks: *"something blinking in the
corner of the eye is the last thing a page for writing on needs."*

The desktop also adopted the phone's sentence live while this ran — ADR-058's
follow-when-clean, working.

Typecheck and lint clean. `Presence.tsx` 66 lines, `presence.css` 61, `Canvas.tsx`
223 — all inside the limits.

## Rating effect

`canvas › Presence` is scored for the first time in [rating.md](../rating.md), on
the fixed build. Unfixed it could not have been scored at all: RULE #4 forbids
scoring a screen nobody can see.
