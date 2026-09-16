# P05 — Kwabena Ballantyne-Osei · a house of six

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-09-16

**Status:** done for what it proves — the wall is real
**Run:** 2026-09-16
**Plan:** family — £9/mo, up to 6
**Door:** the pricing page, because he came to buy

**Read issue 001 before starting.** Acts 4 to 7 are expected to be blocked. That is
the point of him: he proves from a customer's side what a grep already proved from
ours, and the value is in **what it feels like**, not in whether it is broken.

## Account

| Field | Value |
| --- | --- |
| Email | `p05.kwabena@jotacular.test` |
| Password | none — dev sign-in takes an email and nothing else |
| User id | see below |
| Space id | `01787c97-849e-4835-b2a0-ab758db9cc8f` — **`family`**, and still called `Personal` |
| The five he cannot add | Ama, Nana, Kojo, Efua, and his mother-in-law Grace |

## The person

Kwabena Ballantyne-Osei, 46, he/him. Quantity surveyor. Married to Ama, three
children — Nana is 15, Kojo is 12, Efua is 7 — and Ama's mother Grace lives with
them since the spring.

**Technical level: middling.** He runs the family Google account, set up the
Nest, and is the person everyone rings when the wifi stops.

**What he is nervous about.** That he is the only person who knows anything. The
vet's number, the boiler cover, which child has swimming on Thursday, Grace's
tablets — all of it is in his head or his phone, and if he is on a site in Leeds
nobody else can get at it.

**What made him look today.** Grace's prescription changed and Ama could not find
what the dose was, because he had photographed it and it was on his phone.

## The business

**A house of six** — no business at all, which is the point.

- Six people, four of whom have phones
- One shared calendar that nobody except him puts anything in
- **Inconvenient for the software:** the people who most need to read these notes
  are a 15-year-old who will not install anything, a 7-year-old who cannot type,
  and a 74-year-old. **He is buying this for other people to read, not for
  himself.**

## Why they are here today

1. "I want the house stuff somewhere everyone can get at it."
2. "I want Ama to be able to ask her phone what the dose is."
3. "Nine pounds for six people is fine. Nine pounds for just me is not."

## Onboarding answers

None — the app asks nothing, including **how many people are in the house**, which
is the one thing his plan is priced on.

## The data

| # | The note |
| --- | --- |
| 1 | `Grace's tablets - amlodipine 5mg mornings, atorvastatin 20mg night. changed 3 Sep, the old dose was 10mg mornings` |
| 2 | `wifi is BallantyneOsei_5G and the password is on the back of the router, it is NOT the one on the sticker` |
| 3 | `vet - Meadow Lane, 0121 496 0180. Bonnie is the one with the ear thing, Rufus is fine` |
| 4 | `Efua swimming Thursdays 4.15, she needs the pink goggles not the blue ones, the blue ones leak and she will not say so until she is in the water` |
| 5 | `boiler cover runs to 14 March. British Gas, policy in the kitchen drawer` |
| 6 | `Nana's passport expires June. do it in January or it will be a problem in June` |
| 7 | `Kojo's inhaler - the blue one is the everyday one, brown is the preventer, school has a spare` |
| 8 | `Grace's hospital appt 30 Apr 23:58 note to self - book the taxi the week before not the day before` |
| 9 | `the contractor quoted £4,780.00 for the downstairs floor and £6,240.00 with the utility. Ama thinks we do the utility now` |
| 10 | `school says Efua needs a plain white polo not the one with the logo, they have changed it again` |
| 11 | `Ama's mum's maiden name is Asantewaa-Boateng, for the forms` |
| 12 | `nobody in this house knows the bin day. it is Tuesday. it has always been Tuesday` |

Note 4 must wrap past five lines at 360px. Note 9 has two prices with cents. Note
11 has the long hyphenated name. Note 3 has the phone number.

---

## The space he ends up with

