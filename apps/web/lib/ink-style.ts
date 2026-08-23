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

/**
 * The pen is a continuous range, not a shortlist. ADR-059.
 *
 * Three named sizes were a paper idea: "Medium" only means something when the
 * page has a fixed size to be medium against. This canvas goes on forever, and
 * the same line is a heading up close and a footnote further out.
 */
export const PEN_WIDTH_MIN = 0.5;
export const PEN_WIDTH_MAX = 32;

/** Geometric, so every step of the slider is the same PROPORTIONAL change.
 *  Linear travel would spend two thirds of itself on sizes nobody writes at,
 *  and give the handwriting end no resolution at all. */
const RATIO = PEN_WIDTH_MAX / PEN_WIDTH_MIN;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/**
 * Fine enough that no two steps of the slider settle to the SAME width. They
 * would make the thumb stick: the control is driven by the width it produced,
 * so a step that reads back as its neighbour snaps under the finger.
 */
const settle = (w: number) => (
  w < 4 ? Math.round(w * 100) / 100 : Math.round(w * 10) / 10
);

export function widthFromSlider(t: number): number {
  return settle(PEN_WIDTH_MIN * RATIO ** clamp01(t));
}

export function sliderFromWidth(width: number): number {
  const w = Math.min(PEN_WIDTH_MAX, Math.max(PEN_WIDTH_MIN, width));
  return clamp01(Math.log(w / PEN_WIDTH_MIN) / Math.log(RATIO));
}

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
