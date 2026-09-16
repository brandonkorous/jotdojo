# P07 — Dele Ajayi-Blackwood · a van, and a side thing

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-09-16

**Status:** done for the doors · the PWA install and lock-screen timings need a phone
**Run:** 2026-09-16
**Plan:** free
**Door:** **not the apex.** A friend sent him a link on WhatsApp and he installed
it to his home screen. He is the one deliberate exception to "start at the apex".

## Account

| Field | Value |
| --- | --- |
| Email | `p07.dele@jotacular.test` |
| Password | none — dev sign-in takes an email and nothing else |
| User id | — |
| Space id | — |
| Capture token | — (record it, and where it was shown to him) |

## The person

Dele Ajayi-Blackwood, 27, he/him. Drives a multi-drop route for a parcel firm,
six days, and sells restored Game Boys on eBay in the evenings. His phone is in a
cradle on the windscreen and it is the only computer he owns.

**Technical level: high on a phone, zero on a desktop.** He has built Shortcuts
before, uses the share sheet constantly, and has never in his life opened a
terminal.

**What he is nervous about.** Forgetting a parcel problem before he gets back to
the depot. If he does not log it in the two seconds while the van door is open, it
is gone.

**What made him look today.** He had a shell of a Game Boy Pocket in his hand at a
car boot, wanted to check what he paid last time, and by the time the app opened
the man had moved on.

## The business

**A van, and a side thing** — 140 drops a day, and about 9 consoles a month.

- Every capture happens in under three seconds, standing up, one-handed, in
  daylight he cannot see the screen in
- He shares things **into** apps constantly — links, photos, screenshots
- **Inconvenient for the software:** he will never open a browser and type a URL.
  If it is not on the share sheet or the home screen, it does not exist to him.
  He also has no signal for about a fifth of his route

## Why they are here today

1. "Two seconds. If it is three, I will stop using it."
2. "I want it on the share sheet."
3. "I am not opening a laptop for this. Ever."

## Onboarding answers

None — the app asks nothing. **Record the thing that matters for him instead:**
Capture tokens and the Shortcut recipe live on `/account`, which is a screen he
would never look for. Record how many taps from a cold home-screen icon to a
working capture token, and whether anything ever suggested the feature existed.

## The data

### Captured from outside the app — at least 8

| # | How | What |
| --- | --- | --- |
| 1 | iOS Shortcut, from the lock screen | `27 Selly Oak Rd no safe place, took it back, third time this week` |
| 2 | iOS Shortcut | `DMG-01 shell, boot sale, £14.00. last one I paid £22.50 so this is fine` |
| 3 | Android share target, a link | an eBay listing URL shared from the browser |
| 4 | Android share target, a photo | a photo of a damaged parcel label |
| 5 | Android share target, text | a selected paragraph from a repair forum post |
| 6 | Shortcut, in the dark | `gate code 4471 for the flats on Bristol Rd, the one on the app is wrong` |
| 7 | Shortcut, at 23:58 | `dropped the last one at the wrong number. 84 not 48. sort it in the morning` |
| 8 | the capture beacon | typed half a sentence in the app and closed the tab: `shell + screen lens + button membrane is about` |

### Typed in the app — at least 6 more

`Ríoghnach at unit 12 will take anything, she signs for the whole block` ·
`backlight kits £6.80 each if I buy 10, £9.20 for one` ·
`the yellowed ones sell for more than the clean ones which makes no sense but it is true, people want the retrobrite look undone now, so do not bleach anything until I have checked what it goes for in that condition` ·
`+44 7700 900254 is the depot supervisor, not the general number` ·
`Selly Oak Rd is the one with the dog. Selly Park Rd is fine.` ·
`sold the DMG-01 for £48.00, cost me £14.00 plus £6.80 for the lens`

The long one must wrap past five lines at 360px.

---

## The space he ends up with

| Item | What it must have |
| --- | --- |
| 14 notes | 8 from outside the app, 6 typed inside it |
| A working Shortcut | built from the recipe the product actually prints on `/account`, and run from a lock screen |
| A working share target | the PWA installed to the home screen, appearing on the Android share sheet, and accepting a link, a photo and selected text |
| A beacon save | note 8, half-typed, tab closed, recovered |
| A number he will judge it on | **seconds from intent to saved**, measured from the share sheet and from the Shortcut, at least three times each |
| An agent he can reach from the van | connected, and asked one question with the laptop not merely shut but non-existent |

**Working end to end:** at a car boot, he says "what did I pay for the last DMG-01
shell" and gets `£22.50` before the man has moved on.

**The look.** Fragments. Half of them are addresses and prices, and several arrived
from another app rather than being typed.

---

## The run

### Act 1 — the door nobody else uses

