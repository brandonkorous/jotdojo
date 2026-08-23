/**
 * Not another notes workspace. design.md §18.5.
 *
 * What this replaced was a competitive argument -- Obsidian needs a plugin,
 * Apple Notes needs a script, all of them need a machine left on. True, and the
 * wrong fight: it described other people's software to somebody who has not
 * decided they want any of it.
 *
 * The objection a reader actually has is that they already own three of these
 * and use none of them. So answer that.
 */

const HEADING = "You have tried the other ones.";

const BODY = [
  "There is a note-taking app on your phone right now with four things in it,"
  + " two of them from 2023. It is not a bad app. It asked you to keep a system"
  + " going, and systems are a thing you maintain on a good week.",
  "Jotacular does not ask. There is no folder to choose before you write, no"
  + " title to invent, no place this is supposed to go. You write it and you"
  + " leave.",
];

const TURN = "Filing was never what made a note worth keeping. Finding it again was.";

const NEVER_HEADING = "So a short list of what it will never grow into";

const NEVER = [
  "No filing before you can write",
  "No folder trees, no databases, no formulas",
  "No graph view, no backlinks, no daily-note methodology",
  "No due dates. A note is not a task",
];

const NEVER_FOOT = "A place to put things, not a system to maintain. Keep the system"
  + " you already have — this sits beside it and hands your agent the part you"
  + " scribbled.";

export function Objection() {
  return (
    <section className="jd-band">
      <h2 className="font-head">{HEADING}</h2>
      <div className="jd-prose-2">
        {BODY.map((para) => <p key={para.slice(0, 24)}>{para}</p>)}
      </div>
      <p className="jd-turn">{TURN}</p>

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
