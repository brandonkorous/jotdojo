# 018 — The consent screen could be drawn inside somebody else's page

**Status:** fixed
**Severity:** minor
**Found by:** P01 Marisol · act 7 · the framing check · 2026-09-16
**Surface:** app › Let this agent in (`/oauth/authorize`)
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P01 Marisol · act 7 · 2026-09-16
**Blocked on:** —

## What this is, and what it is not

**Read the measurement before the severity.** This is a missing control, not a hole
somebody could have walked through today. It is filed because the control is
required, and fixed because the fix is three lines — not because anything was
exploitable. Saying otherwise would be exactly the overstatement RULE #4 forbids in
the other direction.

## What happened

`/oauth/authorize` is the screen where one tap grants an agent everything a person
has ever written. Read from the live server, it sent no framing headers at all:

```
cache-control, connection, content-encoding, content-type,
date, keep-alive, link, transfer-encoding, vary, x-powered-by
```

No `X-Frame-Options`. No `Content-Security-Policy`. Nothing on either host, on any
route — which is how this run noticed: the whole persona harness drives jotacular
inside a same-origin iframe, and it has never once been refused.

So an attacker's page could put the consent screen in an invisible frame under a
"download the free templates" button, and the tap that downloads nothing would be
the tap on **Allow**.

## Why it did not work anyway

Built the attack and ran it. A page on `http://jotacular.localhost:3400` — a
genuinely different origin — framing `http://localhost:3400/oauth/authorize`:

**The frame loaded. It showed the sign-in screen.**

The session cookie is `SameSite=Lax`:

```
set-cookie: authjs.csrf-token=...; Path=/; HttpOnly; SameSite=Lax
```

A cross-site iframe does not get a `Lax` cookie, so the framed page had no session,
so `/oauth/authorize` sent it to sign in, so **there was no Allow button to
clickjack**. The attack fails in a current browser.

**That is a default, not a defence.** Auth.js chose `Lax`; nothing in this repo
decided it, nothing tests it, and nothing would notice it changing. A deployment
that ever needs `SameSite=None` — an embed, a cross-site widget, a payment return
flow — would silently hand the whole attack back.

RFC 9700, the OAuth 2.0 Security Best Current Practice, asks for the authorization
endpoint to be un-framable on its own terms rather than by a side effect elsewhere.

## The fix

Three lines in `apps/web/middleware.ts`, on that one path:

```ts
const NO_FRAME = /^\/oauth\/authorize/;

function neverFramed(res: NextResponse): NextResponse {
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  return res;
}
```

called first in `middleware`, before the marketing-host rewrite, so it applies on
both hosts.

Both headers on purpose: `frame-ancestors` is the standard and wins where it is
understood, `X-Frame-Options` is what older browsers and some corporate proxies
still read.

## Confirmed by

**P01 Marisol, act 7, 2026-09-16.** Three checks:

| | |
| --- | --- |
| Headers on `/oauth/authorize` | `x-frame-options: DENY` · `content-security-policy: frame-ancestors 'none'` |
| Headers on `/dashboard` | none — nothing else changed |
| **Same-origin** frame of the consent screen, signed in | **refused.** `contentDocument` is null and Chrome draws its blocked-frame placeholder |

The same-origin test is the strict one: it has the session cookie, so `SameSite`
cannot be what stopped it. The header is.

## What is deliberately NOT fixed

**The rest of the app is still framable**, and that is a decision rather than an
oversight:

- Nothing else in jotacular is a one-click grant of anything. The canvas, the
  dashboard and the account page all need a session, which a cross-site frame does
  not get, and inside a same-site frame the person is already themselves.
- **The persona harness frames the app on purpose.** A real 360px viewport is not
  reachable by resizing in Chrome, so `docs/personas/CLAUDE.md` prescribes an iframe
  — and seven more runs depend on it. A blanket `frame-ancestors 'none'` would end
  this exercise to close a gap that is not open.

If you want a site-wide policy, `/signin` is the next most valuable path and the
one that would hurt the harness least. It is worth doing deliberately, with the
harness moved to a headless viewport first, rather than as a side effect of this.

## Also seen on this screen, and not filed

The consent screen with a missing `client_id` says:

> **Missing client_id or redirect_uri** — Nothing was granted. You can close this page.

That is right, and rare: it names what is wrong, tells the reader nothing happened
to them, and does not ask them to do anything they cannot do.

## Rating effect

`Let this agent in` is scored in act 7. This does not move the number — nothing on
the screen looked or behaved differently before and after.
