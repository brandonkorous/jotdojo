/**
 * Formatting the typing surface. ADR-045.
 *
 * The body of a note is markdown, so the toolbar edits text rather than
 * decorating a document. That makes every rule here a pure string operation,
 * and this suite needs no DOM, no database and no server -- which is the point:
 * the fiddly parts of a markdown toolbar are the toggle and the caret, and both
 * are cheap to get wrong and cheap to check.
 */
import {
  toggleMark, setBlock, blockAt, markForKey, type Span,
} from "../lib/markdown-marks";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

/** A readable way to write a case: the pipes are the selection. */
const span = (marked: string): Span => {
  const start = marked.indexOf("|");
  const end = marked.indexOf("|", start + 1) - 1;
  return { text: marked.replace(/\|/g, ""), start, end };
};
const show = (s: Span) => `${s.text.slice(0, s.start)}|${s.text.slice(s.start, s.end)}|${s.text.slice(s.end)}`;

console.log("\nwrapping a selection");
check("bold wraps", toggleMark(span("the |roof| quote"), "bold").text === "the **roof** quote",
  show(toggleMark(span("the |roof| quote"), "bold")));
check("italic wraps with one asterisk",
  toggleMark(span("the |roof| quote"), "italic").text === "the *roof* quote");
check("underline uses inline html, because markdown has none",
  toggleMark(span("the |roof| quote"), "underline").text === "the <u>roof</u> quote");
check("the selection still covers the same words afterwards",
  show(toggleMark(span("the |roof| quote"), "bold")) === "the **|roof|** quote",
  show(toggleMark(span("the |roof| quote"), "bold")));

console.log("\ntoggling off, which is the part that usually breaks");
const bolded = toggleMark(span("the |roof| quote"), "bold");
const twice = toggleMark(bolded, "bold");
check("a second press unwraps rather than doubling up", twice.text === "the roof quote",
  twice.text);
check("...and does not leave ****", !twice.text.includes("****"));
check("unwraps when the marks sit INSIDE the selection",
  toggleMark(span("the |**roof**| quote"), "bold").text === "the roof quote");
check("unwraps when the marks sit OUTSIDE the selection",
  toggleMark(span("the **|roof|** quote"), "bold").text === "the roof quote");

console.log("\na bare cursor");
const caret = toggleMark({ text: "note: ", start: 6, end: 6 }, "bold");
check("wrapping with nothing selected leaves the marks", caret.text === "note: ****");
check("...with the caret between them, so typing lands inside",
  caret.start === 8 && caret.end === 8, `${caret.start},${caret.end}`);

console.log("\nheadings are a set of three, not a toggle");
check("body becomes h1", setBlock(span("|Roof|"), "h1").text === "# Roof");
check("h1 becomes h2 without stacking hashes",
  setBlock(span("# |Roof|"), "h2").text === "## Roof");
check("h2 goes back to body", setBlock(span("## |Roof|"), "body").text === "Roof");
check("pressing h1 twice is still h1", setBlock(setBlock(span("|Roof|"), "h1"), "h1").text === "# Roof");
check("only the lines the selection touches change",
  setBlock({ text: "one\ntwo\nthree", start: 4, end: 7 }, "h1").text === "one\n# two\nthree",
  setBlock({ text: "one\ntwo\nthree", start: 4, end: 7 }, "h1").text);
check("a selection spanning two lines marks both",
  setBlock({ text: "one\ntwo\nthree", start: 0, end: 7 }, "h2").text === "## one\n## two\nthree",
  setBlock({ text: "one\ntwo\nthree", start: 0, end: 7 }, "h2").text);
check("the selection still covers the same words",
  show(setBlock(span("|Roof|"), "h1")) === "# |Roof|", show(setBlock(span("|Roof|"), "h1")));

console.log("\nreading the level back, so the control can show it");
check("a plain line is body", blockAt("Roof", 2) === "body");
check("one hash is h1", blockAt("# Roof", 3) === "h1");
check("two hashes is h2", blockAt("## Roof", 4) === "h2");
check("deeper headings read as h2 rather than as nothing", blockAt("#### Roof", 6) === "h2");
check("the level is per line, not per document",
  blockAt("# Title\nbody text", 10) === "body");

console.log("\nkeyboard");
check("cmd-b is bold", markForKey("b", true) === "bold");
check("cmd-i is italic", markForKey("i", true) === "italic");
check("cmd-u is underline", markForKey("u", true) === "underline");
check("capitals count, because caps lock is a thing", markForKey("B", true) === "bold");
check("a bare letter is NOT a shortcut, or typing would be impossible",
  markForKey("b", false) === null);
check("an unrelated chord is left alone", markForKey("k", true) === null);

console.log(failures === 0
  ? "\nmarks smoke: all checks passed"
  : `\nmarks smoke: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
