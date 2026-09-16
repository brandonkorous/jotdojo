# 031 — Every photo and every voice note failed in the browser

**Status:** fixed
**Severity:** major
**Found by:** P04 Priya · act 4 · 2026-09-16
**Surface:** canvas › Add › Photo · canvas › Add › Voice note — in local development
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P04 Priya · 2026-09-16
**Blocked on:** —

## What happened

Priya photographs whiteboards. It is one of her two capture modes and the second
reason she is here — *"I take a photo of the whiteboard and then never look at it
again."*

She tapped ⊕ › **Photo**, chose a 1200×800 PNG, and the canvas said:

> ● **That photo did not upload — it is still on your device**

It did not upload. Nor would any photo, or any voice note, from any browser, in
local development.

## The cause

The app is on `localhost:3400`. The signed upload URL points at the API on
`localhost:3401`. **That is cross-origin**, and a `PUT` carrying
`content-type: image/png` is not a CORS-safelisted request — so the browser sends a
preflight first.

**The API had no CORS at all.** No `@fastify/cors`, no `Access-Control-*` header
anywhere, and no `OPTIONS` route. Measured on the wire:

```
OPTIONS /v1/media/…/134788cb….png   →  404
PUT     /v1/media/…/134788cb….png   →  503
```

The preflight 404s, so the browser refuses to send the upload, and the app correctly
reports that the photo never left the device.

## Why it went unnoticed

`pnpm media:smoke` is green. So are `api:smoke` and `db:smoke`.

**None of them uses a browser.** They call the domain layer directly, or they PUT
from Node, which does not preflight. The whole media pipeline — reserve, sign, PUT,
finalize, recognize, meter, render, export — is correct and tested, and the one step
that only a browser performs was the one nobody performed.

This is the reason `verify-ui-in-a-browser` is a standing rule, and it is the
cleanest instance of it in this exercise: **two of the product's four advertised
capture modes** — *Snap* and *Speak*, both sold by name on the apex — **have never
worked from the UI on this machine**, under a full board of green.

## What this does and does not say about production

**Local development: broken, now fixed.**

**Production: not checked, and not fixed by this.** `media.ts` is registered only
when `STORAGE_PROVIDER=local`, and its own comment says why:

> On Azure the browser PUTs straight to Blob with a SAS URL and none of this
> exists — docs/04 is explicit that media bytes must never be proxied through the
> API, and this is the development-only exception, not a fallback.

So in production the same preflight goes to **Azure Blob**, which has its own CORS
rules set in infra rather than in this repo. **Whether that container allows a PUT
with `content-type` from the app's origin is not something this run can see.** It is
worth checking before the next deploy, because the failure would look exactly like
this one: a green board and no photographs.

## The fix

CORS by hand, on the dev-only route, scoped to the app's origin. **No new
dependency** — `@fastify/cors` would change a lockfile shared with other sessions,
and fifteen lines of headers are proportionate to a route that does not exist in
production:

```ts
const allowFrom = (reply) => {
  reply.header("access-control-allow-origin", appOrigin);
  reply.header("access-control-allow-methods", "PUT, GET, OPTIONS");
  reply.header("access-control-allow-headers", "content-type");
  reply.header("access-control-max-age", "600");
};

app.addHook("onSend", async (request, reply) => {
  if (request.url.startsWith("/v1/media/")) allowFrom(reply);
});

app.options("/v1/media/*", async (_request, reply) => reply.code(204).send());
```

`appOrigin` is `APP_URL`, which the API already reads. The hook is filtered to
`/v1/media/` so the Shortcut capture endpoints — server-to-server, ADR-064, no
browser involved — are untouched.

## Confirmed by

**P04 Priya, 2026-09-16.** The preflight, on the wire:

```
HTTP/1.1 204 No Content
access-control-allow-origin: http://localhost:3400
access-control-allow-methods: PUT, GET, OPTIONS
access-control-allow-headers: content-type
```

Then the same photo, through the same menu: **it is on her canvas**, rendered at the
right size, and stored:

```
kind  | transcript_state | mime_type | byte_size | width | height
image | pending          | image/png |      6013 |  1200 |    800
```

## One thing the failure left behind

The failed attempt left a **row with no bytes**: an `image` block and a
`media_assets` row with `byte_size`, `width` and `height` all null, sitting on her
note forever. It does not render, so she never sees it — and `app_claim_recognize_jobs`
handles it correctly, completing the job rather than retrying, because its comment
already anticipated *"an image or audio block whose bytes never arrived"*.

So it is harmless today and it is still litter: a reserve that is never finalized
leaves a permanent phantom. Not filed separately — it only happens when an upload
fails, which is now much rarer — but it is the kind of thing that accumulates, and
issue 013 means nobody can delete the note it sits on.

## Rating effect

`canvas › Photos` can be scored for the first time, because for the first time a
photo can be put on a page. It is scored in P04's run.
