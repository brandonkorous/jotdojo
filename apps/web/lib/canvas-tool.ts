/**
 * What the canvas is currently doing.
 *
 * `text` is the SPINE -- the full-bleed typing surface a tap lands in, which is
 * what keeps capture under 300ms (docs/02). `textbox` places a box anywhere on
 * the plane, and is armed from the text tool's options rather than living in
 * the rail: it is the additional thing, not the default one. ADR-065.
 *
 * One definition, because the toolbar, the canvas and the ink engine all have
 * to agree, and a string union duplicated across three files is a rename
 * waiting to go wrong.
 */
export type CanvasTool = "text" | "textbox" | "pen" | "highlighter" | "eraser" | "select";

/** The tools the ink engine understands. It has no concept of the spine. */
export type InkTool = Exclude<CanvasTool, "text">;

/**
 * Whether the ink surface takes the pointer.
 *
 * `textbox` counts: placing a box is a tap on the PLANE, which sits above the
 * canvases and below nothing. With the spine live instead, that tap would land
 * in the textarea and put a caret at the end of the note.
 */
export const isInk = (tool: CanvasTool): tool is InkTool => tool !== "text";

/** Whether this tool draws strokes. `select`, `eraser` and `textbox` are all on
 *  the ink surface and none of them lays down ink. */
export const isDrawing = (tool: CanvasTool) => tool === "pen" || tool === "highlighter";
