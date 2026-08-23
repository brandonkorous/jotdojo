import { Bot } from "lucide-react";

/**
 * The proof section. A note as it was jotted, and what an agent made of it.
 *
 * Human ink is sumi, agent ink is `agent` (docs/10-design-system.md). The
 * colour is the fast signal; the "Claude · via MCP" label is the accessible one.
 */

const HEADING = "The part that sounds made up.";
const LEDE = "A note scrawled with a thumb at 11pm, and what Claude does with it over"
  + " breakfast — with the laptop still shut in a bag.";

const NOTE_LINES = [
  "drop per-seat — nobody does seat math",
  "price the space, not the people",
  "$9 whole house?? check against COGS",
  "free tier reads, paid tier writes ← the fence",
];

const REPLY = [
  "You wrote this on Tuesday night. The decision in it is to price per space rather"
  + " than per seat, because seat math is the thing that loses households.",
  "The $9 figure is still open — you left it against COGS and did not come back to it.",
  "Want me to put “settle the $9 number” on the kanninja board for this week?",
];

const PRINCIPLE = "The model suggests. You decide. In that order.";
const FOOTNOTE = "Nothing above was typed twice. The note is the one you already wrote;"
  + " the reply is Claude reading it over a connection you set up once, from a phone,"
  + " on a Wednesday morning.";

export function AgentDemo() {
  return (
    <section className="jd-band jd-band-quiet">
      <h2 className="font-head">{HEADING}</h2>
      <p className="jd-lede">{LEDE}</p>

      <div className="jd-demo">
        <figure>
          <figcaption>
            <span>Handwritten · read in 4s</span>
            <span>Tue 23:47</span>
          </figcaption>
          <h3 className="font-head">pricing, tuesday</h3>
          <div className="jd-note-lines">
            {NOTE_LINES.map((line) => <p key={line}>{line}</p>)}
          </div>
        </figure>

        <figure className="jd-agent">
          <figcaption>
            <Bot aria-hidden size={16} strokeWidth={1.75} />
            <span>Claude · via MCP · Wed 08:12</span>
          </figcaption>
          <div className="jd-agent-body">
            {REPLY.map((line) => <p key={line}>{line}</p>)}
          </div>
        </figure>
      </div>

      <p className="jd-principle">{PRINCIPLE}</p>
      <p className="jd-footnote">{FOOTNOTE}</p>
    </section>
  );
}
