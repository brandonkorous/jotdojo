/**
 * What the canvas is currently doing.
 *
 * `text` is the typing surface; everything else is ink. One definition, because
 * the toolbar, the canvas and the ink engine all have to agree, and a string
 * union duplicated across three files is a rename waiting to go wrong.
 */
export type CanvasTool = "text" | "pen" | "highlighter" | "eraser" | "select";

/** The tools the ink engine understands. It has no concept of typing. */
export type InkTool = Exclude<CanvasTool, "text">;

/** A type predicate, not a boolean: it is what lets `tool` narrow to InkTool
 *  at the call site instead of every caller casting. */
export const isInk = (tool: CanvasTool): tool is InkTool => tool !== "text";
