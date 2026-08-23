import Link from "next/link";
import { appOrigin } from "@/lib/hosts";

/** The short prose bands: the pain, the price, and the last word. */

const PROBLEM = [
  "The good ones turn up in the car, halfway through a run, ten minutes into"
  + " somebody else's meeting. You get about four seconds and one hand.",
  "So it goes into Apple Notes, or a voice memo, or the back of a receipt — and"
  + " then it sits there. Six weeks later you are fairly sure you wrote something"
  + " about pricing, you cannot find it, and you are no longer certain you did not"
  + " dream it.",
];

const PROBLEM_TURN = "Capturing the thought was never the hard part."
  + " Getting it back out was.";

const COST = [
  "Nothing, for one person, for as long as you like — and free is a plan here"
  + " rather than a trial with a fuse in it. Five dollars a month when you want"
  + " Claude writing back as well as reading. Nine for everyone in the house.",
  "One price for the space, however many people are in it. Nobody counts seats,"
  + " and nothing meters how much you write.",
];

const CLOSING = "No account, no card, nothing to install. Write it in the box at the"
  + " top of this page — it is saved by the time you have finished the sentence.";

export function Problem() {
  return (
    <section className="jd-band">
      <h2 className="font-head">It never arrives at your desk.</h2>
      {PROBLEM.map((para) => <p key={para.slice(0, 24)}>{para}</p>)}
      <p className="jd-turn">{PROBLEM_TURN}</p>
    </section>
  );
}

export function Cost() {
  return (
    <section className="jd-band">
      <h2 className="font-head">What it costs</h2>
      {COST.map((para) => <p key={para.slice(0, 24)}>{para}</p>)}
      <Link className="btn btn-primary" href="/pricing">See the plans</Link>
    </section>
  );
}

export function Closing() {
  return (
    <section className="jd-band jd-band-quiet">
      <h2 className="font-head">Start with the one you nearly lost this morning.</h2>
      <p className="jd-lede">{CLOSING}</p>
      <a className="btn btn-accent" href={appOrigin()}>Start jotting</a>
    </section>
  );
}
