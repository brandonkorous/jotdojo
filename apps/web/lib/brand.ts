/**
 * Who this product is, in one place. ADR-072.
 *
 * The name used to be a constant scattered across metadata, the manifest, the
 * MCP server identity and a dozen sentences. Collapsing it here is what made
 * the rename a small diff instead of a large one -- and it is why a second
 * brand, if there is ever one, is a new object rather than a new codebase.
 */

export const brand = {
  /** Sentence-case, for prose. */
  name: "Jotacular",
  /** The wordmark is lowercase. Use this wherever the mark itself is set. */
  wordmark: "jotacular",
  /** The app mark says `jot` -- the action, not the brand. design.md §24. */
  mark: "jot",

  line: "Where the thought lands.",
  hook: "Don't organize it. Just jot it.",
  support:
    "Write it, type it, say it, or snap it. Jotacular keeps your thoughts ready "
    + "for you — and whatever AI you use next.",

  /** Longer form, for metadata descriptions and the connector listing. */
  blurb:
    "Write a note in a second on the phone already in your hand — typed, "
    + "handwritten or spoken. Then ask Claude what you said. Nothing to install, and "
    + "no computer left running at home.",
} as const;

/**
 * The palette, for the handful of places that need it in JavaScript rather than
 * in CSS: the manifest, `themeColor`, and the ink swatches. CSS reads these from
 * the theme in globals.css, never from here -- two declarations of one colour is
 * how they drift.
 */
export const pigment = {
  mint: "#00C2A8",
  violet: "#6A39FF",
  charcoal: "#111418",
  paper: "#F7F3EA",
  white: "#FFFFFF",
} as const;
