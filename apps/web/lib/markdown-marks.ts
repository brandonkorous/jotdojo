/**
 * Formatting for the typing surface, as markdown. ADR-045.
 *
 * The body of a note IS markdown -- it is what the block stores and what MCP
 * hands an agent (docs/02, docs/05). So the toolbar edits the text rather than
 * decorating a rich document: the surface stays a real `<textarea>`, which is
 * what keeps Apple Scribble working (ADR-034) and keeps paste, IME and undo the
 * browser's problem instead of ours.
 *
 * Pure on purpose. Every rule here is exercised by `pnpm marks:smoke` with no
 * DOM at all.
 */

export type Mark = "bold" | "italic" | "underline";
export type Block = "h1" | "h2" | "body";

/** A selection, before and after. `start === end` means a bare cursor. */
export type Span = { text: string; start: number; end: number };

const WRAP: Record<Mark, { open: string; close: string }> = {
  bold: { open: "**", close: "**" },
  italic: { open: "*", close: "*" },
  // Markdown has no underline. Inline HTML is valid markdown, every renderer
  // passes it through, and an agent reading the body sees an honest <u>.
  underline: { open: "<u>", close: "</u>" },
};

/**
 * Toggle a wrapping mark around the selection.
 *
 * Toggling matters more than it looks: without it a second press of Cmd-B
 * gives `****bold****`, which renders as literal asterisks and is the most
 * common way a hand-rolled markdown toolbar embarrasses itself.
 */
export function toggleMark(span: Span, mark: Mark): Span {
  const { text, start, end } = span;
  const { open, close } = WRAP[mark];

  const inside = text.slice(start, end);
  // Already wrapped, with the marks inside the selection.
  if (inside.startsWith(open) && inside.endsWith(close)
      && inside.length >= open.length + close.length) {
    const bare = inside.slice(open.length, inside.length - close.length);
    return {
      text: text.slice(0, start) + bare + text.slice(end),
      start,
      end: start + bare.length,
    };
  }

  // Already wrapped, with the marks just outside the selection.
  const before = text.slice(Math.max(0, start - open.length), start);
  const after = text.slice(end, end + close.length);
  if (before === open && after === close) {
    return {
      text: text.slice(0, start - open.length) + inside + text.slice(end + close.length),
      start: start - open.length,
      end: end - open.length,
    };
  }

  return {
    text: text.slice(0, start) + open + inside + close + text.slice(end),
    // A bare cursor lands BETWEEN the marks, so typing continues inside them.
    start: start + open.length,
    end: end + open.length,
  };
}

/** The line boundaries containing the span, so a block mark applies to whole
 *  lines however much of them is selected. */
function lineRange(text: string, start: number, end: number): [number, number] {
  const from = text.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const nextBreak = text.indexOf("\n", end);
  return [from, nextBreak === -1 ? text.length : nextBreak];
}

const HEADING = /^(#{1,6})\s+/;

const PREFIX: Record<Block, string> = { h1: "# ", h2: "## ", body: "" };

/**
 * Set the heading level of every line the span touches.
 *
 * Absolute, not a toggle: the three controls are a set of radio buttons, and
 * "make this a heading" twice should not quietly make it body text again.
 */
export function setBlock(span: Span, block: Block): Span {
  const { text, start, end } = span;
  const [from, to] = lineRange(text, start, end);

  const rewritten = text.slice(from, to).split("\n")
    .map((line) => PREFIX[block] + line.replace(HEADING, ""))
    .join("\n");

  const shift = rewritten.length - (to - from);
  return {
    text: text.slice(0, from) + rewritten + text.slice(to),
    // The caret keeps its place in the line rather than jumping to the end.
    start: Math.max(from, start + (PREFIX[block].length - leadingHashes(text, from))),
    end: end + shift,
  };
}

function leadingHashes(text: string, from: number): number {
  const line = text.slice(from, text.indexOf("\n", from) === -1
    ? text.length
    : text.indexOf("\n", from));
  return HEADING.exec(line)?.[0].length ?? 0;
}

/** Which heading level the caret is sitting in, so the control can show it. */
export function blockAt(text: string, at: number): Block {
  const [from] = lineRange(text, at, at);
  const hashes = HEADING.exec(text.slice(from))?.[1]?.length ?? 0;
  if (hashes === 1) return "h1";
  if (hashes >= 2) return "h2";
  return "body";
}

/** Keyboard shortcuts, matching every editor anyone has used. Returns null
 *  when the event is not one of ours, so the caller does not preventDefault. */
export function markForKey(key: string, meta: boolean): Mark | null {
  if (!meta) return null;
  const lower = key.toLowerCase();
  if (lower === "b") return "bold";
  if (lower === "i") return "italic";
  if (lower === "u") return "underline";
  return null;
}
