/**
 * The colours a note can be. ADR-079.
 *
 * FIVE, and the shortness is the feature. A full colour picker on a capture
 * surface is a decision with no right answer, offered at the moment somebody is
 * trying to write something down -- and a card is meant to be grabbed, not
 * designed. Real sticky notes come in a handful of colours for the same reason.
 *
 * They are the house hues from design.md §11 rather than a sixth palette
 * invented here: paper, mint, violet, charcoal. Tinted for the light ones so
 * charcoal type sits on them comfortably; full strength for charcoal, where the
 * ink flips to paper. `inkOn` decides which, by luminance, so a card can never
 * be saved with text nobody can read on it.
 *
 * No sticky-note yellow. It would be a brand colour we do not have, and that is
 * a decision for design.md rather than for this file.
 */
export type CardColor = { name: string; fill: string | null };

export const CARD_COLORS: readonly CardColor[] = [
  /** No card at all -- words straight onto the canvas, as before ADR-079. */
  { name: "None", fill: null },
  { name: "Paper", fill: "#FBF8F2" },
  { name: "Mint", fill: "#CCF3ED" },
  { name: "Violet", fill: "#E4DBFF" },
  { name: "Charcoal", fill: "#111418" },
];

