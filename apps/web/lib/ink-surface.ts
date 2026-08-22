import { MAX_DPR } from "./ink-paint";
import type { ViewSnapshot } from "./ink-viewport";

/**
 * The two stacked canvases and their device-pixel geometry.
 *
 * Split from InkEngine because sizing a backing store has nothing to do with
 * the pointer state machine, and mixing them put DPR arithmetic in the middle
 * of stroke capture. ADR-030.
 */
export class InkSurface {
  readonly cctx: CanvasRenderingContext2D;
  readonly lctx: CanvasRenderingContext2D;
  private dpr = 1;
  /** The CSS box, which `resize` used to take and throw away. Culling and
   *  fit-to-content both need to know how big the window onto the world is. */
  private cssW = 0;
  private cssH = 0;

  constructor(
    readonly committed: HTMLCanvasElement,
    readonly live: HTMLCanvasElement,
    private readonly view: ViewSnapshot,
  ) {
    // `desynchronized` opts into the low-latency path, which is most of what
    // the browser can offer for ink. `alpha: false` is NOT used: the canvas has
    // to sit transparently over the page.
    this.cctx = committed.getContext("2d", { desynchronized: true })!;
    this.lctx = live.getContext("2d", { desynchronized: true })!;
  }

  /** Assigning width or height destroys canvas contents, so callers must
   *  repaint afterwards. */
  resize(cssWidth: number, cssHeight: number) {
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.cssW = cssWidth;
    this.cssH = cssHeight;
    for (const canvas of [this.committed, this.live]) {
      canvas.width = Math.round(cssWidth * this.dpr);
      canvas.height = Math.round(cssHeight * this.dpr);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
    }
    for (const ctx of [this.cctx, this.lctx]) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
    this.applyView();
  }

  /**
   * Compose the camera with the device pixel ratio, world -> device.
   *
   * Kept out of `resize` because the camera moves far more often than the
   * canvas does; every paint entry point installs the current matrix.
   */
  applyView() {
    const s = this.dpr * this.view.k;
    for (const ctx of [this.cctx, this.lctx]) {
      ctx.setTransform(s, 0, 0, s, this.dpr * this.view.x, this.dpr * this.view.y);
    }
  }

  get width() { return this.cssW; }
  get height() { return this.cssH; }

  /** The world rectangle currently on screen, for culling. */
  visibleWorld() {
    const { x, y, k } = this.view;
    return { x: -x / k, y: -y / k, w: this.cssW / k, h: this.cssH / k };
  }

  rect() { return this.live.getBoundingClientRect(); }
  clearLive() { wipe(this.lctx, this.live); }
  clearCommitted() { wipe(this.cctx, this.committed); }
}

/**
 * Clear the whole backing store, under an identity transform.
 *
 * These used to pass DEVICE pixels straight into a context already carrying the
 * DPR transform, which over-cleared by a factor of `dpr` -- harmless only
 * because there was nothing outside the canvas to erase. Resetting first is
 * exact at any transform and cannot leave a ghost row at the edge.
 */
function wipe(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}
