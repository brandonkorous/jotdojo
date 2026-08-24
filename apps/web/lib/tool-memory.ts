import type { CanvasTool } from "./canvas-tool";

/**
 * The tool you were holding, remembered on THIS device.
 *
 * Deliberately not a server preference like the chrome's left/right side is.
 * Which hand holds the pencil is a fact about a person; which tool is down is a
 * fact about a session at a desk, and syncing it would hand the pen to a phone
 * because a tablet had been drawing.
 */

const KEY = "jotacular.tool";

/** `textbox` is a ONE-SHOT, not a mode -- placing a box hands the tool straight
 *  back to the spine (ADR-065), so remembering it would restore a state the app
 *  itself leaves immediately. */
const REMEMBERED: readonly CanvasTool[] = ["text", "pen", "highlighter", "eraser", "select"];

const isRemembered = (v: string): v is CanvasTool =>
  (REMEMBERED as readonly string[]).includes(v);

/**
 * Storage can THROW in a locked-down Safari rather than return null, so both
 * directions are guarded. A forgotten tool is the spine, which is where a page
 * opened before any of this existed.
 */
export function rememberedTool(): CanvasTool {
  try {
    const saved = localStorage.getItem(KEY);
    return saved && isRemembered(saved) ? saved : "text";
  } catch {
    return "text";
  }
}

export function rememberTool(tool: CanvasTool): void {
  if (!isRemembered(tool)) return;
  try {
    localStorage.setItem(KEY, tool);
  } catch {
    // A tool that will not stick is a smaller problem than a canvas that will
    // not load.
  }
}
