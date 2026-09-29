import type { InkSurface } from "./ink-surface";
import type { InkViewport } from "./ink-viewport";
import { drawAll, drawFrame, type Scene } from "./ink-draw";
import { FrameLoop, type Dirty } from "./ink-frame";
import { paintGrid } from "./ink-grid";
import type { ObjectPlane } from "./ink-object-plane";
import type { InkPins } from "./ink-pins";
import { watchPaper } from "./ink-night";

/**
 * When the page gets painted, and which parts of it.
 *
 * Split out of ink-engine.ts when that file reached the size limit: the engine
 * is a state machine over strokes, and this is the frame budget. They were one
 * class because they started small, not because they are one idea -- everything
 * here is about rate and dirtiness, and nothing here knows what a stroke is.
 *
 * The scene arrives as a getter rather than a value, because it is read at
 * paint time. A snapshot handed over at mark time would be one frame stale by
 * construction, which is the exact bug the frame loop exists to avoid.
 */
/** How long the camera must be still before the ink is painted afresh. */
const SETTLE_MS = 120;

export class InkPainter {
  private readonly frame: FrameLoop;

  constructor(
    private readonly surface: InkSurface,
    private readonly view: InkViewport,
    private readonly scene: () => Scene,
    private readonly grid?: HTMLElement,
    /** The object plane. Its transform is written HERE rather than anywhere
     *  else, because text that lags the ink by one frame during a pinch is
     *  worse than text that does not move at all. ADR-065. */
    private readonly plane?: ObjectPlane,
    /** The comment pins. Placed on EVERY painted frame rather than only on a
     *  camera move: a note dragged across the page has to take its pin with
     *  it. ADR-107. */
    private readonly pins?: InkPins,
  ) {
    this.frame = new FrameLoop((dirty) => this.paint(dirty));
    // The page turning charcoal is the same shape as the camera moving:
    // everything on screen is now different. ADR-116.
    this.unwatch = watchPaper(() => this.everything());
  }

  private readonly unwatch: () => void;

  /** Finished strokes changed. */
  page() { this.frame.mark("page"); }

  /** The lasso, the marquee, the selection outline. */
  overlay() { this.frame.mark("overlay"); }

  /** The stroke under the pen. Marked once per pointer sample, painted once
   *  per frame -- a pen reports faster than a display refreshes. */
  live() { this.frame.mark("live", "overlay"); }

  /** The camera moved, so everything on screen is now somewhere else. */
  everything() { this.frame.mark("page", "overlay", "grid"); }

  /**
   * The camera moved. The ink already painted is slid into place -- on the
   * canvas by a transform, on the plane because it moves with the plane --
   * and repainted once the camera has been still for a moment. A repaint per
   * frame of motion cost the whole page, every frame. ADR-137.
   */
  camera() {
    this.frame.mark("camera", "overlay", "grid");
    if (this.settle) clearTimeout(this.settle);
    this.settle = setTimeout(() => { this.settle = null; this.frame.mark("page"); }, SETTLE_MS);
  }

  private settle: ReturnType<typeof setTimeout> | null = null;

  /**
   * Paint now, off the frame loop.
   *
   * For the two moments where waiting a frame would show the wrong thing:
   * a resize, which clears both canvases, and a load, which has nothing on
   * screen to keep.
   */
  now() {
    if (this.grid) paintGrid(this.grid, this.view);
    this.plane?.texts.frame(this.view);
    this.pins?.frame(this.view);
    const scene = this.scene();
    this.plane?.onPage(scene.strokes, this.seen(scene.strokes), this.surface, scene.index);
    drawAll(this.surface, scene);
  }

  cancel() {
    this.frame.cancel();
    this.unwatch();
    if (this.settle) clearTimeout(this.settle);
  }

  private last: { list: readonly unknown[] | null; size: number } = { list: null, size: 0 };
  private seen(list: readonly unknown[]): boolean {
    const changed = list !== this.last.list || list.length !== this.last.size;
    this.last = { list, size: list.length };
    return changed;
  }

  private paint(dirty: ReadonlySet<Dirty>) {
    if (dirty.has("grid")) {
      if (this.grid) paintGrid(this.grid, this.view);
      this.plane?.texts.frame(this.view);
    }
    this.pins?.frame(this.view);
    if (dirty.has("camera") && !dirty.has("page")) this.surface.follow();
    const scene = this.scene();
    // Before the canvas is drawn: which strokes it draws depends on the order.
    // A note's sheet redraws when the strokes changed, not on a pan. ADR-136.
    if (dirty.has("page")) this.plane?.onPage(scene.strokes, this.seen(scene.strokes), this.surface, scene.index);
    drawFrame(this.surface, dirty, scene);
  }
}
