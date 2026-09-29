import type { Stroke } from "@jotacular/domain";
import type { InkSurface } from "./ink-surface";
import type { StrokeIndex } from "./ink-index";
import { paintStroke } from "./ink-paint";
import { paintHighlights } from "./ink-paint-highlight";

/** One run of consecutive strokes in the page's order, and its place in it. */
export type InkRun = { strokes: readonly Stroke[]; rank: number };

/**
 * Ink that sits ABOVE something on the object plane, painted like the ink
 * under it: a canvas per run, the size of the window, holding only what is on
 * screen. ADR-136, ADR-137.
 *
 * Each canvas lives on the plane so it can take a rank among the objects, and
 * cancels the plane's camera transform so it paints in screen space. Its cost
 * is the strokes in view, never the strokes on the page, and a run with none
 * in view has no canvas at all.
 */
export class RunLayers {
  private pool: HTMLCanvasElement[] = [];

  constructor(private readonly el: HTMLElement) {}

  paint(runs: readonly InkRun[], surface: InkSurface, index: StrokeIndex) {
    const world = surface.visibleWorld();
    let used = 0;
    for (const run of runs) {
      const shown = index.visible(run.strokes, world);
      if (shown.length === 0) continue;
      const canvas = this.canvas(used++, surface);
      canvas.style.zIndex = String(run.rank);
      draw(canvas, shown, surface);
    }
    for (let i = used; i < this.pool.length; i++) this.pool[i]!.style.display = "none";
  }

  destroy() { for (const c of this.pool) c.remove(); this.pool = []; }

  private canvas(i: number, surface: InkSurface): HTMLCanvasElement {
    let c = this.pool[i];
    if (!c) {
      c = document.createElement("canvas");
      c.className = "jd-run-layer";
      c.setAttribute("aria-hidden", "true");
      this.el.append(c);
      this.pool.push(c);
    }
    const w = Math.round(surface.width * surface.ratio);
    const h = Math.round(surface.height * surface.ratio);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const { x, y, k } = surface.camera;
    // The plane is translate(x, y) scale(k); this undoes it, so the canvas
    // sits on the window while its z-index still counts among the objects.
    Object.assign(c.style, {
      display: "block", width: `${surface.width}px`, height: `${surface.height}px`,
      transform: `scale(${1 / k}) translate(${-x}px, ${-y}px)`,
    });
    return c;
  }
}

function draw(canvas: HTMLCanvasElement, strokes: readonly Stroke[], surface: InkSurface) {
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const { x, y, k } = surface.camera;
  const r = surface.ratio;
  ctx.setTransform(r * k, 0, 0, r * k, r * x, r * y);
  paintHighlights(ctx, strokes.filter((s) => s.tool === "highlighter"));
  for (const s of strokes) if (s.tool !== "highlighter") paintStroke(ctx, s);
}
