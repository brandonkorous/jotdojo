# P03 — Tomás Iglesias-Ferrer · Iglesias Ferrer Arquitectura

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-09-16

**Status:** partial — 6 of 9 acts
**Run:** 2026-09-16
**Plan:** solo — £5/mo, because he needs his agent to write back
**Door:** the apex on an iPad, in a site hut
**Device:** iPad Pro 11" with an Apple Pencil. **Left-handed.**

## Account

| Field | Value |
| --- | --- |
| Email | `p03.tomas@jotacular.test` |
| Password | none — dev sign-in takes an email and nothing else |
| User id | `a35766de-c04e-4e64-8fd1-14469200c869` |
| Space id | `25c13d63-bc3d-4025-8bc7-57e22ff9ac68` |
| Plan | **solo**, bought through the screen |
| Toolbar side | **`left`** — set, and it survived a reload |
| Page 1 | `/n/8f76a4c1-4d4d-4a85-bbd6-a5accf0e7929` — strokes, text, sticker, arrow, agent comment |

## The person

Tomás Iglesias-Ferrer, 41, he/him. Fourteen years in practice, six of them on his
own. Two live jobs, a loft conversion in Moseley and a barn near Alvechurch, and he
is on site three days a week.

**Technical level: middling.** He is fluent in CAD and hopeless at anything else.
He has an AI subscription his accountant told him to get and has used it twice.

**What he is nervous about.** Getting a dimension wrong. He has written `2.4m` and
meant `2.04m` before, and it cost him a week and a difficult phone call.

**What made him look today.** He has a drawer of Field Notes books and cannot find
the one with the Alvechurch drainage note in it.

## The business

**Iglesias Ferrer Arquitectura** — a one-man practice, RIBA Stages 1–4.

- Two live jobs, about nine site visits a month between them
- He sketches everything. Sections, thresholds, a stair he is arguing with himself
  about. Words are the minority of what is on the page
- **Inconvenient for the software:** he writes **left-handed, at an angle, in
  Spanish and English in the same sentence**, with numbers that matter to two
  decimal places, and he rests his palm on the glass

## Why they are here today

1. "I want my sketches and my notes on the same page, not in two apps."
2. "I want to find a drawing from six weeks ago by asking for it."
3. "I am not typing any of this."

## Onboarding answers

None — the app asks nothing. **But he has a setup step nobody else has:** the
toolbar sits under his writing hand until he moves it. Record how long he writes
with the chrome in the way before he finds Account › Toolbar position, and whether
anything on the canvas suggested it existed.

## The data

**Type and draw it as written.** The handwritten pages are the test data too — write
them on the canvas with a pencil, in his hand, not typed.

### Handwritten pages — at least 6, recognized

| # | What is on the page |
| --- | --- |
| 1 | A section through the Alvechurch threshold, with `2.04m` written twice and circled, and `NO — check with Lorna` beside it |
| 2 | A stair, drawn three times, with `17 risers @ 176mm` and an arrow from the third drawing to the words `este funciona` |
| 3 | Drainage: a sketch plan with `soakaway 5m min from foundation` and `ground is clay — infiltration test??` |
| 4 | `Moseley loft — rooflight centred on the ridge NOT on the room. Client will argue. Draw both.` in running handwriting across a full page |
| 5 | A page that is 80% drawing and 20% words, to see what the transcript does with a page that is mostly not words |
| 6 | A page written at an angle, with his palm resting on the glass throughout |

### Typed and placed objects

| Kind | Content |
| --- | --- |
| text box | `Lorna Ashbee-Quaintrell — client, Alvechurch. +44 7700 900733. Prefers a phone call, hates email, will change her mind about the rooflight at least twice before March` |
| sticker | one on page 1, on the `2.04m`, saying `CHECK THIS` |
| arrow | from the sticker on page 1 to the `NO — check with Lorna` note, so it becomes a sentence |
| photo | one of the actual barn wall, taken on site |
| comment | one on page 3, from himself: `infiltration test booked 14th` |

### What he asks his agent

1. "What did I decide about the Alvechurch threshold height?" — must return `2.04m`
   and must carry his `NO — check with Lorna`
