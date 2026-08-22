import type { Metadata } from "next";
import { appOrigin } from "@/lib/hosts";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Free for one person, and free does not expire. Five dollars a month if you want "
    + "Claude writing back as well as reading, nine for the whole household. One price "
    + "for the space, however many people are in it.",
  alternates: { canonical: "/pricing" },
};

type Plan = {
  name: string;
  price: string;
  cadence: string;
  who: string;
  /** What the plan will READ each month. Spelled out rather than counted in
   *  "units": nobody buys a unit, and the word explains nothing on the card
   *  somebody is actually deciding from. */
  reads: string;
  lines: string[];
  feature?: boolean;
};

const PLANS: Plan[] = [
  {
    name: "Free", price: "$0", cadence: "forever", who: "you",
    reads: "100 pages, photos or voice minutes read each month",
    lines: [
      "As many notes as you like, typed or handwritten",
      "Search that finds your handwriting too",
      "Claude and ChatGPT can read your notes",
      "One-tap capture from your phone with Siri",
    ],
  },
  {
    name: "Solo", price: "$5", cadence: "a month", who: "you",
    reads: "1,000 pages, photos or voice minutes read each month",
    lines: [
      "Everything in Free",
      "Claude can add to your notes and comment on them",
      "Enough voice notes and photos to actually use them",
    ],
    feature: true,
  },
  {
    name: "Family", price: "$9", cadence: "a month", who: "up to 6 people",
    reads: "2,000 pages, photos or voice minutes, shared between you",
    lines: [
      "Everything in Solo, for everyone in the house",
      "Shared spaces, one bill",
      "Nobody counts seats",
    ],
  },
  {
    name: "Team", price: "$19", cadence: "a month", who: "up to 5 people",
    reads: "10,000 pages, photos or voice minutes, shared between you",
    lines: [
      "Everything in Family",
      "Everyone's own Claude reads what the company knows",
      "An agent that reads new notes and flags what has a date on it",
    ],
  },
];

export default function Pricing() {
  return (
    <main className="jd-site-main">
      <section className="jd-band">
        <h1 className="font-head">Pricing</h1>
        <p className="jd-lede">
          One price for the space, however many people are in it. Free is a real plan
          rather than a trial, and it does not run out.
        </p>

        <div className="jd-plans">
          {PLANS.map((plan) => (
            <article key={plan.name} data-feature={plan.feature ? "true" : undefined}>
              <h2 className="font-head">{plan.name}</h2>
              <p className="jd-plan-price">
                <strong>{plan.price}</strong> <span>{plan.cadence}</span>
              </p>
              <p className="jd-plan-who">{plan.who}</p>
              <p className="jd-plan-reads">{plan.reads}</p>
              <ul>
                {plan.lines.map((line) => <li key={line}>{line}</li>)}
              </ul>
            </article>
          ))}
        </div>

        {/* Every plan starts the same way: you write something first. There is
            no checkout without an account, so a "buy" button per card would be
            a door into a sign-in screen wearing a price tag. */}
        <p className="jd-plan-cta">
          <a className="btn btn-primary" href={appOrigin()}>Start writing</a>
          <span>Free, no card. Pick a plan from your account whenever you want one.</span>
        </p>

        <p className="jd-fineprint">
          More than five people on a team? Write to us and we will sort something out.
        </p>
      </section>

      <section className="jd-band jd-band-quiet">
        <h2 className="font-head">What counts as a read</h2>
        <p>
          One page of handwriting read, one photo read, or one minute of audio written
          down. That is the part with a limit on it.
        </p>
        <p>
          <strong>Your notes never have one.</strong> Write as many as you like, as long
          as you like, in as many spaces as you like. Nobody should have to think about
          whether a thought is worth the storage.
        </p>
        <p>
          If you do run out, nothing is lost. The page you drew and the voice note you
          left are both still there, and they are read the moment the month turns over.
        </p>
      </section>

      <section className="jd-band">
        <h2 className="font-head">Why free can read but not write</h2>
        <p>
          Letting Claude read your notes costs us almost nothing, so you can do it for
          as long as you want without paying us. Letting it add to them, comment on them
          and tidy them up costs us money every single time. That is the part you are
          paying for.
        </p>
        <a className="btn btn-primary" href={appOrigin()}>Start jotting</a>
      </section>
    </main>
  );
}