Open the link cold on a phone, with no apex visit. Install it to the home screen.

**Done when:** it is on the home screen, launches, and the run has recorded what
the first screen said to somebody who has never seen the marketing site. **He has
had zero explanation of what this is** — record whether the app gives him any.

### Act 2 — signing in from a home-screen icon

Dev sign-in with `p07.dele@jotacular.test`, inside the installed PWA rather than a
browser tab.

**Done when:** signed in, and any difference from a normal browser is recorded —
especially anything that opened a separate browser window and left him there.

### Act 3 — the first capture, timed

Type two of the six notes, on the canvas, one-handed, timed from tapping the icon.

**Done when:** three timings are recorded. **This is the product's own promise and
its own named failure signal.**

### Act 4 — he goes looking for the share sheet

He wants it on the share sheet and does not know whether it is. Find out the way he
would: try sharing a link from the browser and see if Jotacular is there.

**Done when:** recorded either way, along with how he found out.

### Act 5 — three things through the share target

Share the link, the photo and the selected text (notes 3, 4, 5).

**Done when:** three notes exist with the right content in each, and the run has
recorded what each one **looked like** afterwards — a shared link that became an
empty note is the exact defect this route was fixed for once already, so look hard.

### Act 6 — the Shortcut

Go to `/account` › Capture tokens. Make a token. Build the Shortcut from the
recipe as printed. Run it from the lock screen for notes 1, 2, 6 and 7.

**Done when:** four notes arrived, and the run has recorded: how many taps to get
from the app to a token, whether the printed recipe worked without interpretation,
and **the seconds from lock screen to saved**, three times.

### Act 7 — the thing that goes wrong for him

He is at 23:58, in the dark, at the wrong house number. He fires note 7 off through
the Shortcut and drives away **without checking**. He never sees a confirmation
because he is driving.

**Done when:** the run has answered: if that capture had failed, how would he ever
know? Record what the Shortcut showed, what the app shows later, and whether a
silent failure is distinguishable from a silent success. **If it is not, that is a
`major`** — for this persona, an unnoticed failure is a lost thought.

### Act 8 — no signal

Put the phone in aeroplane mode. Try a capture through the app and one through the
Shortcut.

**Done when:** both outcomes recorded verbatim, including whether anything was lost
and whether he was told. Then restore signal and record what happened to each.

### Act 9 — the beacon

Type note 8 half-way in the app and close the tab mid-word.

**Done when:** recorded whether the half-sentence survived, and in what state.

### Act 10 — the car boot

Connect an agent on the phone. Ask what he paid for the last DMG-01 shell.

**Done when:** the answer is recorded and checked against note 2, and the run has
recorded how long the whole thing took from having the thought.

---

## What only this persona proves

**The doors that are not a browser** — the iOS Shortcut and its token, the Android
share target with a link, a photo and selected text, the capture beacon, and what
any of them do with no signal. He never sees the marketing site at all.

---

## Standing checks

**Wrong moves.** Three, named:

1. Fire the Shortcut twice by accident from the lock screen and check whether he has
   one note or two.
2. Share the same photo into the app twice.
3. Revoke his capture token on `/account` and then run the Shortcut again — and
   record what the Shortcut tells him, because he is in a van and cannot debug it.

**Reload and deep link.** Kill the installed PWA from the app switcher mid-note and
reopen it. Then open a note URL from WhatsApp, which opens it in an in-app browser
where he is not signed in.

**Dates.** Note 7 at 23:58, fired from a Shortcut, recognized nothing but timestamped
by something. Which day does it claim? Machine timezone, stated.

**The count and the bill.** Hand count: 13 typed or shared text notes = 0 units,
**plus 1 photo = 1 unit**, of 100. Then look. The shared-photo path is the one that
goes through our own server rather than browser-to-blob, so check especially that it
was counted once and not twice.

**The other side.** His agent, from the phone, at a car boot (act 10).

**Without a mouse.** He has never had one. The whole run is thumbs. So the keyboard
check becomes the **on-screen keyboard**: with it up on a 360px screen, is the save
state still visible, and is anything important behind it?

**Somebody else's data.** Search for `Hollybank` and `beam calc` — P06's words.
Deep-link a P06 note id from the phone. Expected: nothing.

---

## Verification

| | Result |
| --- | --- |
| Acts completed | |
| Issues filed | |
| Issues fixed and confirmed | |
| Issues blocked, and on what | |
| Screens scored | |
| **Not checked** | |

### The numbers

| Record | Result |
| --- | --- |
| Seconds, icon to saved (3 readings) | |
| Seconds, lock screen to saved via Shortcut (3 readings) | |
| Seconds, share sheet to saved (3 readings) | |
| Taps from a cold start to a working capture token | |
| Could a silent Shortcut failure be told from a success? | |
| What happened with no signal, both routes | |
| Units: hand count vs screen | |
| Machine timezone | |