2. "Find the drainage note" — page 3, from the word `soakaway`
3. "What is Lorna's number?" — the text box, with the `+44` intact
4. "Add a note that the infiltration test is booked for the 14th" — he is on solo,
   so this must **succeed**, and must arrive attributed and revertible

---

## The space he ends up with

| Item | What it must have |
| --- | --- |
| 6 handwritten pages | drawn with a pencil, recognized, and **every transcript read by eye against the page** |
| A transcript that says `2.04m` | not `2.4m`, not `204m`. If it gets this wrong, record exactly what it returned — this is the number he is afraid of |
| An arrow that is a sentence | sticker → note on page 1, and it must survive a reload and die properly when one end is deleted |
| A photo of the barn | placed, and whatever caption the recognizer gave it, read by eye |
| A text box with Lorna in it | the long one above, wrapping correctly at 360px and on the iPad |
| An agent that wrote something | act 8's note, attributed to the agent, with violet doing its job (design.md §11) |
| A reverted agent write | he changes his mind and takes it back |
| The toolbar on the left | and it stays there after a reload and on a second device |

**Working end to end:** standing in the barn, he asks Claude what he decided about
the threshold, and gets `2.04m` with his own warning attached.

**The look.** A space that is mostly drawings. If it looks like a list of typed
notes, the run did the wrong thing.

---

## The run

### Act 1 — the spine at speed

Apex → hero → claim → canvas, **on the iPad**, not a desktop browser. P01 verified
this properly; report only what is different on a tablet.

**Done when:** he is on the canvas, and every difference from P01's spine is
recorded — especially anything that assumes a mouse or a narrow phone.

### Act 2 — the toolbar is under his hand

Write something with the Pencil, left-handed, palm down. Notice what is in the way.
Find Account › Toolbar position and set it to `left`.

**Done when:** the toolbar is out of his way, the setting survives a reload, and the
run has recorded **how he found it** — and whether anything on the canvas pointed
at it.

### Act 3 — six pages, by hand

Draw pages 1 to 6. Watch the strokes, the pen sizes, and whether the palm rejects.

**Done when:** six pages exist as handwriting, and the run has recorded any stroke
that went missing, doubled, or arrived late.

### Act 4 — read what the machine read

Open the transcript for every one of the six pages. Compare each, word by word,
against the page.

**Done when:** all six transcripts are recorded verbatim next to what was actually
written, with every difference noted. **`2.04m` gets its own line** (RULE #4 —
"it recognized the page" is not a result; what it returned is).

### Act 5 — the canvas as a canvas

Place the text box, the sticker, the arrow, the photo. Move things. Lasso a group
and drag it. Zoom out and back. Add the comment on page 3.

**Done when:** every object above exists, survives a reload in the same place, and
the run has scored each pane it opened.

### Act 6 — the thing that goes wrong for him

He erases the wrong stroke — the `2.04m` on page 1 — and has to get it back. Then
he pastes the stair sketch twice by accident and has to remove one.

**Done when:** the `2.04m` is back, exactly as drawn, and the run has recorded how
many steps undo took and whether he could tell it had worked.

### Act 7 — he connects Claude and asks

Connect, then ask questions 1 to 3 from a fresh session.

**Done when:** three answers recorded and checked by eye against the pages.

### Act 8 — the agent writes back

Ask it to add the infiltration test note. He is on solo, so it is allowed.

**Done when:** the note exists, is visibly the agent's rather than his, and he can
take it back. Record the exact words used to attribute it, and check them against
the copy rule — "Claude added a comment", never "Claude thinks".

### Act 9 — the barn, offline-ish

On the iPad, in a site hut on bad signal, open the app and find the drainage page.

**Done when:** recorded, including what the app showed while it was waiting.

---

## What only this persona proves

**Handwriting, and the whole canvas** — pencil, palm, left hand, arrows, stickers,
lasso, undo, the clipboard, and whether a transcript can be trusted with a number
that matters to two decimal places.

---

## Standing checks

**Wrong moves.** Three, named:

1. Erase the `2.04m` stroke and undo it (act 6).
2. Paste the stair sketch twice, then delete one and check the other survived.
3. Delete the sticker that the arrow is attached to, and see what happens to the
   arrow. It is supposed to die with its ends — prove it does, and that nothing
   else went with it.

**Reload and deep link.** F5 mid-stroke, with the Pencil still on the glass. Then
open page 1's URL on a phone and check the drawing is the same drawing.