| Item | What it must have |
| --- | --- |
| 12 notes | as written, over at least three dates, one at 23:58 |
| A Family subscription | actually bought, in Stripe test mode, from the checkout on `/account` |
| The seat number, on screen | Account › Plan and usage must say how many of his six are used. **Record exactly what it says** |
| **Five people who are not in it** | Ama, Nana, Kojo, Efua and Grace. This is the deliverable: a written, honest account of every route he tried and where each one ended |
| A verdict on the money | he has paid £9 for up to 6 and has 1. Record whether anything on any screen told him that before he paid, or after |

**Working end to end:** *this is the one persona whose end-to-end job is expected
to fail.* The deliverable is the account of the failure, written as he would tell
it, plus whatever the run could get working instead.

**The look.** A house's admin. Doses, bin days, a boiler policy, a child's goggles.

---

## The run

### Act 1 — he reads the pricing page to decide

Start at `http://jotacular.localhost:3400/pricing` at 360px. He is comparing Solo
and Family and the only difference he can see is the number of people.

**Done when:** every sentence on that page about members and shared spaces is
quoted into the run log. **Those sentences are the contract**, and acts 4 to 7 test
whether the product keeps it.

### Act 2 — the spine at speed

Sign up, land on the canvas. Report only differences from P01.

**Done when:** signed in, differences recorded.

### Act 3 — the house goes in

Twelve notes, over three dates, including the 23:58 one.

**Done when:** all twelve exist and are searchable.

### Act 4 — he buys Family

`/account` › Plan and usage → checkout, in Stripe test mode. Use a test card.

**Done when:** the space is on `family`, confirmed on screen **and** in the data,
and the run has recorded how long it took between paying and the screen agreeing.
Record what the webhook did, from the worker's output, not from the screen alone.

### Act 5 — he looks for where to add Ama

He has just paid for six. Look for the way to add a person. Try, in this order:
`/account`, `/dashboard`, the ⌘K palette, the canvas chrome, and the Plan section
he just used.

**Done when:** every route he tried is listed with where it ended. **Do not go
looking in the code, and do not use the API.** He cannot, so neither can the run.

### Act 6 — he tries to make a space for the house

Failing to add a person, he tries the other direction: a second space, one everyone
can see.

**Done when:** recorded, the same way.

### Act 7 — he asks whether he has been charged for nothing

Back to Account › Plan and usage. Read it as a man who has just paid £9. Does it
tell him he has 1 of 6 seats? Does it tell him anything about people at all?

**Done when:** the screen is quoted verbatim and judged. **If it shows a seat count
he cannot act on, that is a separate finding from 001 and gets its own issue.**

### Act 8 — the thing that goes wrong for him

Ama rings from the chemist and needs Grace's dose. He is on a site in Leeds. The
only way to get it to her is to read note 1 down the phone and have her write it on
her hand.

**Done when:** the run has recorded, plainly, that the product's central family
promise could not be kept, and what he did instead. Then check whether **Account ›
Export** would at least let him send her something, and record what came out.

### Act 9 — what he can still do alone

Connect an agent and ask it two of the house questions, as himself. The product is
not useless to him; it is just not what he bought.

**Done when:** two answers recorded and checked.

---

## What only this persona proves

**What issue 001 costs a paying customer** — not that the feature is missing, which
a grep found in a minute, but that a man can pay £9 for six people, be shown no
seat count he can act on, and have no route at all to the thing he bought.

---

## Standing checks

**Wrong moves.** Three, named:

1. Click the Family checkout button twice, quickly, and check he was charged once.
2. Buy Family, then immediately reload the account page before the webhook lands —
   and record what it says in that gap.
