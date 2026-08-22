import type { Point, Stroke } from "@jotdojo/domain";
import { HIGHLIGHTER_WIDTH, PEN_WIDTH } from "./ink-paint";

/**
 * The stroke currently under the pen: the draw-mode counterpart to
 * InkSelection's select-mode. The engine dispatches to one or the other rather
 * than holding both state machines itself. ADR-030.
 */
export class StrokeCapture {
  private pts: Point[] = [];
  private tool: Stroke["tool"] = "pen";
  private color = "#1A1817";
  private chosenWidth = PEN_WIDTH;

  get points(): readonly Point[] { return this.pts; }
  get active() { return this.pts.length > 0; }

  /** The stored model has two tools; the UI union is wider, and `eraser` and
   *  `select` must never reach a Stroke. */
  setStyle(tool: string, color: string, width: number) {
    this.tool = tool === "highlighter" ? "highlighter" : "pen";
    this.color = color;
    this.chosenWidth = width;
  }

  begin(p: Point) { this.pts = [p]; }
  extend(p: Point) { this.pts.push(p); }

  /** What to draw for the in-progress stroke, using the same painter as a
   *  finished one so the line does not change appearance when it commits. */
  preview(): Stroke {
    return { tool: this.tool, color: this.color, width: this.width(), pts: this.pts };
  }

  /**
   * Take the finished stroke and reset.
   *
   * Null when nothing was captured. A single point IS a stroke -- people draw
   * dots -- so the empty check is length zero, not length one.
   */
  finish(): Stroke | null {
    if (this.pts.length === 0) return null;
    const stroke: Stroke = {
      tool: this.tool, color: this.color, width: this.width(), pts: this.pts,
    };
    this.pts = [];
    return stroke;
  }

  /**
   * Throw the in-progress stroke away.
   *
   * A second finger landing means a pinch, not a line -- and without this
   * every zoom leaves the tick mark the first finger had already drawn.
   * Returns whether there was anything to discard.
   */
  abort(): boolean {
    if (this.pts.length === 0) return false;
    this.pts = [];
    return true;
  }

  /** The marker ignores the chosen width: docs/08 makes it unmodulated on
   *  purpose, and a thin highlighter is just a pen with a colour problem. */
  private width() {
    return this.tool === "highlighter" ? HIGHLIGHTER_WIDTH : this.chosenWidth;
  }
}