---

## Run log

Act by act, as you go. **Record every timing as you take it**, not from memory —
the seconds are the whole point of this persona.


---

## Verification — P07, 2026-09-16

**Both doors work.** The share target and the capture token are the two ways in that
are not a browser, and both were exercised end to end.

| | Result |
| --- | --- |
| Acts completed | **4, 5, 6, 7, 8, 9** — the doors and the failure modes |
| Issues filed | **1** — [034](issues/034-a-man-who-typed-was-told-his-strokes-were-safe.md) |
| Issues fixed and confirmed | **034** |
| **Not checked** | acts 1–3 — installing to a home screen and the lock-screen timings. Both need a phone |

### Act 4 and 5 — the share sheet

**It is declared, and it works.** `manifest.webmanifest` carries a real
`share_target`: POST to `/share`, `multipart/form-data`, with `title`, `text`, `url`
and `files`.

Posted exactly as an Android share sheet posts it, and the note that came out:

```
title : Game Boy Pocket shell - clear purple
body  : Game Boy Pocket shell - clear purple

        this is the one I paid 14 for last time

        https://www.ebay.co.uk/itm/123456789
```

**Title, text and link, each on its own line, with a real title on the note.** The
persona warned that *"a shared link that became an empty note is the exact defect
this route was fixed for once already"* — it did not recur.

### Act 6 and 7 — the Shortcut

**One tap to a token.** The name field is pre-filled `iPhone`, so Create token is a
single press, and the panel that appears is the best-handled secret in the product:

> **Copy this now.** It is not stored and cannot be shown again.
> `jd_cap_…`  ·  Copy  ·  ▸ **Set up the Shortcut on iPhone**

The token then lists itself as `iPhone · Personal · never used · Revoke` — and
`never used` reads correctly thanks to issue 019.

**The printed recipe needs no interpretation.** Five steps, naming the exact URL, the
method, the header and the JSON field, and then the sentence that answers the
question a driver actually has:

> Works from a locked phone and while driving. **Nothing is transcribed on our side**
> — Apple's on-device dictation does the work and we receive text.

**A browser cannot exercise `/v1/capture`, and that is correct.** There is no CORS on
it, the preflight 404s, and its client is a Shortcut rather than a page. So it was
measured the way its real client works — over HTTP, from outside a browser, by
`pnpm api:smoke`:

| | |
| --- | --- |
| **capture is fast** | **19ms median of 3**, against a 300ms budget |
| a retry with the same `request_id` | **deduplicated**, and returns the same note |
| no bearer · garbage token · revoked token | **401** on all three |
| empty text | 400 |
| another user's space | refused |
| the token | listed for its owner only, and records `lastUsedAt` |

**Act 7's question — if a capture failed while he was driving, how would he know?**
He would not, in the moment, and nothing pretends otherwise. What the product does
instead is make the failure very unlikely and recoverable: the Shortcut gets a 201
and a note URL, a retry with the same `request_id` cannot double-post, and the token
list shows `last used` so a dead Shortcut is visible the next time he looks. That is
the honest answer, and it is a good one.

### Act 8 — no signal

**Filed and fixed: [034](issues/034-a-man-who-typed-was-told-his-strokes-were-safe.md).**
The behaviour was already right and the sentence was wrong.

| | |
| --- | --- |
| Capture with no network | **accepted.** He kept typing into a second box |
| What the line said | *"Strokes are safe here and will retry"* — to a man who typed, about a queue that also holds text, arrows, stickers and photos |
| After the fix | **"Saved on this device. It will send when the connection is back"** |
| On reconnect | both boxes sent, **in full**, with no prompt and nothing lost |

### Act 9 — the beacon

**Already proved, twice.** P01 filed [014](issues/014-she-typed-a-sentence-the-page-reloaded-and-it-had-never-been-sent.md)
and fixed it; P02 re-proved it with a half-word when the phone went away. Nothing
about Dele's case differs, so it is recorded as covered rather than re-run.

### What was NOT checked

| | Why |
| --- | --- |
| **Installing to the home screen, and what the PWA looks like** | No phone. The manifest is correct — `display: standalone`, three icons including a maskable one, theme and background colours — but a manifest is not an installation |
| **"Two seconds. If it is three, I will stop using it."** | His whole premise, and it needs a phone and a thumb. The API side is measured at **19ms**; the app side is not |
| **Whether sign-in from an installed PWA opens a separate browser window and strands him** | Act 2's specific worry, and it needs an install |
| **A real dead spot** | The network was cut in software. Good enough to prove the queue; not the same as a tunnel |
