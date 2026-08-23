/**
 * The objection a reader actually has, answered plainly.
 *
 * This is docs/00-vision.md's competitive position in the user's language: the
 * ecosystem is real, it is local, and local is unavailable from a phone.
 */

const HEADING = "Every other version of this needs a computer left on.";

const BODY = [
  "Obsidian can do it through a plugin. Apple Notes can do it through a script."
  + " Amplenote runs it out of its desktop app. All three mean the same thing by"
  + " Friday: a machine at home, awake, plugged in, logged in, and not asleep in a"
  + " bag at the airport.",
  "If your notes live on your phone — and they do, because your phone is what you"
  + " were holding when you had the thought — none of that ecosystem is available"
  + " to you.",
  "jotdojo is a website and a server. There is nothing to leave running, because"
  + " the thing that is running is ours.",
];

const NEVER_HEADING = "And a short list of what it will never grow into";

const NEVER = [
  "No graph view, no backlinks, no daily-note methodology",
  "No nested page trees, no databases, no formulas",
  "No due dates. A note is not a task",
  "No chat window bolted to a list of notes",
];

const NEVER_FOOT = "A place to put things, not a system to maintain. If you already"
  + " have the system, keep it — this sits beside it and hands your agent the part"
  + " you scribbled.";

export function Objection() {
  return (
    <section className="jd-band">
      <h2 className="font-head">{HEADING}</h2>
      {BODY.map((para) => <p key={para.slice(0, 24)}>{para}</p>)}

      <div className="jd-never">
        <h3 className="font-head">{NEVER_HEADING}</h3>
        <ul>
          {NEVER.map((line) => <li key={line}>{line}</li>)}
        </ul>
        <p>{NEVER_FOOT}</p>
      </div>
    </section>
  );
}
