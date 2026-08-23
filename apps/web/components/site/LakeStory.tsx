import { Icon } from "@/components/Icon";
import { BoardsDoodle, InkRing } from "@/components/site/Ink";
import { Underline } from "@/components/site/Underline";

/**
 * Capture now, use later. design.md §5 and §18.3.
 *
 * The lake story, told as it happened rather than as a feature list. It
 * replaced a section headed "The part that sounds made up" -- which was our
 * disbelief, not the reader's day.
 *
 * Human ink is charcoal, agent ink is `agent` (docs/10-design-system.md). The
 * colour is the fast signal; the "Claude · an agent" label is the accessible one.
 */

const ASK = "Turn the kanNINJA idea I jotted down earlier into a product plan.";

const REPLY = [
  "You wrote this on Saturday afternoon. The idea is to have the planner break a"
  + " project into boards itself, keyed off goals and what depends on what.",
  "You left \"planning agent\" open — you had not decided whether it proposes the"
  + " boards or just the order. That is the first thing to settle.",
];

const CLOSE = "Nothing was typed twice. The note is the one from the dock; the plan"
  + " is Claude reading it through a connection set up once, weeks earlier.";

export function LakeStory() {
  return (
    <section className="jd-band jd-band-quiet">
      <h2 className="font-head">
        Capture now. <Underline>Use later</Underline>.
      </h2>
      <p className="jd-lede">
        You are sitting at the lake and an idea arrives. You have a phone and about
        four seconds before it goes.
      </p>

      <div className="jd-story">
        {/* A real jot: taped down, handwritten, with the drawing that came
            with it. design.md §16 -- the napkin, not a screenshot of one. */}
        <figure className="jd-story-note">
          <span aria-hidden className="jd-tape" />
          <BoardsDoodle className="jd-note-doodle" />
          <div className="jd-note-hand">
            <p className="jd-note-title">kanNINJA idea</p>
            <p>AI should break projects into boards</p>
            <p>maybe based on goals / dependencies</p>
            <p className="jd-note-ringed">
              think about planning agent
              <InkRing className="jd-ring" />
            </p>
          </div>
          <figcaption>Handwritten · Saturday, 4:12pm</figcaption>
        </figure>

        <p className="jd-story-gap">
          You put the phone away and go back to the water. Weeks pass.
        </p>

        {/* A real conversation, in Silica's chat component -- the reply is a
            `chat-bubble-agent`, which is the same `agent` colour role the app
            uses for anything a machine wrote. ADR-073, ADR-080. */}
        <div className="jd-story-chat">
          <div className="chat chat-end">
            <div className="chat-header">You &middot; three weeks later</div>
            <div className="chat-bubble">{ASK}</div>
          </div>

          <div className="chat chat-start">
            <div className="chat-image">
              <span aria-hidden className="jd-chat-avatar">
                <Icon name="agent" />
              </span>
            </div>
            <div className="chat-header">Claude &middot; an agent</div>
            <div className="chat-bubble chat-bubble-agent">
              {REPLY.map((line) => <p key={line.slice(0, 24)}>{line}</p>)}
            </div>
          </div>
        </div>
      </div>

      <p className="jd-footnote">{CLOSE}</p>
    </section>
  );
}
