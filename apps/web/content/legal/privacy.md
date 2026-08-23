---
title: Privacy
description: What jotdojo stores, who else ever sees a note, how long anything is kept, and how to take all of it away with you.
updated: 2026-08-22
summary: Your notes are yours. We do not train on them. The only companies that ever see one are the provider that reads your handwriting, voice and photos, and the provider that handles payment — both named below.
---

## Who we are

jotdojo is a note-taking service operated by WizeWorks LLC, of Visalia, California.
We decide how the information described here is handled, and we are the people to
write to about it: **[legal@jotdojo.com](mailto:legal@jotdojo.com)**.

This policy covers `jotdojo.com`, `app.jotdojo.com`, `api.jotdojo.com` and
`mcp.jotdojo.com`.

## What we hold

**The notes you write.** Text, handwriting strokes, voice recordings, photographs,
and the text we derive from the last three so they can be searched and read.

**Who you are.** When you sign in with Google we receive and store a stable
account identifier, your email address, your name, and the URL of your profile
picture. That is the whole of it.

**How your spaces are arranged.** Which spaces exist, who belongs to which, and
what each member is allowed to do.

**What you have let agents do.** Which client you connected, which spaces you
granted it, which permissions you gave, and when.

**A record of every agent action.** One row for each call an agent makes,
including calls that only read. This exists so you can answer the question
"what has it actually done" without taking our word for it.

## What we never hold

**Card details.** Payment is handled by Stripe and card numbers never reach our
servers. We store an identifier for your subscription and nothing more.

**Google passwords or long-lived Google credentials.** We use the sign-in
exchange to learn who you are and we do not keep credentials that would let us
act as you at Google.

**Location data, biometric data, and advertising identifiers.** We collect none
of these.

**Trackers.** There is no advertising network, no analytics script, and no
third-party pixel on any jotdojo page. The only cookies we set are the two
described below.

## Who else sees a note

Three companies, for three specific jobs, and no others.

**Microsoft, via Azure OpenAI, in the `eastus2` region.** This is what turns a
thing you did not type into text you can search:

- voice recordings are transcribed by `whisper`
- handwriting and photographed pages are read by `gpt-4o-mini`
- the text of a note is turned into a search vector by `text-embedding-3-small`
- on Team spaces only, and only when an owner has switched it on, new notes are
  read by `gpt-4o-mini` so the triage agent can flag anything with a date on it

**Stripe**, if you pay us, which receives your payment details directly and tells
us only whether a subscription is active.

**Google**, when you sign in, which tells us who you are.

Nobody else. We do not sell your notes, we do not share them with advertisers,
and we do not hand them to anyone for their own purposes.

## We do not train on your notes

Not our own models, and not anyone else's. We choose recognition providers whose
terms exclude using what we send them to train their models, and that exclusion
is a condition of us using them at all.

## Nothing reads your notes on a schedule unless you asked

Recognition happens because you wrote something and we need to make it legible.
The one feature that reads notes on its own — the triage agent — is available on
Team spaces, is off until an owner turns it on, and stops immediately when it is
turned off, including work already queued.

## Agents, and what they can reach

An agent never has more access than the person who granted it.

- Access is granted **per client and per space**. Connecting Claude to your
  personal space tells it nothing about your family space.
- The consent screen never pre-selects a shared space.
- **Editing your notes is off by default.** An agent that has not been granted it
  can read and comment, and that is all.
- Every grant can be revoked, and revocation takes effect immediately.
- Nothing an agent does is permanent: every change writes a revision, deletion is
  reversible, and you can put a note back the way it was.

## Notes written before you have an account

You can write on `jotdojo.com` without signing in. When you do:

- the note is saved on our servers from the first keystroke, because keeping it
  only in your browser is how notes get lost
- we set a cookie holding an opaque token that identifies the draft space, and
  nothing else
- these spaces accept typed text and handwriting only — no voice, no photographs
  — and nothing is sent for recognition until you claim the space
- an unclaimed draft space is deleted after 30 days
- signing in claims the space you already wrote in; nothing is copied and nothing
  is lost

## Cookies

Two, both strictly necessary, neither used to profile you.

| Cookie | What it does |
|---|---|
| Session cookie | Keeps you signed in after you authenticate with Google |
| `jd_draft` | Identifies a note written before sign-in, so you get it back |

Both are `httpOnly`, which means no script on the page can read them.

## How long we keep things

| What | Kept for |
|---|---|
| Notes and their original recordings, photos and strokes | Until you delete them |
| A note you deleted | 30 days, then purged for good |
| Earlier versions of a note | As long as the note exists |
| A draft space nobody claimed | 30 days |
| The record of agent actions | 12 months |

## Taking it with you, and deleting it

**Export** is available at any time from your account page, and gives you a zip
of markdown files plus the original recordings and images. Markdown because it
opens in anything — an export you cannot read is not an export. Handwriting
comes out as SVG, which is the strokes you drew rather than a picture of them.
You can also save a single note, or just a drawing on one, straight from the
canvas.

**Deletion means deletion.** Deleting a space removes its stored files, not only
the rows that point at them. After the 30-day window a deleted note is gone and
we cannot recover it for you.

You can ask us to show you what we hold about you, correct it, or delete all of
it, by writing to **[legal@jotdojo.com](mailto:legal@jotdojo.com)**. We will answer within 30 days.

Depending on where you live you may also have the right to object to processing,
to ask us to restrict it, or to complain to your national data protection
authority. Ask us and we will tell you plainly which of these apply to you rather
than making you work it out.

## Where your data is

Your notes are stored on Microsoft Azure in the East US region, in the United
States. Handwriting, voice recordings and photographs are sent to Azure OpenAI in
the `eastus2` region named above to be read, so the content of those notes is
processed there under that provider's terms.

If you are outside the United States, using jotdojo means your notes are stored
and processed in the United States.

**We do not offer data residency guarantees.** If where a note is processed
matters to you contractually, jotdojo is not the right tool.

## Children

jotdojo is not directed at children under 13, and we do not knowingly create
accounts for them. A shared space belongs to the adult who owns it, and an adult
who invites a child into their family space is responsible for what that child
writes there. If you believe a child under 13 has an account, write to us and we
will remove it.

## What this service is not built for

Being clear about this protects you more than it protects us. jotdojo has no
HIPAA compliance and we will not sign a business associate agreement. There is no
SOC 2 report, no data residency guarantee, and no single sign-on. **Do not put
clinical records, legally privileged material, or anything else you are obliged
to protect into jotdojo.** If you need those things, use something built for them.

## If something goes wrong

If your notes are exposed, we will tell you what happened, what was affected and
what we are doing about it — quickly, and in plain words. We would rather be
judged for having an incident than for hiding one.

## Changes

If we change this policy we will update the date at the top, and we will tell you
before a change that affects how your notes are handled takes effect. We will not
quietly widen what we are allowed to do with them.

## Contact

**[legal@jotdojo.com](mailto:legal@jotdojo.com)** for anything about your privacy
or this policy, or [hello@jotdojo.com](mailto:hello@jotdojo.com) for anything
about your account.

WizeWorks LLC, Visalia, California.
