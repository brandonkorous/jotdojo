import { Underline } from "@/components/site/Underline";

/**
 * Real examples. design.md §18.7.
 *
 * Six situations rather than six features. Every one is somewhere a person
 * actually is, holding an actual phone -- which is the test design.md §15 sets
 * for photography and it holds for prose too.
 */

const EXAMPLES = [
  { when: "At the lake", what: "A product idea, four lines and an arrow, before it goes." },
  { when: "Driving", what: "\"Ask about the warranty before Thursday.\" Said out loud, hands where they belong." },
  { when: "Leaving a meeting", what: "A photo of the whiteboard, ten seconds before somebody wipes it." },
  { when: "In a coffee shop", what: "A sketch of the thing you cannot describe in words yet." },
  { when: "Under the sink", what: "The size printed on the filter, so you buy the right one this time." },
  { when: "School pickup", what: "Three names, a date, and what you promised somebody you would do." },
];

export function Examples() {
  return (
    <section className="jd-band jd-band-quiet">
      <h2 className="font-head">
        Where thoughts <Underline>actually land</Underline>
      </h2>
      <p className="jd-lede">
        Not one of these is a project. That is rather the point.
      </p>

      <ul className="jd-examples">
        {EXAMPLES.map((example) => (
          <li key={example.when}>
            <h3 className="font-head">{example.when}</h3>
            <p>{example.what}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
