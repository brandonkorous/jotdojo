import Link from "next/link";
import { appOrigin } from "@/lib/hosts";
import { Underline } from "@/components/site/Underline";

/** The short prose bands: the price, and the last word. */

const COST = [
  "Free is a plan here, not a trial with a fuse in it. One person, for as long"
  + " as you like, and nobody asks for a card to begin.",
  "Five dollars a month when you want Claude writing back as well as reading."
  + " Nine covers everyone in the house. One price for the space, however many"
  + " people are in it — nobody counts seats, and nothing meters how much you"
  + " write.",
];

const CLOSING = "No account, no card, nothing to install. Write it in the box at the"
  + " top of this page — it is saved by the time you finish the sentence.";

export function Cost() {
  return (
    <section className="jd-band">
      <h2 className="font-head">
        Simple pricing.{" "}
        <Underline keep>No notebook math</Underline>.
      </h2>
      <div className="jd-prose-2">
        {COST.map((para) => <p key={para.slice(0, 24)}>{para}</p>)}
      </div>
      <Link className="btn btn-primary" href="/pricing">See the plans</Link>
    </section>
  );
}

/** design.md §18.8 gives this section its heading, and it is the better one:
 *  the old close asked the reader to think about a note they had already lost. */
export function Closing() {
  return (
    <section className="jd-band jd-band-ink jd-closing">
      <h2 className="font-head">
        Catch the thought. <Underline>Keep moving</Underline>.
      </h2>
      <p className="jd-lede">{CLOSING}</p>
      <a className="btn btn-primary btn-lg" href={appOrigin()}>Start jotting</a>
    </section>
  );
}
