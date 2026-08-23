import Link from "next/link";
import { Underline } from "@/components/site/Underline";

/**
 * Connect your AI. design.md §18.4 and §19.
 *
 * MCP is the mechanism, not the promise -- it appears once, below the fold of
 * this section's own heading, and never in the hero. The old site led with the
 * server because the server was the hard part to build. That is our problem,
 * not the reader's.
 */

const STEPS = [
  { n: "1", body: "Paste one link into Claude's settings. Or ChatGPT's." },
  { n: "2", body: "Sign in, and pick which spaces it may reach." },
  { n: "3", body: "That is the setup. You do it once, and your laptop can stay shut." },
];

export function ConnectAI() {
  return (
    <section id="ai" className="jd-band jd-band-ink">
      <h2 className="font-head">
        Connect <Underline>your</Underline> AI
      </h2>
      <p className="jd-lede">
        Your jots become context wherever you already work — without you copying
        anything across, and without a machine left running at home to serve them.
      </p>

      <ol className="jd-steps">
        {STEPS.map((step) => (
          <li key={step.n}>
            <span aria-hidden className="jd-step-n font-head">{step.n}</span>
            <p>{step.body}</p>
          </li>
        ))}
      </ol>

      <p className="jd-fineprint">
        Jotacular works with MCP-compatible agents.{" "}
        <Link href="/blog/connect-jotacular-to-claude">How to connect one</Link>.
      </p>
    </section>
  );
}
