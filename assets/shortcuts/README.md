# The three Shortcuts

Build instructions, not binaries. A `.shortcut` file is a signed archive that
can only be produced by iOS, so these are the recipes to type in — and they are
here rather than only in `/account` because the account page shows one person
one Shortcut, and this is the whole set in one place.

Everything below needs a **capture token**, minted at `/account` → One-tap
capture. It reaches exactly one space and can only create notes; it cannot read,
list or search. Losing one costs you nothing but a revoke.

Replace `API` with your capture host (`https://api.jotdojo.com`) and `TOKEN`
with the token, which starts `jd_cap_`.

---

## 1. Jot — the flagship

> "Hey Siri, jot."

    Dictate Text
    Get Contents of URL
      URL:     API/v1/capture
      Method:  POST
      Headers: Authorization = Bearer TOKEN
      Body:    JSON
               text       = Dictated Text
               source     = siri
               request_id = <a UUID action, or omit>
    Show Notification: "Jotted."

Speak. Done. No app opened, no screen unlocked. Apple's on-device dictation does
the work and we receive text, so there is no audio pipeline and no transcription
cost on either side.

**`request_id` is worth the extra action.** Send the same one twice and the
second request is answered `200` with `"deduplicated": true` rather than making
a second note. Without it, a retry over a flaky connection duplicates the
thought — a small betrayal in a capture app.

---

## 2. Send to jotdojo — the share sheet

Set **Show in Share Sheet** on, accepting *Text*, *URLs* and *Images*.

    Receive input from Share Sheet
    If input is an image  →  see "Snap" below
    Otherwise:
    Get Contents of URL
      URL:     API/v1/capture
      Method:  POST
      Headers: Authorization = Bearer TOKEN
      Body:    JSON
               url    = Shortcut Input          (when it is a link)
               text   = Shortcut Input          (when it is text)
               title  = Name of Shortcut Input  (optional, the page title)
               source = share-sheet

Send `url` and `text` as separate fields rather than pasting a link into `text`.
A link sent as `url` gets titled with the site it came from; the same link
pasted into `text` gets titled with two hundred characters of its own query
string, and is unreadable in a list a week later.

---

## 3. Snap — a photo

Three requests, because **the bytes never pass through our API**. On Azure the
photo goes straight to Blob storage with a short-lived URL; our servers only
ever hold the metadata. See `docs/04-data-model.md`.

    Take Photo   (or: Receive images from the share sheet)

    1. Get Contents of URL
       URL:     API/v1/capture/media
       Method:  POST
       Headers: Authorization = Bearer TOKEN
       Body:    JSON
                kind         = image
                content_type = image/jpeg
                text         = <optional: what it is a photo OF>
                source       = shortcut
       → returns note_id, block_id, upload_url, upload_headers

    2. Get Contents of URL
       URL:     upload_url          (from step 1)
       Method:  PUT
       Headers: the upload_headers from step 1
       Body:    File — the photo

    3. Get Contents of URL
       URL:     API/v1/capture/media/BLOCK_ID
       Method:  POST
       Headers: Authorization = Bearer TOKEN
       Body:    JSON
                byte_size = the photo's size in bytes

    Show Notification: "Snapped."

**Put something in `text`.** "van hire receipt" costs two seconds and makes the
photo findable before the recognizer has read it — and findable by what you
called it, which is often better than what is printed on it.

Recognition runs afterwards, on its own. The note exists from step 1, so a
capture interrupted between the steps leaves a visible gap rather than nothing.

---

## Android

None of this is needed. Install the PWA and jotdojo appears in the system share
sheet directly, text and files both — `share_target` in
`apps/web/public/manifest.webmanifest`, handled by `apps/web/app/share/route.ts`.