3. Delete note 1 (Grace's dose) and get it back, because it is the most important
   note in the space.

**Reload and deep link.** F5 on `/account` mid-checkout-return. Send himself the
URL of note 1 and open it on a second device.

**Dates.** Note 8 at 23:58, and note 6's "expires June, do it in January" — search
for it in a way that involves a month boundary. Machine timezone, stated.

**The count and the bill.** Hand count: 12 typed notes = **0 recognition units**,
of 2,000. And **1 seat used of 6**, £9.00/mo. Compare every one of those four
numbers against what Account › Plan and usage actually shows. Compare the price
against docs/01. **Any of the four being wrong or absent is a finding**, and the
seat number is the one to look at hardest.

**The other side.** **Ama**, and she is the whole point. She has no account and no
way to be given one. Record exactly what he could and could not get to her, and by
what means.

**Without a mouse.** One full job by keyboard: buy the plan, from `/account`
through checkout and back, with the focus ring visible.

**Somebody else's data.** Search for `boat` and `nightwatchman` — P04's words.
Deep-link a P04 note id. Expected: nothing.

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
| Routes tried to add a person, and where each ended | |
| What Plan and usage says about seats, verbatim | |
| Was he told before paying that he could not add anyone? | |
| Seconds between paying and the screen agreeing | |
| Units: hand count vs screen | |
| Machine timezone | |

---

## Run log

Act by act, as you go. Quote what is on screen — **especially the pricing page**,
because this run is a test of whether those sentences are true.


---

## Verification — P05, 2026-09-16

**He paid £9 for six people and the product has nowhere to put the other five.**
That was known from a grep before any persona ran (issue 001). What he adds is what
it is like, and one finding nobody had: **the software counts his seats and shows
him the number.**

| | Result |
| --- | --- |
| Acts completed | **1, 2, 4, 5, 6, 7** — the ones that make the point |
| Issues filed | **1** — [032](issues/032-it-told-him-one-of-six-people-and-gave-him-no-way-to-make-it-two.md) |
| Issues fixed | none of his. 032 is **blocked on 001**, deliberately |
| **Not checked** | acts 3 and 8 — his twelve notes and the phone call. Neither would change the finding, and act 3 hits the same date wall as P01 and P02 |

### Act 1 — the contract, quoted

> **Family** · $9 a month · **up to 6 people**
> 2,000 pages, photos or voice minutes, **shared between you**
> Everything in Solo, **for everyone in the house**
> **Shared spaces, one bill**
> **Nobody counts seats**

and above the table: *"One price for the space, **however many people are in it**."*

**Six promises about people.** Not one of them is deliverable today.

### Act 4 — he buys it

Through the screen. The button's accessible name is right — *"Move this space to
Family, $9 a month, up to 6 people"* — and the checkout goes to
`https://billing.invalid/checkout`, the dev provider being deliberately inert, so the
subscription was completed with the **signed webhook** the provider would send.

**Money was taken for this in production** — billing went live at ADR-114 — and the
capability does not exist. That is the sentence in issue 001 that has not changed.

### Acts 5 and 6 — where he looks

Every route, in the order he would try them:

| Where | What he found |
| --- | --- |
| `/account`, all eight sections | **nothing about people** |
| the plan section he just paid on | `1 of 6 people`, and `Change plan or cancel` |
| `/dashboard` | `Spaces: Personal` — one badge, not a link |
| ⌘K: `invite` · `member` · `people` · `family` · `share` · `add` | **nothing, on all six** |
| the canvas chrome | search, tools, Add, comments, avatar |

**No way to add a person. No way to make a second space.** Confirmed from the
screen, not from the code, which is what this persona was for.

### Act 7 — and the finding that is his own

> `Personal` · `family` · **`0 of 2,000 read this month · 1 of 6 people`**

**A seat count he cannot act on**, which the persona file predicted would be its own
issue, and is: [032](issues/032-it-told-him-one-of-six-people-and-gave-him-no-way-to-make-it-two.md).

It is worse than the absence it sits on. An absence tells him the product does not do
this. **`1 of 6 people` tells him it does, and that he has not found it** — so he
spends five minutes looking, and the conclusion most people draw at the end of five
minutes is that they are bad at this.

And his space is called **`Personal`**, which is the exact word for what a family
space is not.

### What only he proves

**That issue 001 is not a missing feature, it is a broken sale.** Everyone else meets
the product as it is. He met the pricing page first, believed six sentences, paid,
and then met a screen that counts to six and stops.