**Dates.** Draw page 6 at 23:58 and let the worker recognize it after midnight.
Record which date the page claims afterwards, and the machine's timezone.

**The count and the bill.** Hand count first: **6 handwriting pages + 1 photo = 7
recognition units**, against solo's 1,000. Then open Account › Plan and usage.
Re-recognitions after an edit — do they count again? Count them by hand and find
out. A disagreement here is the business model being wrong.

**The other side.** His agent, in a fresh session, asked for the threshold height
(act 7).

**Without a mouse.** There is no mouse on an iPad. So this check becomes: **one
full job with the Pencil alone**, no on-screen keyboard at all — draw page 3, place
the sticker, attach the arrow. And separately, one job on a Bluetooth keyboard with
the focus ring visible.

**Somebody else's data.** Search for `christening` and `Kidderminster` — P02's and
P01's words. Deep-link one of P01's note ids. Then ask **his** agent for one of
P01's note ids by number. Expected: nothing, three times.

---

## Verification — P03 partial, 2026-09-16

**Status: partial, and deliberately so.** Six acts of nine ran. The three that did
not need hardware and a model this machine does not have, and they are listed as
`not checked` rather than skipped quietly.

| | Result |
| --- | --- |
| Acts completed | **6 of 9** — 1, 2, 3 (partly), 5 (partly), 6, 7, 8. **Act 4 and act 9 not run**, act 3 and 5 partial |
| Issues filed | **2** — [028](issues/028-anything-could-call-itself-claude-and-the-screen-agreed.md) and [029](issues/029-the-agent-wrote-a-note-and-nothing-said-so-and-nothing-takes-it-back.md) |
| Issues fixed and confirmed | **028** |
| Issues blocked, and on what | **029** blocked on scope — a review screen that does not exist |
| Screens scored | 4 new: the canvas menu on an object, the canvas menu on bare paper, the sticker tray, and the comments chip |
| **Not checked** | below, in full |

### What was NOT checked, and why — the important table

| | Why |
| --- | --- |
| **Act 4 in its entirety** — every transcript, and `2.04m` | `VISION_PROVIDER=fake`. Every reading on this machine is the canned `check with Dana about the margins`. **This is the act P03 exists for**, and it needs a real key and a real pencil |
| **Pressure, tilt, palm rejection, left-handedness** | There is no Apple Pencil and no iPad. Strokes were drawn with a mouse |
| **Five of the six handwritten pages** | Same reason. One page was drawn, to prove the pipeline, not the feel |
| **The lasso** | It is a drawn loop tested with all four corners inside a polygon. The only drag this harness makes is two points with no area, so a loop is **not constructible**, not merely untested |
| **The photo, zoom, dragging a multi-object selection, the clipboard** | Not reached |
| **Act 9 — the site hut on bad signal** | A device and a network this environment does not have |
| **His three questions against handwriting** | The transcripts are canned, so there is nothing honest to measure |
| **Dark mode** | Unreachable — issue 002 |

### The numbers

| Record | Result |
| --- | --- |
| Toolbar side | **`left`**, and it survived a reload |
| Strokes drawn and stored | **3**, read back from `media_assets` |
| Objects on page 1 | one text box, one sticker, one arrow — all survived a reload in place |
| The arrow as a sentence | `- circle-exclamation sticker -> 2.04m  NO — check with Lorna` |
| Steps to undo an eraser mistake | **1** — Ctrl+Z, restored exactly |
| Plan | **solo**, through the screen plus the provider's own signed webhook |
| Agent write on solo | **succeeded** — the fence is correct in both directions |
| Recognition units | 2 of 1,000 — both from his own strokes, correctly |

### Regression checks on earlier fixes

| Fix | How it showed up for him |
| --- | --- |
| **009** | Objects render whole after a reload, at 834px |
| **012** | The Add menu places the box; the bare-paper menu offers *Put a note here* |
| **017** | On solo the copy switched to the paid sentence — the branch P01 could not measure |
| **021** | `create_note` succeeded here and was refused on free, which is the pair |
| **022** | 2 units for 3 strokes, and none for placing text, stickers or arrows |
| **025** | Deep links into his notes work signed out |


## Run log

### Read this first — what this machine could not do

