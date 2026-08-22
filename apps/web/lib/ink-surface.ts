import { MAX_DPR } from "./ink-paint";

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

  constructor(
    readonly committed: HTMLCanvasElement,
    readonly live: HTMLCanvasElement,
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
    for (const canvas of [this.committed, this.live]) {
      canvas.width = Math.round(cssWidth * this.dpr);
      canvas.height = Math.round(cssHeight * this.dpr);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
    }
    for (const ctx of [this.cctx, this.lctx]) {
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
  }

  rect() { return this.live.getBoundingClientRect(); }
  clearLive() { this.lctx.clearRect(0, 0, this.live.width, this.live.height); }
  clearCommitted() { this.cctx.clearRect(0, 0, this.committed.width, this.committed.height); }
}
