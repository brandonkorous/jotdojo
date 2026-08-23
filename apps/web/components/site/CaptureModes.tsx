import { Icon } from "@/components/Icon";
import type { IconName } from "@/lib/icons";

/**
 * Capture Anything. design.md §18.2.
 *
 * Four ways in, given equal weight. The old three-beat pitch put connecting an
 * agent second, which made the product sound like plumbing; capture is what a
 * person came for, and all four of these are capture.
 */

const MODES: { id: string; icon: IconName; name: string; body: string }[] = [
  {
    id: "write",
    icon: "pen",
    name: "Write",
    body: "Pen to glass, in your own hand. It stays your handwriting — and it is"
      + " still findable in November by one word you wrote in March.",
  },
  {
    id: "type",
    icon: "keyboard",
    name: "Type",
    body: "The cursor is already blinking. Nothing to name, nowhere to file it,"
      + " no new-note button to hunt for first.",
  },
  {
    id: "speak",
    icon: "voice",
    name: "Speak",
    body: "Say it at a red light with both hands where they belong. It comes"
      + " back as words you can search.",
  },
  {
    id: "snap",
    icon: "photo",
    name: "Snap",
    body: "A whiteboard before someone wipes it. A receipt. The page of notes"
      + " somebody else took.",
  },
];

export function CaptureModes() {
  return (
    <section id="how" className="jd-band">
      <h2 className="font-head">
        Four seconds, and <span className="jd-ul">any kind of thought</span>.
      </h2>
      <p className="jd-lede">
        Whatever you were holding when it turned up, that is the way in.
      </p>

      <ul className="jd-modes">
        {MODES.map((mode) => (
          <li key={mode.id}>
            <span aria-hidden className="jd-mode-ico">
              <Icon name={mode.icon} />
            </span>
            <h3 className="font-head">{mode.name}</h3>
            <p>{mode.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