**RULE #4, before anything else.** Three of P03's requirements are not reachable
from this environment, and nothing below pretends otherwise:

| | |
| --- | --- |
| **An Apple Pencil** | There is none. Strokes were drawn with a mouse: no pressure, no tilt, no palm, no left hand. Everything said here about ink is about the *pipeline*, never about the feel of it |
| **An iPad** | 834px in a desktop Chrome iframe is the viewport, not the device |
| **A real recognizer** | `.env` has `VISION_PROVIDER=fake`. Every transcript on this machine is the canned string `check with Dana about the margins` |

**So act 4 — "read what the machine read" — was not run, and cannot be.** That act
is the whole reason P03 exists: whether a transcript can be trusted with `2.04m`
rather than `2.4m`. **It is recorded as `not checked`, not as a pass.** It needs a
real `VISION_PROVIDER` and a real pencil, and it is Brandon's to run.

### 2026-09-16 — act 1, the spine at speed

**No differences worth a line.** Apex → sign-in → canvas at 834px behaves as P01
verified it. Nothing assumed a mouse and nothing assumed a phone.

One thing that was NOT a defect and nearly looked like one: sign-in silently did
nothing twice. The console showed `[Fast Refresh] rebuilding` around both attempts —
my own edits, swallowing the server action. It worked on a settled server. Recorded
so nobody re-files it.

### 2026-09-16 — act 2, the toolbar is under his hand

**It never was.** The premise in this persona file is out of date, and that is worth
more than the test it asked for.

At 834px the chrome is a **single pill, 334px wide, centred along the top edge** —
x 250 to 584, y 12 to 52 — with all nine tools showing. It is not a side rail and it
is not under either hand. ADR-012 says why: *"it just moves the one pill along the
top edge instead of choosing a side for a rail that no longer exists."*

**The setting still does exactly what it says.** `Left` moved the pill from x=250 to
x=12, and it **survived a reload**. The account page's own description is already
honest about what it is for:

> Where the chrome sits along the top of the canvas. Auto centres it. **Pick a side
> if you write with a pencil and want it clear of your hand.**

**Nothing on the canvas points at it**, which is what the act asked. He would find it
by opening Account and reading, or never. Not filed — it is a preference, not a
blocker, and the canvas has nowhere obvious to advertise it.

### 2026-09-16 — act 3, by hand

**One page, not six**, and drawn with a mouse. Three strokes making a section through
the Alvechurch threshold, stored and read back as `3` strokes.

What the pipeline did correctly: strokes appear as they are drawn, reach Postgres
within the two-second batch, and come back in the same place after a reload.

**Not checked:** pressure, tilt, palm rejection, left-handedness, a stroke arriving
late or doubled, and anything about how it feels. Those are the pencil, and there is
no pencil.

### 2026-09-16 — act 5, the canvas as a canvas

This is where the run earned its keep. **Six panes opened, four of them for the first
time in this exercise.**

**The canvas menu on an object** — a colour row, *Draw an arrow from this*, *Comment
on this*, *Make another one*, *Copy*, *Bigger*, *Smaller*, *Save as an image*,
*Delete*. Every item is a verb about the thing under the finger.

**The canvas menu on bare paper** is a different, shorter menu — *Put a note here*,
*Add a sticker*, *Undo*. Contextual, three items, no greyed-out noise.

**The sticker tray** — five house colours, then `MARK IT`, `FACES`, `WIN AND LOSE`,
`WORK`. Line icons, no emoji, no palette invented for stickers. He placed a rust
circle-exclamation on the `2.04m`.

**The arrow, which is the thing worth reporting.** Sticker → text box, drawn by
aiming. And it became a **sentence**, which is what ADR-108 promised:

```
2.04m  NO — check with Lorna

_[1 arrow drawn on the page]_

- circle-exclamation sticker -> 2.04m  NO — check with Lorna

_[1 sticker on the page: circle-exclamation]_
```

An agent reading that page gets the *relationship*, not a list of objects — and the
derived parts are labelled, so nobody mistakes what he typed for what the software
worked out.

