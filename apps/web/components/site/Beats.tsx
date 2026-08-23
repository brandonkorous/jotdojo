/** How it works, in three beats. docs/00-vision.md: capture, cognition, action. */
const BEATS = [
  {
    step: "Jot",
    body: "Open it and the cursor is already blinking. Type it, write it with a pen,"
      + " or say it out loud. There is no new-note button to hunt for and nothing to"
      + " wait for, which is the entire point when you have four seconds and one hand.",
  },
  {
    step: "Connect",
    body: "Paste one link into Claude's settings, or ChatGPT's, and choose which spaces"
      + " it may reach. That is the setup, and you do it once. Your laptop can stay shut.",
  },
  {
    step: "Ask",
    body: "“What was that pricing idea from Tuesday?” Claude finds the note,"
      + " reads it, and answers — even when Tuesday's version was three words and an"
      + " arrow, drawn with a thumb at a red light.",
  },
];

export function Beats() {
  return (
    <section id="how" className="jd-band">
      <h2 className="font-head">How it works</h2>
      <ol className="jd-beats">
        {BEATS.map((beat) => (
          <li key={beat.step}>
            <h3 className="font-head">{beat.step}</h3>
            <p>{beat.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
