import type { InkDelta, Stroke } from "@jotacular/domain";
import { eraseNear } from "./ink-edit";
import type { InkLinks } from "./ink-engine-links";
import { ERASE_RADIUS } from "./ink-paint";

/**
 * Rubbing out, which is a sweep rather than an edit. ADR-084.
 *
 * Split from ink-engine.ts at its size limit, and the seam is that this has
 * STATE OF ITS OWN: the set of ids taken during the current drag, which exists
 * so that wiping out a sentence leaves as one delta rather than one per pointer
 * sample. Everything else the engine does to a stroke happens at once.
 */

export type EraseContext = {
  strokes: () => Stroke[];
  setStrokes: (next: Stroke[]) => void;
  /** The zoom, because the eraser's reach is a screen distance. */
  zoom: () => number;
  /** The arrows. Null wherever the engine is mounted with no object plane. */
  links: () => InkLinks | null;
  onDelta: (delta: InkDelta) => void;
  repaint: () => void;
};

export class Eraser {
  /** Ids taken during the current sweep, flushed when the pointer lifts. */
  private readonly taken = new Set<string>();

  constructor(private readonly ctx: EraseContext) {}

  /**
   * Take whatever the point reaches. True when something went, so the drag
   * knows there is something to send.
   *
   * DOES NOT DELETE TEXT BOXES -- whiteboard convention, and the right one:
   * rubbing at a diagram should not silently swallow the label beside it.
   * Lasso and Delete are how a note goes. ADR-065.
   *
   * IT DOES TAKE ARROWS, and the line is the same one: the eraser takes what
   * was DRAWN and leaves what was typed. An arrow is a line. ADR-108.
   */
  at(x: number, y: number): boolean {
    // A screen distance. Left in world units the eraser would swallow the page
    // zoomed out and miss everything zoomed in.
    const reach = ERASE_RADIUS / this.ctx.zoom();
    const arrow = this.ctx.links()?.hitAt(x, y, reach) ?? null;
    if (arrow && this.ctx.links()?.remove([arrow.id])) this.taken.add(arrow.id);

    const hit = eraseNear(this.ctx.strokes(), x, y, reach);
    if (!hit) return arrow !== null;
    this.ctx.setStrokes(hit.kept);
    for (const stroke of hit.removed) this.taken.add(stroke.id);
    this.ctx.repaint();
    return true;
  }

  /** The sweep ended. One delta for the whole of it, naming what went rather
   *  than resending the page around it. ADR-058. */
  end(erased: boolean) {
    if (!erased || this.taken.size === 0) return;
    this.ctx.onDelta({ remove: [...this.taken], upsert: [] });
    this.taken.clear();
  }
}
