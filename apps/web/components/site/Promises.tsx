import { Underline } from "@/components/site/Underline";

/**
 * Privacy and control. design.md §18.6.
 *
 * The old version of this promised three things about the software. These
 * promise three things about who else gets to read your notes, which is the
 * question a person actually has once they understand an agent can reach them.
 */

const PROMISES = [
  {
    title: "Your notes are yours",
    body: "Export every one of them, any time, as markdown that opens anywhere."
      + " Leaving is a supported operation, not a support ticket.",
  },
  {
    title: "You choose what connects",
    body: "Nothing reaches your notes until you say so, per space and per agent."
      + " Revoke it and it is gone the same second.",
  },
  {
    title: "Nothing reads them on a schedule",
    body: "Not unless you switched it on yourself. This is a place to put things,"
      + " not an AI quietly reading everything you write.",
  },
  {
    title: "Nothing is rewritten behind your back",
    body: "When an agent adds something it says so, in its own colour, with its"
      + " name on it. One tap puts the note back.",
  },
];

export function Promises() {
  return (
    <section className="jd-band">
      <h2 className="font-head">
        Yours, and <Underline>only</Underline> yours
      </h2>
      <p className="jd-lede">
        Connecting an agent is a decision you make once, and unmake in a second.
      </p>
      <div className="jd-cards">
        {PROMISES.map((promise) => (
          <article key={promise.title}>
            <h3 className="font-head">{promise.title}</h3>
            <p>{promise.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
