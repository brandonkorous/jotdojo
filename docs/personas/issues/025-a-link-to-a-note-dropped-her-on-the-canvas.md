# 025 — A link to a note dropped her on the canvas

**Status:** fixed
**Severity:** major
**Found by:** P01 Marisol · the deep-link standing check · 2026-09-16
**Surface:** app › everywhere behind sign-in — `/n/[id]`, `/dashboard`, `/account`
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P01 Marisol · 2026-09-16
**Blocked on:** —

## What happened

The standing check is one sentence: *copy the address of note 6, open it while
signed out, sign in, and confirm she lands back on note 6 rather than on the canvas.*

She landed on the canvas.

```
open  /n/739444fa-d480-4e84-b83f-fb93e316271b   (signed out)
  →   /signin                                    ← no ?next=
sign in
  →   /                                          ← not note 6
```

Note 6 is her 287-character lay-by idea, and act 6 had just established that finding
it again takes two attempts and the right word.

## What should have happened

She lands on the note she asked for.

## Why it matters

**A link to a note is the only way to send anybody to anything in this product.**
The rulebook says so in the standing check itself — *"A note you cannot link to is a
note nobody can be sent to"* — and every realistic use of one starts signed out:

- the address she mailed herself, opened on the laptop
- a note opened on her phone where the session had lapsed
- anything she will ever share, once issue 001 gives her somebody to share with

It is not only notes. `requireActor` guards `/dashboard` and `/account` too, so
**every deep link into the app forgot itself.**

**The sign-in page has always been ready for this.** It reads `?next=`, and
`safeNext` already refuses `//evil.example` and `/\` so it cannot be turned into an
open redirect. The parameter was supported and nothing ever sent one. That is the
*fetched but never rendered* shape, wearing a different hat: the receiving half was
built, tested against attack, and never fed.

## Where it lives

`apps/web/lib/session.ts`:

```ts
export async function requireActor(): Promise<Actor> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  ...
}
```

The guard cannot help: a server component cannot read its own URL, so
`requireActor` genuinely did not know what page had called it.

## The fix

Middleware already runs on every request and does know. It now puts the path on
the request, and the guard reads it back.

**`apps/web/lib/here.ts`** — one constant, with the reason:

```ts
export const PATH_HEADER = "x-jd-path";
```

**`apps/web/middleware.ts`** — set on the request it forwards, on both the app-host
path and the marketing rewrite:

```ts
const request = { headers: new Headers(req.headers) };
request.headers.set(PATH_HEADER, pathname + req.nextUrl.search);
```

`set`, not `append`: a client that sends its own `x-jd-path` has it replaced rather
than trusted. `safeNext` on the sign-in page is the second line of that defence and
is untouched.

**`apps/web/lib/session.ts`** — one helper, used by all three redirects:

```ts
async function signInUrl(opts: { stale?: boolean } = {}): Promise<string> {
  const here = (await headers()).get(PATH_HEADER);
  const query = new URLSearchParams();
  if (here && here !== "/") query.set("next", here);
  if (opts.stale) query.set("stale", "1");
  const q = query.toString();
  return q ? `/signin?${q}` : "/signin";
}
```

`/` is left off deliberately — it is where sign-in lands anyway, and carrying it
would put `?next=%2F` on the address of everybody who simply opened the app.

`?stale=1` still works alongside it, so the "You have been signed out" line from
issue 005 survives and now comes with somewhere to go back to.

## Confirmed by

**P01 Marisol, 2026-09-16.** Signed out from Account, then opened note 6's address:

```
/n/739444fa-d480-4e84-b83f-fb93e316271b
  →  /signin?next=%2Fn%2F739444fa-d480-4e84-b83f-fb93e316271b
sign in
  →  /n/739444fa-d480-4e84-b83f-fb93e316271b
```

**She lands on note 6.** Typecheck and lint clean across all thirteen packages, and
six suites green — `anon site api db search mcp` — including `anon`, which is the
one that exercises the capture path's own `redirect("/signin")`.

## Rating effect

`Sign in` stays 8/8 — nothing about that screen changed, and it was already doing
its half correctly. `A note` keeps its Ease of 7; this was never visible on the note
screen, which is why it took a standing check to find.
