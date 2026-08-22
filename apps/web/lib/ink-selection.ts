import type { Point, Stroke } from "@jotdojo/domain";
import { type Bounds, inBounds, strokeBounds, strokeInPolygon } from "./ink-geometry";

/**
 * Lasso selection: the state between "a loop was drawn" and "those strokes
 * moved or went away". docs/08-ink.md lists Select as a first-class tool.
 *
 * Kept out of InkEngine because it is a second state machine with its own
 * lifecycle -- drawing a loop, settling it, dragging it -- and interleaving it
 * with stroke capture made one file that did two jobs. ADR-030, ADR-033.
 *
 * `picked` holds REFERENCES into the engine's stroke array, which is what lets
 * a drag mutate points in place and repaint without rebuilding the page.
 */
export type SelectionSummary = { count: number; pen: boolean; marker: boolean };

export const NO_SELECTION: SelectionSummary = { count: 0, pen: false, marker: false };

export class InkSelection {
  private lasso: Point[] | null = null;
  private picked: Stroke[] = [];
  private box: Bounds | null = null;
  private dragFrom: { x: number; y: number } | null = null;
  private moved = false;

  get count() { return this.picked.length; }

  /**
   * What was caught, not just how much.
   *
   * The kinds matter to the UI: a highlighter recoloured to ink is the grey
   * smear ADR-045 exists to prevent, so the marker palette has to be offered
   * whenever the lasso holds one.
   */
  get summary(): SelectionSummary {
    return {
      count: this.picked.length,
      pen: this.picked.some((s) => s.tool === "pen"),
      marker: this.picked.some((s) => s.tool === "highlighter"),
    };
  }
  get selected(): readonly Stroke[] { return this.picked; }
  get path(): readonly Point[] | null { return this.lasso; }
  get marquee(): Bounds | null { return this.box; }
  get dragging() { return this.dragFrom !== null; }

  /** True when the point falls inside a settled marquee. */
  covers(x: number, y: number) { return this.box !== null && inBounds(this.box, x, y); }

  beginLasso(p: Point) { this.lasso = [p]; }
  extendLasso(p: Point) { this.lasso?.push(p); }

  /**
   * Close the loop and keep what it encloses.
   *
   * Fewer than three points cannot enclose anything, so a stray tap clears the
   * selection rather than selecting the whole page.
   */
  settle(all: readonly Stroke[]): number {
    const poly = this.lasso ?? [];
    this.lasso = null;
    this.picked = poly.length >= 3 ? all.filter((s) => strokeInPolygon(poly, s)) : [];
    this.box = strokeBounds(this.picked);
    return this.picked.length;
  }

  beginDrag(x: number, y: number) {
    this.dragFrom = { x, y };
    this.moved = false;
  }

  /** Mutates the selected strokes in place. Returns false when nothing moved. */
  dragTo(x: number, y: number): boolean {
    if (!this.dragFrom) return false;
    const dx = x - this.dragFrom.x;
    const dy = y - this.dragFrom.y;
    if (dx === 0 && dy === 0) return false;
    for (const stroke of this.picked) {
      for (const p of stroke.pts) { p[0] += dx; p[1] += dy; }
    }
    if (this.box) { this.box.x += dx; this.box.y += dy; }
    this.dragFrom = { x, y };
    this.moved = true;
    return true;
  }

  /** Ends the drag. True only if the strokes actually changed position, so a
   *  tap inside the marquee costs no round trip. */
  endDrag(): boolean {
    const moved = this.moved;
    this.dragFrom = null;
    this.moved = false;
    return moved;
  }

  /** True if there was anything to clear, so callers can skip a repaint. */
  clear(): boolean {
    if (this.picked.length === 0 && this.lasso === null) return false;
    this.picked = [];
    this.box = null;
    this.lasso = null;
    this.dragFrom = null;
    return true;
  }
}
