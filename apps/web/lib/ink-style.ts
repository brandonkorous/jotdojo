import { HIGHLIGHTER_WIDTH, PEN_WIDTH } from "./ink-paint";
import type { InkTool } from "./canvas-tool";

/**
 * What each ink tool is currently set to. docs/08-ink.md, ADR-045.
 *
 * Style is held PER TOOL, not once for the canvas. One shared colour is what
 * made the highlighter useless: it inherited the pen's near-black, and a
 * near-black marker at 35% multiply is a grey smear that reads as a fat pen.
 * A marker has its own colour the way a real one does.
 */

export type InkStyle = { color: string; width: number };

export type Swatch = { name: string; color: string };

/**
 * Six-digit hex only: the domain validator refuses anything else, and that is
 * deliberate. Opacity is a property of the TOOL, applied when painting, so it
 * can never be baked into a stored colour and lost to a re-render.
 */
export const PEN_COLORS: Swatch[] = [
  { name: "Sumi", color: "#1A1817" },
  { name: "Vermillion", color: "#E0432F" },
  { name: "Indigo", color: "#4B5FA8" },
  { name: "Moss", color: "#3F6B4A" },
  { name: "Clay", color: "#A2593B" },
];

/** Tuned to multiply onto washi cream rather than onto white. A highlighter
 *  that looks right on #FFFFFF goes muddy on #F8F4EC. */
export const MARKER_COLORS: Swatch[] = [
  { name: "Yellow", color: "#F2D648" },
  { name: "Mint", color: "#6FD6A8" },
  { name: "Sky", color: "#7EC8F0" },
  { name: "Rose", color: "#F58BB0" },
];

export const PEN_WIDTHS = [
  { name: "Fine", width: 1.4 },
  { name: "Medium", width: PEN_WIDTH },
  { name: "Broad", width: 3.6 },
] as const;

export const DEFAULT_PEN: InkStyle = { color: "#1A1817", width: PEN_WIDTH };

/** The marker keeps one width on purpose -- docs/08 is explicit that a marker
 *  is unmodulated, and a thin highlighter is a pen with a colour problem. */
export const DEFAULT_MARKER: InkStyle = { color: "#F2D648", width: HIGHLIGHTER_WIDTH };

export type InkStyles = { pen: InkStyle; highlighter: InkStyle };

export const DEFAULT_STYLES: InkStyles = { pen: DEFAULT_PEN, highlighter: DEFAULT_MARKER };

/** Which style a tool draws with. Eraser and select draw no strokes, but the
 *  engine still wants an answer, and the pen is the harmless one. */
export function styleFor(tool: InkTool, styles: InkStyles): InkStyle {
  return tool === "highlighter" ? styles.highlighter : styles.pen;
}

/** Whether a tool has anything to configure, so the options strip knows to
 *  appear at all rather than opening empty. */
export const isStyled = (tool: string) => tool === "pen" || tool === "highlighter";
