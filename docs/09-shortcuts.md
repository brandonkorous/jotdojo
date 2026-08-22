# 09 — iOS Shortcuts capture

**Priority: P0.** This ships with typed notes, not after them.

**Status: built.** `POST /v1/capture` lives in `apps/api` on port 3401. Capture tokens
are minted and revoked from `/account`. `pnpm api:smoke` exercises the endpoint over
real HTTP — the happy path, idempotent retry, rate limiting, an empty body, a missing
bearer, a garbage token, a revoked token, and the cross-space refusal.

Not yet built: photo and share-sheet capture (they need the media pipeline from M4), and
the generated iCloud Shortcut link. The setup instructions in `/account` are manual for
now, which is fine for one user and not fine for a hundred.

## Why this is not optional

A web app on iOS has no share sheet target (iOS Safari does not implement the Web Share Target API), no Siri, no lock-screen widget, no Action Button, no Apple Watch. Note apps live or die on the two seconds between having a thought and capturing it. If our capture path is "unlock, find icon, wait for load, tap, type," we lose to Apple Notes permanently no matter how good the MCP layer is.

**iOS Shortcuts is the entire answer**, and it is available to any web app that exposes an HTTP endpoint. A Shortcut can be:

- triggered by Siri, hands-free, from a locked phone
- bound to the Action Button on recent iPhones
- placed in the share sheet, so any app can send to it
- pinned to the home screen and the lock screen
- run from Apple Watch and CarPlay
- fired automatically by a Personal Automation (arriving somewhere, a time of day)

That is a better capture surface than most native note apps build for themselves, and it costs us one REST endpoint.

## The three shortcuts we ship

### 1. Jot — the flagship

    Dictate Text  ->  Get Contents of URL (POST)  ->  Show Notification

"Hey Siri, jot." Speak. Done. No app opened, no screen unlocked, no audio pipeline on our side, no transcription cost — Apple's on-device dictation does the work and we receive text.

This is the bar-napkin path. It is the single highest-leverage thing in the whole product.

### 2. Snap

    Take Photo  ->  POST multipart  ->  Show Notification

Camera straight to a note. The photo runs through the image recognizer and becomes searchable text. This is the literal napkin case.

### 3. Send to jotdojo (share sheet)

    Accept: text, URLs, images  ->  POST  ->  Show Notification

Turns every app on the phone into a capture source. Reading an article, seeing a message, looking at a receipt — send it.

## The endpoint

    POST https://api.jotdojo.com/v1/capture
    Authorization: Bearer <capture token>
    Content-Type: application/json | multipart/form-data

    { "text": "...", "space_id": "...", "source": "shortcut:jot" }

    -> 201 { "note_id": "...", "url": "https://app.jotdojo.com/n/..." }

Requirements:
- **Fast.** Target under 300ms. A Shortcut that hangs feels broken and gets deleted.
- **Idempotent** on a client-supplied `request_id`, because Shortcuts retry on flaky connections.
- **Returns a URL** so the notification can deep-link into the note.
- Accepts `multipart/form-data` for photos and audio.

## Capture tokens

Shortcuts cannot run an OAuth flow, so they need a long-lived bearer token. That is a real risk, constrained deliberately — see [06-auth.md](06-auth.md):

- Scope is **`capture:write` only**. It can create. It cannot read, list, or search.
- Bound to **one space**, chosen at creation.
- Named, revocable, with a visible last-used timestamp.
- Shown once, stored hashed.
- Rate limited hard.

A leaked capture token means a stranger can add notes to one space. Annoying, not catastrophic. That asymmetry is the entire design, and it is why we do not simply reuse a full-access token.

## Distribution and onboarding

This must not be a support article nobody reads. It is a first-run step.

1. After first sign-in, the app offers **"Set up one-tap capture"**.
2. On iOS, this generates a personal capture token and hands over an iCloud Shortcut link with the token pre-filled as a text variable.
3. The user taps Add Shortcut, grants Siri permission, and is told the phrase: **"Hey Siri, jot."**
4. The app verifies by waiting for the first capture and confirming it landed.

Step 4 matters. An unverified setup is a setup that silently failed.

Consider shipping the shortcut file itself in the repo (`assets/shortcuts/`) with a placeholder token, and generating the personalized iCloud link server-side.

## Android

Better story, less work:

- **Web Share Target actually works** in installed PWAs on Android. Declare it in the manifest and jotdojo appears in the system share sheet with no Shortcut equivalent needed.
- Google Assistant can open a shortcut URL.
- Tasker and similar can POST to the same endpoint for power users.

So on Android, capture is handled by the manifest and the same `/v1/capture` endpoint. No extra work beyond declaring the share target.

## Success measure

If the founder still opens Apple Notes when a thought hits, this failed, and the whole product is in trouble. **Time-to-captured is the metric that matters most in the entire product.** Instrument it.
