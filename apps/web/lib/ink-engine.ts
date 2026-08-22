import type { Point, Stroke } from "@jotdojo/domain";
import type { InkTool } from "./canvas-tool";
import { StrokeCapture } from "./ink-capture";
import { eraseNear, restyle, without } from "./ink-edit";
import { bindPointer, PalmGuard, pointFrom, samplesOf } from "./ink-pointer";
import { InkSurface } from "./ink-surface";
import { InkSelection, NO_SELECTION, type SelectionSummary } from "./ink-selection";
import { paintStroke } from "./ink-paint";
import { drawOverlay, drawPage } from "./ink-draw";
import { DEFAULT_PEN, type InkStyle } from "./ink-style";

/**
 * The ink engine: an imperative island React mounts and then leaves alone.
 * Two canvases -- `committed` for finished strokes, `live` for the stroke under
 * the pen, the lasso and the marquee. docs/08-ink.md, ADR-027, ADR-033.
 */

/** Re-exported so callers need not also import canvas-tool.ts. */
export type Tool = InkTool;

/** Re-exported: callers take the summary from the engine they already hold. */
export type { SelectionSummary } from "./ink-selection";

export type EngineOptions = {
  committed: HTMLCanvasElement;
  live: HTMLCanvasElement;
  /** Called when strokes are added, so the sync layer can queue them. */
  onStrokes: (strokes: Stroke[], firstIndex: number) => void;
  /** Erase, move and delete all change the middle of the page, and the append
   *  protocol cannot express that -- so the whole document is resent. */
  onReplace: (strokes: Stroke[]) => void;
  /** What is selected, so the UI can offer the right things to do with it.
   *  The kinds matter: a marker recoloured to ink is the grey smear ADR-045
   *  exists to prevent, so its own palette has to be reachable. */
  onSelectionChange?: (selection: SelectionSummary) => void;
};

export class InkEngine {
  private readonly surface: InkSurface;
  private readonly live: HTMLCanvasElement;
  private readonly opts: EngineOptions;
  private readonly palm = new PalmGuard();
  private readonly sel = new InkSelection();
  private readonly capture = new StrokeCapture();

  private strokes: Stroke[] = [];
  private currentTool: Tool = "pen";
  private penDown = false;
  private activePointer: number | null = null;
  private startedAt = 0;
  private raf = 0;
  private erasedThisDrag = false;
  private style: InkStyle = DEFAULT_PEN;
  private unbind: () => void;

  constructor(opts: EngineOptions) {
    this.opts = opts;
    this.surface = new InkSurface(opts.committed, opts.live);
    this.live = opts.live;

    this.unbind = bindPointer(this.live, { down: this.onDown, move: this.onMove, up: this.onUp });
    // Without this, a two-finger drag scrolls the page mid-stroke.
    this.live.style.touchAction = "none";
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.unbind();
  }

  setTool(tool: Tool) {
    // Leaving select drops the selection: a marquee that outlives the tool that
    // made it is a promise the next pen stroke will not keep.
    if (tool !== "select") this.dropSelection();
    this.currentTool = tool;
    this.capture.setStyle(tool, this.style.color, this.style.width);
  }

  /** Colour and width for the CURRENT tool. React owns one of these per tool
   *  and pushes whichever applies, so the marker keeps its own. ADR-045. */
  setStyle(style: InkStyle) {
    this.style = style;
    this.capture.setStyle(this.currentTool, style.color, style.width);
  }

  /** Load an existing page. Replaces everything and repaints once. */
  load(strokes: Stroke[]) {
    this.strokes = strokes.map((s) => ({ ...s, pts: [...s.pts] }));
    this.dropSelection();
    this.repaint();
  }

  /** Resizing clears both canvases, so the repaint is not optional. */
  resize(cssWidth: number, cssHeight: number) {
    this.surface.resize(cssWidth, cssHeight);
    this.repaint();
    this.paintOverlay();
  }

  // --------------------------------------------------------- selection ----

  private dropSelection() {
    if (!this.sel.clear()) return;
    this.opts.onSelectionChange?.(NO_SELECTION);
    this.paintOverlay();
  }

