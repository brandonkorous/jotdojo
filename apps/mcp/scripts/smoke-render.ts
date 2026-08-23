/**
 * What an agent is actually told about a block. ADR-056.
 *
 * Pure, and deliberately separate from smoke-mcp.ts, which drives a live
 * server over HTTP. This is about wording rather than wiring: the difference
 * between "here is the page" and "here is part of the page" is the difference
 * between an agent that is right and one that is confidently wrong, and it is
 * a string.
 */
// The renderer moved to @jotacular/domain when export needed it too (ADR-067).
// The suite stays here: this is about what an AGENT is told, and that is a
// question about the MCP surface even though the string is built elsewhere.
import { renderBlock } from "@jotacular/domain";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const block = (over: Partial<Parameters<typeof renderBlock>[0]> = {}) => renderBlock({
  kind: "ink", body: null, transcript: "check with Dana about the margins",
  transcriptSource: "htr:vlm:m/r2", transcriptState: "ready", confidence: 0.82,
  transcriptCoverage: null, ...over,
});

console.log("\na reading that covered the whole surface");
{
  const whole = block({ transcriptCoverage: 1 });
  check("says nothing about being partial", !whole.includes("PARTIAL"), whole);
  check("still carries its confidence", whole.includes("confidence 0.82"), whole);
  check("and the transcript itself is unchanged",
    whole.includes("check with Dana about the margins"));
}

console.log("\na reading that covered part of it");
{
  const part = block({ transcriptCoverage: 0.34 });
  check("says so, in the line an agent quotes", part.includes("PARTIAL"), part);
  check("...with how much", part.includes("34%"), part);
  check("...and what that means", part.includes("not read"), part);
  // The marker is useless if it can be read as a footnote about quality. It
  // has to forbid the specific thing an agent would otherwise do.
  check("...and tells it not to describe this as the whole page",
    part.includes("Do not describe this as the whole page"), part);
  check("the transcript is still delivered in full",
    part.includes("check with Dana about the margins"), part);
}

console.log("\nrounding is honest at the edges");
{
  check("a hair under whole still says partial",
    block({ transcriptCoverage: 0.999 }).includes("PARTIAL"));
  // Rounds to 100%, and must still be marked: "100% partial" is odd to read
  // but "the whole board" would be a lie, and only one of those loses data.
  check("...even when it rounds to 100",
    block({ transcriptCoverage: 0.999 }).includes("100%"));
  check("a sliver reads as a sliver",
    block({ transcriptCoverage: 0.04 }).includes("4%"));
}

console.log("\nnobody measured, which is the whole existing corpus");
{
  // NULL is not 1. Every block read before this shipped has no measurement,
  // and claiming those were whole would be inventing a fact about them.
  check("null says nothing either way", !block({ transcriptCoverage: null }).includes("PARTIAL"));
  check("undefined is treated the same",
    !block({ transcriptCoverage: undefined }).includes("PARTIAL"));
}

console.log("\nwhat a person typed is not hedged");
{
  const mine = block({ transcriptSource: "user", confidence: null, transcriptCoverage: null });
  check("no confidence figure", !mine.includes("confidence"), mine);
  check("attributed to the author", mine.includes("transcribed by the author"), mine);
  check("and not marked partial", !mine.includes("PARTIAL"), mine);
}

console.log("\nstates that have no transcript to qualify");
{
  check("pending says come back", block({ transcriptState: "pending" }).includes("not yet read"));
  check("...without a coverage claim",
    !block({ transcriptState: "pending", transcriptCoverage: 0.3 }).includes("PARTIAL"));
  check("failed says the original is intact",
    block({ transcriptState: "failed" }).includes("The original is intact"));
  check("an unreadable page is not a partial one",
    !block({ transcript: "   ", transcriptCoverage: 0.3 }).includes("PARTIAL"));
}

console.log("\nthe words a person would use");
{
  check("ink reads as handwritten", block().includes("handwritten"));
  check("a photo reads as a photo", block({ kind: "image" }).includes("from a photo"));
  check("audio reads as a voice note", block({ kind: "audio" }).includes("from a voice note"));
  check("typed text is delivered plainly",
    block({ kind: "text", body: "just words" }) === "just words");
}

console.log(failures === 0 ? "\nrender: all good\n" : `\nrender: ${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
