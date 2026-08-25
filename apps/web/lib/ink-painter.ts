import type { InkSurface } from "./ink-surface";
import type { InkViewport } from "./ink-viewport";
import { drawAll, drawFrame, type Scene } from "./ink-draw";
import { FrameLoop, type Dirty } from "./ink-frame";
import { paintGrid } from "./ink-grid";
import type { InkTextLayer } from "./ink-text-layer";
import type { InkPins } from "./ink-pins";

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
    private readonly texts?: InkTextLayer,
    /** The comment pins. Placed on EVERY painted frame rather than only on a
     *  camera move: a note dragged across the page has to take its pin with
     *  it. ADR-107. */
    private readonly pins?: InkPins,
  ) {
    this.frame = new FrameLoop((dirty) => this.paint(dirty));
  }

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
   * Paint now, off the frame loop.
   *
   * For the two moments where waiting a frame would show the wrong thing:
   * a resize, which clears both canvases, and a load, which has nothing on
   * screen to keep.
   */
  now() {
    if (this.grid) paintGrid(this.grid, this.view);
    this.texts?.frame(this.view);
    this.pins?.frame(this.view);
    drawAll(this.surface, this.scene());
  }

  cancel() { this.frame.cancel(); }

  private paint(dirty: ReadonlySet<Dirty>) {
    if (dirty.has("grid")) {
      if (this.grid) paintGrid(this.grid, this.view);
      this.texts?.frame(this.view);
    }
    this.pins?.frame(this.view);
    drawFrame(this.surface, dirty, this.scene());
  }
}