  /**
   * Recolour or resize what the lasso caught.
   *
   * The selection survives, so somebody can try three colours without
   * re-lassoing. The strokes are mutated in place for exactly that reason.
   */
  restyleSelection(patch: { color?: string; width?: number }) {
    if (this.sel.count === 0) return;
    if (!restyle(this.sel.selected, patch)) return;
    this.repaint();
    this.paintOverlay();
    this.opts.onReplace(this.strokes);
  }

  /** Delete what the lasso caught. The page is resent, as with erase. */
  deleteSelection() {
    if (this.sel.count === 0) return;
    this.strokes = without(this.strokes, new Set(this.sel.selected));
    this.dropSelection();
    this.repaint();
    this.opts.onReplace(this.strokes);
  }

  // ------------------------------------------------------------- input ----

  private pointAt(e: PointerEvent): Point {
    return pointFrom(e, this.surface.rect(), this.startedAt);
  }

  private onDown = (e: PointerEvent) => {
    if (!this.palm.accepts(e)) return;
    e.preventDefault();
    this.live.setPointerCapture(e.pointerId);
    this.activePointer = e.pointerId;
    this.penDown = true;
    this.startedAt = performance.now();
    this.erasedThisDrag = false;

    const p = this.pointAt(e);

    if (this.currentTool === "eraser") return void this.eraseAt(p[0], p[1]);

    if (this.currentTool === "select") {
      // Inside an existing marquee means "move this", not "start over" --
      // otherwise a selection could never be dragged, only redrawn.
      if (this.sel.covers(p[0], p[1])) return void this.sel.beginDrag(p[0], p[1]);
      this.dropSelection();
      this.sel.beginLasso(p);
      return void this.scheduleLive();
    }

    this.capture.begin(p);
    this.scheduleLive();
  };

  private onMove = (e: PointerEvent) => {
    if (!this.penDown || e.pointerId !== this.activePointer) return;
    e.preventDefault();

    if (this.currentTool === "eraser") {
      const p = this.pointAt(e);
      return void this.eraseAt(p[0], p[1]);
    }

    if (this.currentTool === "select") {
      const p = this.pointAt(e);
      if (this.sel.dragging) {
        if (this.sel.dragTo(p[0], p[1])) { this.repaint(); this.paintOverlay(); }
        return;
      }
      this.sel.extendLasso(p);
      return void this.scheduleLive();
    }

    const rect = this.surface.rect();
    for (const sample of samplesOf(e)) {
      this.capture.extend(pointFrom(sample, rect, this.startedAt));
    }
    this.scheduleLive();
  };

  private onUp = (e: PointerEvent) => {
    if (!this.penDown || e.pointerId !== this.activePointer) return;
    this.penDown = false;
    this.activePointer = null;
    if (this.live.hasPointerCapture(e.pointerId)) this.live.releasePointerCapture(e.pointerId);

    if (this.currentTool === "eraser") {
      if (this.erasedThisDrag) this.opts.onReplace(this.strokes);
      return;
    }

    if (this.currentTool === "select") return void this.finishSelect();

    const stroke = this.capture.finish();
    if (!stroke) return;
    this.strokes.push(stroke);

    // Commit to the durable layer and clear the live one, so the finished
    // stroke stops being repainted every frame.
    paintStroke(this.surface.cctx, stroke);
    this.surface.clearLive();

    this.opts.onStrokes([stroke], this.strokes.length - 1);
  };

  private finishSelect() {
    if (this.sel.dragging) {
      if (this.sel.endDrag()) this.opts.onReplace(this.strokes);
      return;
    }
    this.sel.settle(this.strokes);
    this.opts.onSelectionChange?.(this.sel.summary);
    this.paintOverlay();
  }

  private eraseAt(x: number, y: number) {
    const kept = eraseNear(this.strokes, x, y);
    if (!kept) return;
    this.strokes = kept;
    this.erasedThisDrag = true;
    this.repaint();
  }

  // ----------------------------------------------------------- render ----

  private scheduleLive() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.paintOverlay();
      if (this.capture.active) paintStroke(this.surface.lctx, this.capture.preview());
    });
  }

  private paintOverlay() { drawOverlay(this.surface, this.sel); }
  private repaint() { drawPage(this.surface, this.strokes); }
}
