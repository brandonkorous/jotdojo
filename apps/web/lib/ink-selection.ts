import type { Point, Stroke, TextBox } from "@jotacular/domain";
import { type Bounds, inBounds, strokeBounds, strokeInPolygon } from "./ink-geometry";
import { boxAt, boxInPolygon, boxesBounds, translateBoxes } from "./ink-objects";
import { topmostAt } from "./ink-edit";
import { classify, type ShapeKind } from "./ink-shapes";

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
export type SelectionSummary = {
  count: number;
  pen: boolean;
  marker: boolean;
  /** Where a resize control should start from -- the width of the first pen
   *  stroke caught, so the slider opens on the selection rather than on a
   *  default that would jump it the moment it is touched. */
  penWidth: number | null;
  /** Which objects, by name. Export sends these to the server rather than the
   *  strokes themselves, so what comes back is the saved page. ADR-058. */
  ids: string[];
  /** How many of them are typed text boxes. The bar says "objects" rather than
   *  "strokes" when a selection holds both, and hides the pen palettes when it
   *  holds only text. ADR-065. */
  texts: number;
  /**
   * What one selected stroke could be tidied into, when the classifier is sure.
   *
   * Null for everything else, and null is the common answer: the same
   * confidence floor hold-to-snap uses, so the menu only offers to make a
   * circle out of something that already looks like one. ADR-066, ADR-084.
   */
  shape: ShapeKind | null;
};

export const NO_SELECTION: SelectionSummary = {
  count: 0, pen: false, marker: false, penWidth: null, ids: [], texts: 0, shape: null,
};

export class InkSelection {
  private lasso: Point[] | null = null;
  private picked: Stroke[] = [];
  /** Text boxes caught by the same loop. A SECOND ARRAY rather than a
   *  discriminated list, matching how they are stored -- see ink-text.ts. */
  private boxes: TextBox[] = [];
  private box: Bounds | null = null;
  private dragFrom: { x: number; y: number } | null = null;
  private moved = false;

  get count() { return this.picked.length + this.boxes.length; }

  /**
   * What was caught, not just how much.
   *
   * The kinds matter to the UI: a highlighter recoloured to ink is the grey
   * smear ADR-045 exists to prevent, so the marker palette has to be offered
   * whenever the lasso holds one.
   */
  get summary(): SelectionSummary {
    const pen = this.picked.find((s) => s.tool === "pen");
    return {
      count: this.count,
      pen: pen !== undefined,
      marker: this.picked.some((s) => s.tool === "highlighter"),
      penWidth: pen?.width ?? null,
      ids: [...this.picked.map((s) => s.id), ...this.boxes.map((b) => b.id)],
      texts: this.boxes.length,
      // Only ever asked of ONE stroke: "tidy these six squiggles" is not a
      // thing anybody means, and classifying a whole selection to find out
      // would cost a pass over every point for an offer nobody wanted.
      shape: this.picked.length === 1 && this.boxes.length === 0
        ? classify(this.picked[0]!.pts)?.kind ?? null
        : null,
    };
  }
  get selected(): readonly Stroke[] { return this.picked; }
  get selectedTexts(): readonly TextBox[] { return this.boxes; }
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
  settle(all: readonly Stroke[], texts: readonly TextBox[] = []): number {
    const poly = this.lasso ?? [];
    this.lasso = null;
    const enclosing = poly.length >= 3;
    this.picked = enclosing ? all.filter((s) => strokeInPolygon(poly, s)) : [];
    // The SAME rule for both kinds: whole-object containment, ADR-033. A mixed
    // selection is only explicable if one standard governs it.
    this.boxes = enclosing ? texts.filter((t) => boxInPolygon(poly, t)) : [];
    this.box = mergeBounds(strokeBounds(this.picked), boxesBounds(this.boxes));
    return this.count;
  }

  /**
   * One object, by tapping it. ADR-084.
   *
   * A lasso is the right instrument for "these things" and a poor one for "that
   * thing": drawing a closed loop round a single card to change its colour is
   * more gesture than the change is worth, and on a phone it is most of a
   * second. So a tap picks one, and everything a selection can already do --
   * recolour, drag, delete, export -- works on it with no new machinery.
   *
   * Boxes before strokes, matching what is drawn: the object plane sits above
   * both canvases, so a card overlapping a squiggle is the thing you can see.
   */
  pick(
    all: readonly Stroke[], texts: readonly TextBox[],
    x: number, y: number, radius: number,
  ): number {
    this.lasso = null;
    const box = boxAt(texts, x, y);
    const stroke = box ? null : topmostAt(all, x, y, radius);
    this.picked = stroke ? [stroke] : [];
    this.boxes = box ? [box] : [];
    this.box = mergeBounds(strokeBounds(this.picked), boxesBounds(this.boxes));
    return this.count;
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
    translateBoxes(this.boxes, dx, dy);
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
    if (this.count === 0 && this.lasso === null) return false;
    this.picked = [];
    this.boxes = [];
    this.box = null;
    this.lasso = null;
    this.dragFrom = null;
    return true;
  }
}

/** Two boxes, either of which may be absent. A selection of only strokes and a
 *  selection of only text both have to produce a marquee. */
function mergeBounds(a: Bounds | null, b: Bounds | null): Bounds | null {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x, y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  };
}
