import type { ImageOnPage, Point, Sticker, Stroke, TextBox } from "@jotacular/domain";
import { type Bounds, inBounds, strokeInPolygon } from "./ink-geometry";
import { boxAt, boxInPolygon } from "./ink-objects";
import { imageAt, imageInPolygon, stickerAt, stickerInPolygon } from "./ink-rects";
import { topmostAt } from "./ink-edit";
import { Held } from "./ink-selection-held";

export { NO_SELECTION, type SelectionSummary } from "./ink-selection-held";

/**
 * Lasso selection: the state between "a loop was drawn" and "those strokes
 * moved or went away". docs/08-ink.md lists Select as a first-class tool.
 *
 * Kept out of InkEngine because it is a second state machine with its own
 * lifecycle -- drawing a loop, settling it, dragging it -- and interleaving it
 * with stroke capture made one file that did two jobs. ADR-030, ADR-033.
 *
 * WHAT is held moved to ink-selection-held.ts when stickers became a fourth
 * kind (ADR-115). This file is the lifecycle; that one is the contents.
 */
export class InkSelection {
  private lasso: Point[] | null = null;
  private held = new Held();
  private box: Bounds | null = null;
  private dragFrom: { x: number; y: number } | null = null;
  private moved = false;

  get count() { return this.held.count; }
  get summary() { return this.held.summary(); }
  get selected(): readonly Stroke[] { return this.held.strokes; }
  get selectedTexts(): readonly TextBox[] { return this.held.boxes; }
  get selectedImages(): readonly ImageOnPage[] { return this.held.pics; }
  get selectedStickers(): readonly Sticker[] { return this.held.marks; }
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
   * selection rather than selecting the whole page. The SAME rule governs all
   * four kinds -- whole-object containment, ADR-033 -- because a mixed
   * selection is only explicable if one standard decides it.
   */
  settle(
    all: readonly Stroke[], texts: readonly TextBox[] = [],
    images: readonly ImageOnPage[] = [], stickers: readonly Sticker[] = [],
  ): number {
    const poly = this.lasso ?? [];
    this.lasso = null;
    const enclosing = poly.length >= 3;
    this.held.set(
      enclosing ? all.filter((s) => strokeInPolygon(poly, s)) : [],
      enclosing ? texts.filter((t) => boxInPolygon(poly, t)) : [],
      enclosing ? images.filter((i) => imageInPolygon(poly, i)) : [],
      enclosing ? stickers.filter((s) => stickerInPolygon(poly, s)) : [],
    );
    this.remeasure();
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
   * Topmost kind first: stickers, then boxes, then photographs, then strokes.
   * That is the order they are drawn in, reversed, so what a tap picks is what
   * a person can see under their finger.
   */
  pick(
    all: readonly Stroke[], texts: readonly TextBox[],
    x: number, y: number, radius: number,
    images: readonly ImageOnPage[] = [], stickers: readonly Sticker[] = [],
  ): number {
    this.lasso = null;
    const mark = stickerAt(stickers, x, y);
    const box = mark ? null : boxAt(texts, x, y);
    const pic = mark || box ? null : imageAt(images, x, y);
    const stroke = mark || box || pic ? null : topmostAt(all, x, y, radius);
    this.held.set(stroke ? [stroke] : [], box ? [box] : [], pic ? [pic] : [], mark ? [mark] : []);
    this.remeasure();
    return this.count;
  }

  /**
   * Hold exactly these, without a loop having been drawn. ADR-110.
   *
   * What a paste leaves behind: the copy is selected, so it can be dragged
   * where it belongs immediately rather than found and lassoed first.
   */
  hold(
    strokes: readonly Stroke[], texts: readonly TextBox[],
    images: readonly ImageOnPage[], stickers: readonly Sticker[] = [],
  ) {
    this.lasso = null;
    this.held.set(strokes, texts, images, stickers);
    this.remeasure();
  }

  private remeasure() { this.box = this.held.bounds(); }

  beginDrag(x: number, y: number) {
    this.dragFrom = { x, y };
    this.moved = false;
  }

  /** Mutates the selected objects in place. Returns false when nothing moved. */
  dragTo(x: number, y: number): boolean {
    if (!this.dragFrom) return false;
    const dx = x - this.dragFrom.x;
    const dy = y - this.dragFrom.y;
    if (dx === 0 && dy === 0) return false;
    this.held.translate(dx, dy);
    if (this.box) { this.box.x += dx; this.box.y += dy; }
    this.dragFrom = { x, y };
    this.moved = true;
    return true;
  }

  /** Ends the drag. True only if the objects actually changed position, so a
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
    this.held.clear();
    this.box = null;
    this.lasso = null;
    this.dragFrom = null;
    return true;
  }
}
