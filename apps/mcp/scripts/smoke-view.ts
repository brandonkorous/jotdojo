/**
 * The words wrapped round a rendered page. ADR-068.
 *
 * `view_note` hands an agent an image, and an image with no frame round it is
 * one that gets described as though somebody had sent a photograph. Every
 * branch below is a different answer to "which of these two things in front of
 * you is the record" — and getting it wrong is invisible, because the picture
 * still looks right.
 *
 * Pure, like smoke-render.ts beside it, and separate from it: that suite is
 * about what a transcript says, this one is about what a drawing says.
 */
import { caption } from "../src/view";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const page = (over: Partial<Parameters<typeof caption>[1]> = {}) => caption("n1", {
  strokeCount: 12,
  transcript: "check with Dana about the margins",
  transcriptState: "ready",
  transcriptSource: "htr:vlm:m/r2",
  confidence: 0.82,
  ...over,
});

console.log("\nthe page is the record; the reading is not");
{
  const c = page();
  check("it says which note", c.includes("n1"), c);
  check("...and how much is on it", c.includes("12 strokes"), c);
  // The whole point. An agent holding a picture AND a transcript has to know
  // which one to believe when they differ, and they will differ.
  check("...that the drawing is the record", c.includes("THIS IS THE RECORD"), c);
  check("...and which way a disagreement goes", c.includes("the page wins"), c);
  check("the reading comes with its confidence", c.includes("confidence 0.82"), c);
  check("...and the reading itself", c.includes("check with Dana about the margins"), c);
}

console.log("\na page a reader found no words on");
{
  // The case this tool exists for: a diagram. A recognizer returning nothing
  // is CORRECT here, and an agent that stops there reports a blank page.
  const c = page({ transcript: "" });
  check("says an empty reading is often right", c.includes("often RIGHT"), c);
  check("...names why", c.includes("layout rather than sentences"), c);
  check("...and asks for a description anyway", c.includes("Describe what you can see"), c);
  check("no confidence is attached to nothing", !c.includes("confidence 0.82"), c);
  check("whitespace counts as nothing", page({ transcript: "   " }).includes("often RIGHT"));
}

console.log("\nstates with no reading to offer");
{
  check("pending says the image is all there is",
    page({ transcriptState: "pending" }).includes("all there is"));
  check("failed says the strokes survived",
    page({ transcriptState: "failed" }).includes("strokes are intact"));
  // A stale transcript from before a failure must not be presented as current.
  check("...and neither quotes a transcript",
    !page({ transcriptState: "pending" }).includes("check with Dana")
    && !page({ transcriptState: "failed" }).includes("check with Dana"));
}

console.log("\nwhat the author typed is not hedged");
{
  const mine = page({ transcriptSource: "user", confidence: null });
  check("attributed to them", mine.includes("typed this out themselves"), mine);
  check("and carries no confidence", !mine.includes("confidence"), mine);
}

console.log("\nsmall honesties");
{
  check("one stroke is not '1 strokes'", page({ strokeCount: 1 }).includes("1 stroke,"),
    page({ strokeCount: 1 }));
  // NULL is not zero and not one. Every block read before ADR-056 has no
  // measurement, and printing "confidence 0.00" would invent a fact.
  const unmeasured = page({ confidence: null });
  check("an unmeasured reading says so", unmeasured.includes("unmeasured confidence"), unmeasured);
  check("...rather than claiming zero", !unmeasured.includes("0.00"), unmeasured);
}

console.log(failures === 0 ? "\nview: all good\n" : `\nview: ${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