**One finding recorded, not filed.** His first attempt aimed the arrow at the
**drawing** and it silently vanished. `pick()` considers text boxes, images and
stickers, never strokes, and ADR-108 makes aiming at bare canvas mean "never mind" —
so "that is not a thing you can point at" and "cancelled" look identical. For a man
whose page is 80% drawing, an arrow he cannot attach to a sketch is a real limit.
Not filed as a defect because the behaviour is deliberate; **the feedback is the
part worth fixing**, and it belongs with whoever owns ADR-108.

**Everything survived a reload** — three strokes, the text box, the sticker and the
arrow, all in the same relative places, with the camera framing the content on open.

**Not checked:** the photo, the lasso, zoom, and dragging a multi-object selection.
The lasso specifically **cannot** be tested from here: it is a drawn loop tested with
`pointInPolygon` and all four corners inside, and the only drag this harness can make
is two points with no area. A marquee attempt caught nothing, correctly.

### 2026-09-16 — act 6, the thing that goes wrong for him

**He erased the wrong line and one Ctrl+Z put it back.** The eraser took the bottom
edge of the section; undo restored it exactly, in place, in one step. Recorded
because this is ADR-109's whole reason for existing — *"an eraser sweep across a
drawing was final, the one outcome a product whose promise is 'never lose a thought'
does not get to have."*

**Not checked:** the clipboard half of the act — pasting the stair twice and removing
one — because there is no second sketch to paste.

### 2026-09-16 — act 7, he pays, and connects

**Solo, through the screen.** The plan button's accessible name is the best piece of
copy found in three runs: **"Move this space to Solo, $5 a month, just you"** — it
says what will happen, not just a price.

The checkout goes to `https://billing.invalid/checkout` — the dev provider being
deliberately inert — so the subscription was completed by posting the **signed
webhook** the provider would send. That is the payment processor's half of a real
flow; his half was the button.

Afterwards: `Personal · solo · 2 of 1,000 read this month`, and a new line that was
not there on free — **"Change plan or cancel. Switching plans and cancelling both
happen here."**

**And issue 017's other branch is now measured rather than reasoned.** On solo the
Connect-to-Claude paragraph reads *"It can add to your notes and leave comments. It
can never change or delete what you wrote."* — the paid sentence, shown to a paid
space. That was recorded as unmeasured in issue 017 and is now confirmed.

**Not checked:** the three questions against the six handwritten pages, because the
transcripts are canned. Search over his typed objects works; there is nothing
honest to say about searching his handwriting on this machine.

#### Filed and fixed: issue 028 — anything could call itself Claude

While registering a client for him, the obvious question: **what stops a client
calling itself Claude?** Nothing.

A client registered in one unauthenticated request as `"client_name": "Claude"` with
a redirect to `jotacular.localhost:3400/not-claude-at-all` produced a consent screen
**identical** to the real one — same heading, same scopes, same reassurance — with
no mention of where the notes were going.

Fixed: the screen now names the destination host and says how much it knows about
it. *"It will be sent to jotacular.localhost:3400. Jotacular has not checked who owns
that address."* A Client ID Metadata Document gets the better sentence, because for
an `https://` client id the name really did come from the domain.

### 2026-09-16 — act 8, the agent writes back

**It wrote.** `create_note` succeeded on solo, where it was refused on free — so the
plan fence is correct in both directions, which is the pair of measurements ADR-042
deserves.

**And then nothing else happened. Filed: issue 029, a blocker.**

The note reads `infiltration test booked for the 14th`, in plain black spine text,
in the same place and colour as everything he has typed himself. **Nothing says an
agent wrote it. Nothing offers to take it back.** And the screen that talked him into
connecting says, directly under the Allow button:

> Nothing an agent does to your notes is permanent.

`listAgentChanges` and `revertRevision` are written, complete, and called **only by
`smoke-review.ts`**. `pnpm review:smoke` is green and proves the whole inbox works.
Nothing in the product calls either.

**What makes it certain rather than arguable:** the same agent, in the same minute,
on the same page, left a **comment** — and the canvas answered with a **violet dot**
on the comments button and a chip reading **"Your agent left a remark"**. Violet for
agent, exactly as design.md §11 requires.

So Jotacular knows perfectly well how to show an agent's work. **It does it for what
an agent says and not for what an agent writes** — and writing is the half that costs
£5.

### 2026-09-16 — act 9

**Not run.** The barn, the site hut and the bad signal are a device and a network
this environment does not have. Recorded as not checked.
