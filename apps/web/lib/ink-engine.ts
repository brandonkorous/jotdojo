import type { Stroke } from "@jotdojo/domain";
import type { InkTool } from "./canvas-tool";
import { StrokeCapture } from "./ink-capture";
import { eraseNear, restyle, without } from "./ink-edit";
import { ERASE_RADIUS } from "./ink-paint";
import { InkSurface } from "./ink-surface";
import { InkInput, type InputHost } from "./ink-input";
import { InkViewport } from "./ink-viewport";
import { strokesBounds } from "@jotdojo/ink-render";
import { StrokeIndex } from "./ink-index";
import { InkSelection, NO_SELECTION, type SelectionSummary } from "./ink-selection";
import { commitStroke, drawAll, drawFrame, type Scene } from "./ink-draw";
import { FrameLoop, type Dirty } from "./ink-frame";
import { paintGrid } from "./ink-grid";
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
  /** The dot grid. Painted through CSS variables inside the frame loop, so it
   *  moves with the ink rather than a frame behind it. */
  grid?: HTMLElement;
  /** Fired ONLY when the zoom changes or the camera leaves or returns to home.
   *  Panning around out there re-renders nothing. */
  onView?: (k: number, home: boolean) => void;
};

export class InkEngine implements InputHost {
  readonly surface: InkSurface;
  private readonly live: HTMLCanvasElement;
  private readonly opts: EngineOptions;
  private readonly selection = new InkSelection();
  private readonly strokeCapture = new StrokeCapture();
  /** The camera. Never in React state -- panning must re-render nothing. */
  readonly view = new InkViewport();
  private readonly index = new StrokeIndex();

  private strokes: Stroke[] = [];
  private currentTool: Tool = "pen";
  private style: InkStyle = DEFAULT_PEN;
  private readonly input: InkInput;
  private readonly frame = new FrameLoop((d) => this.paint(d));
  /** The last camera React was told about, so it hears nothing on a pan. */
  private reported = { k: 1, home: true };

  constructor(opts: EngineOptions) {
    this.opts = opts;
    this.surface = new InkSurface(opts.committed, opts.live, this.view);
    this.live = opts.live;

    // Without this, a two-finger drag scrolls the page mid-stroke.
    this.live.style.touchAction = "none";
    this.input = new InkInput(this.live, this);
  }

  destroy() {
    this.frame.cancel();
    this.input.destroy();
  }

  setTool(tool: Tool) {
    // Leaving select drops the selection: a marquee that outlives the tool that
    // made it is a promise the next pen stroke will not keep.
    if (tool !== "select") this.dropSelection();
    this.currentTool = tool;
    this.strokeCapture.setStyle(tool, this.style.color, this.style.width);
  }

  /** Colour and width for the CURRENT tool. React owns one of these per tool
   *  and pushes whichever applies, so the marker keeps its own. ADR-045. */
  setStyle(style: InkStyle) {
    this.style = style;
    this.strokeCapture.setStyle(this.currentTool, style.color, style.width);
  }

  /** Load an existing page, and frame it. Opening a note on an endless
   *  surface must never land on empty paper miles from the writing. */
  load(strokes: Stroke[]) {
    this.strokes = strokes.map((s) => ({ ...s, pts: [...s.pts] }));
    this.dropSelection();
    this.fitToContent();
  }

  /** Frame the ink. An empty page lands on exactly where it always did. */
  fitToContent() {
    this.view.fitTo(strokesBounds(this.strokes), this.surface.width, this.surface.height);
    this.tellView();
    this.repaintNow();
  }

  /**
   * Resizing clears both canvases, so the repaint is not optional.
   *
   * The view is ANCHORED, not re-fitted: this fires when the iOS keyboard opens
   * and when a tablet rotates, and re-framing there would teleport the page out
   * from under somebody mid-sentence.
   */
  resize(cssWidth: number, cssHeight: number) {
    const was = { w: this.surface.width, h: this.surface.height };
    this.surface.resize(cssWidth, cssHeight);
    this.view.keepCentre(was.w, was.h, cssWidth, cssHeight);
    this.tellView();
    this.repaintNow();
  }

  // --------------------------------------------------------- selection ----

  dropSelection() {
    if (!this.selection.clear()) return;
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
    if (this.selection.count === 0) return;
    if (!restyle(this.selection.selected, patch)) return;
    this.index.invalidate(this.selection.selected);
    this.repaint();
    this.paintOverlay();
    this.opts.onReplace(this.strokes);
  }

  /** Delete what the lasso caught. The page is resent, as with erase. */
  deleteSelection() {
    if (this.selection.count === 0) return;
    this.strokes = without(this.strokes, new Set(this.selection.selected));
    this.dropSelection();
    this.repaint();
    this.opts.onReplace(this.strokes);
  }

  // ------------------------------------------------------------- input ----
  //
  // `InkInput` owns what a pointer is DOING; everything below is what the page
  // does about it. The host contract is narrow on purpose -- input may ask for
  // changes and may never paint.

  get tool() { return this.currentTool; }
  get sel() { return this.selection; }
  get capture() { return this.strokeCapture; }

  eraseAt(x: number, y: number): boolean {
    // A hit tolerance, so it is a SCREEN distance. Left in world units the
    // eraser would swallow the page zoomed out and miss everything zoomed in.
    const kept = eraseNear(this.strokes, x, y, ERASE_RADIUS / this.view.k);
    if (!kept) return false;
    this.strokes = kept;
    this.repaint();
    return true;
  }

  endErase(erased: boolean) {
    if (erased) this.opts.onReplace(this.strokes);
  }

  commit(stroke: Stroke) {
    this.strokes.push(stroke);
    commitStroke(this.surface, stroke);
    this.opts.onStrokes([stroke], this.strokes.length - 1);
  }

  dragSelection(x: number, y: number) {
    if (!this.selection.dragTo(x, y)) return;
    // Dragging mutates strokes IN PLACE, so the cached boxes are now lies.
    this.index.invalidate(this.selection.selected);
    this.repaint();
    this.paintOverlay();
  }

  finishSelect() {
    if (this.selection.dragging) {
      if (this.selection.endDrag()) this.opts.onReplace(this.strokes);
      return;
    }
    this.selection.settle(this.strokes);
    this.opts.onSelectionChange?.(this.selection.summary);
    this.paintOverlay();
  }

  // ----------------------------------------------------------- render ----

  private get scene(): Scene {
    return {
      strokes: this.strokes, sel: this.selection, capture: this.strokeCapture,
      index: this.index, k: this.view.k,
    };
  }

  /** The camera moved: everything on screen is now somewhere else. */
  onView() {
    this.frame.mark("page", "overlay", "grid");
    this.tellView();
  }

  /** React hears about the camera only when something it renders changed --
   *  the zoom readout, or whether there is anywhere to go back to. */
  private tellView() {
    const home = this.view.atHome;
    if (this.view.k === this.reported.k && home === this.reported.home) return;
    this.reported = { k: this.view.k, home };
    this.opts.onView?.(this.view.k, home);
  }

  scheduleLive() { this.frame.mark("live", "overlay"); }
  private paintOverlay() { this.frame.mark("overlay"); }
  private repaint() { this.frame.mark("page"); }

  private paint(dirty: ReadonlySet<Dirty>) {
    if (dirty.has("grid") && this.opts.grid) paintGrid(this.opts.grid, this.view);
    drawFrame(this.surface, dirty, this.scene);
  }

  private repaintNow() {
    if (this.opts.grid) paintGrid(this.opts.grid, this.view);
    drawAll(this.surface, this.scene);
  }
}
