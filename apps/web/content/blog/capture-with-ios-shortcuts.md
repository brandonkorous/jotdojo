---
title: Capturing to a web app with iOS Shortcuts
description: A web app on iOS has no share sheet, no Siri and no Action Button. Shortcuts gives you all three for the price of one HTTP endpoint — here is how, whether or not you use jotdojo.
date: 2026-08-19
---

If you build a web app that people are meant to *capture* into — notes, tasks,
expenses, anything — iOS looks hostile. You get none of the entry points a native
app gets:

- no share sheet target (Safari does not implement the Web Share Target API),
- no Siri phrase,
- no Action Button binding,
- no lock-screen widget, no Apple Watch, no CarPlay.

Your capture path is "unlock, find the icon, wait for the page, tap, type." For
anything competing with Apple Notes, that is a losing position no matter how good
the rest of the product is.

**Shortcuts closes the entire gap**, and it works for any web app with an HTTP
endpoint. This post is the general recipe; jotdojo is just the example.

## The recipe

A Shortcut is three actions:

```
Dictate Text  →  Get Contents of URL (POST)  →  Show Notification
```

Wire it up once and the same Shortcut can be triggered by Siri hands-free from a
locked phone, bound to the Action Button, put in the share sheet, pinned to the
home screen or the lock screen, run from an Apple Watch or CarPlay, or fired
automatically by a Personal Automation when you arrive somewhere.

That is a better capture surface than most native apps bother to build, and on
your side it is one route.

## Building it

**1. Add "Dictate Text."** Set the language, and set *Stop Listening* to "After
Pause." Apple's on-device dictation does the transcription, which means it works
offline, costs you nothing, and never sends audio to your server.

**2. Add "Get Contents of URL."** Point it at your endpoint. Set Method to POST,
add a header `Authorization` with your token, and set Request Body to JSON with
one field carrying the *Dictated Text* magic variable.

**3. Add "Show Notification."** Put the response's note URL in it, so the
notification is tappable and takes you to what you just captured.

**4. Name it something Siri can hear.** One syllable is best. Ours is "Jot", so
the phrase is "Hey Siri, jot."

## What your endpoint has to get right

This is where most integrations disappoint, so it is worth being specific.

**Be fast.** Target under 300ms. A Shortcut that hangs feels broken, and a
Shortcut that feels broken gets deleted. Do the minimum synchronously — write the
row, return the id — and push recognition, embedding and indexing onto a queue.

**Be idempotent.** Shortcuts retry on flaky connections, and a phone in a car
park is a flaky connection. Accept a client-generated `request_id` and return the
same result for a repeat rather than a second note.

**Return a URL.** The notification is the only feedback the user gets. It should
deep-link into the thing that was created, so a mis-dictation can be fixed
immediately instead of discovered next week.

**Accept multipart.** Photos and audio come through the same door.

Ours looks like this:

```http
POST https://api.jotdojo.com/v1/capture
Authorization: Bearer <capture token>
Content-Type: application/json

{ "text": "...", "space_id": "...", "source": "shortcut:jot" }

201 { "note_id": "...", "url": "https://app.jotdojo.com/n/..." }
```

## The token question

A Shortcut cannot run an OAuth flow. There is no browser to redirect and no
callback to catch, so it needs a long-lived bearer token pasted into a header.

That is a real risk, and the answer is not to avoid it — it is to make the token
worth as little as possible if it leaks:

- **One scope: create.** Ours can create a note and nothing else. It cannot read,
  list or search. Someone who steals it cannot exfiltrate anything.
- **One space,** chosen when the token is made.
- **Named, revocable, with a visible last-used time,** so an unused token is
  obvious and a compromised one is one click from dead.
- **Stored hashed,** shown once. A database backup is not a pile of working keys.
- **Rate limited hard.**

A leaked capture token should mean "a stranger can add notes to one of your
spaces." Annoying; not catastrophic. That asymmetry is the whole design, and it
is why reusing a full-access token here would be the wrong call.

## Android is easier

Installed PWAs on Android *do* get the Web Share Target API. Declare it in the
manifest and your app appears in the system share sheet with no Shortcut
equivalent required. The same endpoint serves both.

## The part people skip

Do not leave this in a help article. Nobody reads help articles.

Make it a first-run step: generate the token for them, hand over a pre-filled
Shortcut, ask for the Siri permission, tell them the phrase — and then **wait for
the first capture to land and confirm it did**. An unverified setup is a setup
that silently failed, and the user will conclude your product does not work.

---

The endpoint above is jotdojo's, and it is live. You can also [try the app](/)
with no account and no token at all.
