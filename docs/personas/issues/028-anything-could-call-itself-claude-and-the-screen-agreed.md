# 028 — Anything could call itself Claude, and the consent screen agreed

**Status:** fixed
**Severity:** major
**Found by:** P03 Tomás · act 8 · 2026-09-16
**Surface:** app › Let this agent in (`/oauth/authorize`)
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P03 Tomás · 2026-09-16
**Blocked on:** —

## What happened

Jotacular supports open dynamic client registration, which MCP requires — anybody
may `POST /oauth/register` and get a `client_id`. The registration decides its own
`client_name`, and **nothing checks it**.

So this was registered, in one request, with no credential of any kind:

```json
{ "client_name": "Claude",
  "redirect_uris": ["http://jotacular.localhost:3400/not-claude-at-all"] }
```

And the consent screen it produced was **identical**, word for word, to the real
Claude's:

> **Claude wants access to Jotacular**
>
> It will be able to
> ☑ read your notes
>
> In these spaces
> ☑ Personal
>
> **[ Allow ]**  Cancel
>
> You can revoke this at any time from Account. Nothing an agent does to your notes
> is permanent.

**Nowhere on that screen does it say where the notes are going.** The only identity
a person is shown is a string the requester chose for itself thirty seconds earlier.

## Why it matters

This is the highest-consequence button in the product. One tap on it grants an agent
everything somebody has ever written, and issue 018 was filed because that button is
worth protecting from a frame. It is worth protecting from a name too.

The attack is ordinary. Register as `Claude`, or `Jotacular Backup`, or `Notion`,
put a real-looking install button in a blog post or a support email, and the victim
lands on **jotacular's own domain**, on a screen that looks exactly right, with a
brand they trust at the top of it. Everything on that page is genuine except the one
word that decides whether they press Allow.

**The information that would have stopped it was already in the URL.** The
`redirect_uri` is checked against what was registered — `redirectUriIsRegistered`
does exact matching, and that part is right — so it is the one fact on the page
nobody can forge. It simply was not shown.

## What was already right

Recorded so the fix is not mistaken for a rescue:

- **PKCE with S256 is required.** No `plain`, no omission.
- **The redirect must match exactly** what the client registered, so the code cannot
  be diverted to a second address after the fact.
- **`resource` is required and audience-bound** (issue 020), so a stolen token only
  works against the server it was minted for.
- **`client_id` may be an https URL** — a Client ID Metadata Document, fetched from
  the client's own origin. **That name IS attested**, because it comes from the
  domain rather than from the request.

The gap is only the self-registered case, and only in what the screen said about it.

## The fix

The screen now names the destination, and says how much it knows about it:

```tsx
{/* The NAME is whatever the client called itself when it registered, and
    anything may register. The address is the one fact nobody can forge:
    it is where the key goes, and it is checked against what was
    registered. Issue 028. */}
<p className="mt-3 text-sm opacity-70">
  It will be sent to <strong>{hostOf(redirectUri)}</strong>
  {cimd ? ". That address verified the name above."
        : ". Jotacular has not checked who owns that address."}
</p>
```

Three deliberate choices:

- **The host, never the whole URL.** A path is where a phisher hides something that
  reads like a brand — `evil.example/claude.ai/connect` — and the host is the part
  that is actually checked.
- **It says what it does not know.** *"Jotacular has not checked who owns that
  address"* is the honest sentence, and it is the rulebook's rule about absence
  applied to a security screen: do not imply verification that did not happen.
- **A Client ID Metadata Document gets the better sentence** — *"That address
  verified the name above"* — because for `https://` client ids the name really did
  come from the domain. The screen stops flattening two different levels of proof
  into one.

## Confirmed by

**P03 Tomás, 2026-09-16.** The same forged registration, same URL:

> **Claude** wants access to Jotacular
>
> It will be sent to **jotacular.localhost:3400**. Jotacular has not checked who owns
> that address.

A person reading that can see that "Claude" is sending their notes somewhere that is
not Claude. Four suites green afterwards — `oauth`, `oauth:http`, `mcp`, `api`.

## What is still worth considering, and is not done here

**A name is still a name.** Showing the host helps somebody who knows what
`claude.ai` should look like; it does not help somebody who does not. The stronger
answers are Brandon's to weigh:

- **Prefer Client ID Metadata Documents** and say so — the screen could rank an
  attested client above a self-registered one visually, not only in a sentence.
- **A known-clients list** for the handful that matter (Claude, ChatGPT), shown with
  a mark the way verified app directories do.
- **Rate-limit `/oauth/register`.** Nothing here stops a thousand registrations, and
  every one of them is a row.

## Rating effect

`Let this agent in` holds 8/8. It was 8/8 before this too — which is the
uncomfortable part, and the reason the gap column now names it. The screen was well
made and well worded throughout; it was missing a fact, not a coat of paint.
