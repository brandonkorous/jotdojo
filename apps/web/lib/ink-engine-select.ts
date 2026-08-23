import type { InkDelta, Stroke, TextBox } from "@jotdojo/domain";
import { restyle, without } from "./ink-edit";
import { InkSelection, NO_SELECTION, type SelectionSummary } from "./ink-selection";
import type { StrokeIndex } from "./ink-index";
import type { InkTextLayer } from "./ink-text-layer";

/**
 * What a selection can be turned into. ADR-033, ADR-045, ADR-065.
 *
 * Split from ink-engine.ts at the size limit, and the seam is the one the
 * engine's own comments already draw: everything here changes objects that were
 * CAUGHT, while everything left in the engine is about the page and the camera.
 * The split earned itself the moment a selection could hold two kinds of thing
 * -- every method below now has to reach both arrays, and doing that inside a
 * class that also owns the frame loop was how the file got to 300 lines.
 *
 * `InkSelection` is the state machine (drawing a loop, settling it, dragging
 * it). This is what the results of it mean.
 */

export type SelectionContext = {
  strokes: () => Stroke[];
  setStrokes: (strokes: Stroke[]) => void;
  /** Null on the marketing hero, which mounts ink with no object plane. */
  texts: () => InkTextLayer | null;
  index: StrokeIndex;
  onDelta: (delta: InkDelta) => void;
  onChange?: (selection: SelectionSummary) => void;
  repaint: () => void;
  overlay: () => void;
};

export class SelectionEditor {
  readonly sel = new InkSelection();

  constructor(private readonly ctx: SelectionContext) {}

  drop() {
    if (!this.sel.clear()) return;
    this.ctx.onChange?.(NO_SELECTION);
    this.ctx.overlay();
  }

  /**
   * Recolour or resize what the lasso caught.
   *
   * The selection survives, so somebody can try three colours without
   * re-lassoing. The strokes are mutated in place for exactly that reason.
   *
   * `publish: false` paints the change and tells nobody. A slider drag is ONE
   * edit, and every delta leaves as its own request; the release publishes.
   *
   * DOES NOT TOUCH TEXT BOXES. `{color, width}` is a pen idea -- a width means
   * nothing to a paragraph, and a selection holding both should recolour the
   * ink it caught rather than silently restyling the words too. ADR-065.
   */
  restyle(patch: { color?: string; width?: number }, publish = true) {
    if (this.sel.count === 0) return;
    if (!restyle(this.sel.selected, patch) && !publish) return;
    this.ctx.index.invalidate(this.sel.selected);
    this.ctx.repaint();
    this.ctx.overlay();
    this.ctx.onChange?.(this.sel.summary);
    if (!publish) return;
    // The strokes themselves, because a recolour changes what they ARE. The
    // server matches them by id and keeps their place in paint order.
    this.ctx.onDelta({ remove: [], upsert: [...this.sel.selected] });
  }

  /**
   * Turn what the lasso caught into cards, or back into plain notes. ADR-079.
   *
   * The sibling of `restyle` and deliberately a SEPARATE method rather than
   * another key on its patch. ADR-065 decided `{color, width}` is a pen idea
   * that must not reach text, and that still holds -- what changed is that
   * there is now a text idea, and it must not reach the strokes either. Two
   * methods say that; one method with a union would have to remember it.
   *
   * `null` removes the card. Nothing here touches the text colour: the ink is
   * derived from the fill by luminance wherever it is drawn, so it is never
   * stored and never has to be kept in step.
   */
  recolourCards(fill: string | null) {
    const boxes = this.sel.selectedTexts;
    if (boxes.length === 0) return;
    // Mutated in place, like `translateBoxes` and for the same reason: the
    // plane and the selection hold references to these very objects.
    for (const box of boxes as TextBox[]) {
      if (fill) box.fill = fill;
      else delete box.fill;
    }
    // The plane re-reads the boxes it already holds; these are the same objects.
    this.ctx.texts()?.refresh();
    this.ctx.overlay();
    this.ctx.onChange?.(this.sel.summary);
    this.ctx.onDelta({ remove: [], upsert: [], texts: [...this.ctx.texts()?.all ?? []] });
  }

  /** Delete what the lasso caught, naming them rather than resending the page
   *  around them. */
  remove() {
    if (this.sel.count === 0) return;
    // Both kinds in ONE delta. Two would let somebody else's edit interleave
    // between them and leave half a selection behind.
    const ids = this.sel.summary.ids;
    this.ctx.setStrokes(without(this.ctx.strokes(), new Set(this.sel.selected)));
    this.ctx.texts()?.remove(ids);
    this.drop();
    this.ctx.repaint();
    this.ctx.onDelta({ remove: ids, upsert: [] });
  }

  dragTo(x: number, y: number) {
    if (!this.sel.dragTo(x, y)) return;
    // Dragging mutates objects IN PLACE, so the cached boxes are now lies and
    // the plane's elements are where they used to be.
    this.ctx.index.invalidate(this.sel.selected);
    this.ctx.texts()?.refresh();
    this.ctx.repaint();
    this.ctx.overlay();
  }

  finish() {
    if (this.sel.dragging) {
      if (this.sel.endDrag()) {
        // Moved objects are the same objects with different positions, so this
        // is an upsert by id -- of both kinds at once.
        const texts = this.ctx.texts();
        this.ctx.onDelta({
          remove: [], upsert: [...this.sel.selected],
          ...(texts ? { texts: [...texts.all] } : {}),
        });
      }
      return;
    }
    this.sel.settle(this.ctx.strokes(), this.ctx.texts()?.all ?? []);
    this.ctx.onChange?.(this.sel.summary);
    this.ctx.overlay();
  }
}
