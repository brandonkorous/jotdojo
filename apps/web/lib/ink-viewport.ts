import type { Bounds } from "@jotacular/ink-render";

/**
 * Where the camera is over an endless surface. ADR-053.
 *
 * `screen = world * k + (x, y)`. Three numbers, no DOM, no canvas -- so the
 * conversion can be tested without a browser, which matters because there is no
 * DOM harness in this repo and this is the arithmetic that goes quietly wrong.
 *
 * NEVER held in React state. Panning must not re-render anything (docs/08).
 */

/** A frozen read of the camera. `pointFrom` takes this rather than the class,
 *  so the coalesced-sample loop does property reads and no method calls. */
export type ViewSnapshot = { readonly x: number; readonly y: number; readonly k: number };

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;

/** Breathing room around the ink when fitting, in SCREEN pixels. */
const FIT_PAD = 48;

const clampZoom = (k: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));

/** A pinch in progress: the world point under the initial midpoint, and the
 *  spread and zoom it started at. */
export type Pinch = { wx: number; wy: number; d0: number; k0: number };

export class InkViewport implements ViewSnapshot {
  x = 0;
  y = 0;
  k = 1;

  /**
   * Where `fitTo` last put the camera, which is what "back" means.
   *
   * Measured against this rather than against the origin, because opening a
   * note FRAMES its ink -- so the origin is not where anybody started, and a
   * "return" chip that appeared the instant a page loaded would be noise.
   */
  private home = { x: 0, y: 0, k: 1 };

  toWorldX(sx: number) { return (sx - this.x) / this.k; }
  toWorldY(sy: number) { return (sy - this.y) / this.k; }

  panBy(dx: number, dy: number) {
    this.x += dx;
    this.y += dy;
  }

  /** Zoom while holding the world point under (sx, sy) still. Returns whether
   *  the zoom actually changed, so a caller can skip telling React. */
  zoomAbout(sx: number, sy: number, factor: number): boolean {
    const k = clampZoom(this.k * factor);
    if (k === this.k) return false;
    const wx = this.toWorldX(sx);
    const wy = this.toWorldY(sy);
    this.k = k;
    this.x = sx - wx * k;
    this.y = sy - wy * k;
    return true;
  }

  /** Hold the world point captured at pinch start under the CURRENT midpoint.
   *  A two-finger drag with unchanged spread falls out of this as a pure pan,
   *  which is why there is no separate pan path to get wrong. */
  applyPinch(p: Pinch, mx: number, my: number, d: number): boolean {
    const k = clampZoom(p.d0 > 0 ? p.k0 * (d / p.d0) : p.k0);
    const changed = k !== this.k;
    this.k = k;
    this.x = mx - p.wx * k;
    this.y = my - p.wy * k;
    return changed;
  }

  /** The world rectangle currently on screen, for culling. */
  visible(cssW: number, cssH: number): Bounds {
    return { x: -this.x / this.k, y: -this.y / this.k, w: cssW / this.k, h: cssH / this.k };
  }

  /**
   * Frame the ink.
   *
   * An empty page lands on exactly `0, 0, 1` -- identical to how the canvas
   * behaved before there was a viewport at all. `k` is capped at 1 so a
   * three-word note is not blown up to fill the screen.
   */
  fitTo(box: Bounds | null, cssW: number, cssH: number) {
    if (!box || box.w <= 0 || box.h <= 0 || cssW <= 0 || cssH <= 0) {
      this.x = 0;
      this.y = 0;
      this.k = 1;
      return this.settle();
    }
    const k = Math.min(1, (cssW - FIT_PAD * 2) / box.w, (cssH - FIT_PAD * 2) / box.h);
    this.k = clampZoom(k);
    this.x = cssW / 2 - (box.x + box.w / 2) * this.k;
    this.y = cssH / 2 - (box.y + box.h / 2) * this.k;
    this.settle();
  }

  /** Adopt the current camera as the one to come back to. */
  private settle() {
    this.home = { x: this.x, y: this.y, k: this.k };
  }

  /**
   * Keep the middle of the view still across a resize.
   *
   * The ResizeObserver fires when the iOS keyboard opens and when a tablet
   * rotates. Re-fitting there would teleport the page out from under someone
   * mid-sentence; anchoring just widens the window onto the same place.
   */
  keepCentre(oldW: number, oldH: number, newW: number, newH: number) {
    if (oldW <= 0 || oldH <= 0) return;
    const dx = (newW - oldW) / 2;
    const dy = (newH - oldH) / 2;
    this.x += dx;
    this.y += dy;
    // The anchor moves with the camera, or the iOS keyboard opening would look
    // like the reader had panned away from their own page.
    this.home.x += dx;
    this.home.y += dy;
  }

  /** Sitting exactly where the page was last framed -- so there is nowhere to
   *  go back to, and nothing to offer. A fresh page's home is `0, 0, 1`. */
  get atHome() {
    return this.k === this.home.k && this.x === this.home.x && this.y === this.home.y;
  }
}
