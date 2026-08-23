import type { InkDelta, Stroke } from "@jotdojo/domain";
import type { InkTool } from "./canvas-tool";
import { StrokeCapture } from "./ink-capture";
import { eraseNear, restyle, without } from "./ink-edit";
import { mergePages, newcomers } from "./ink-merge";
import { ERASE_RADIUS } from "./ink-paint";
import { InkSurface } from "./ink-surface";
import { InkInput, type InputHost } from "./ink-input";
import { InkViewport } from "./ink-viewport";
import { InkFraming } from "./ink-framing";
import { StrokeIndex } from "./ink-index";
import { InkSelection, NO_SELECTION, type SelectionSummary } from "./ink-selection";
import { commitStroke, type Scene } from "./ink-draw";
import { InkPainter } from "./ink-painter";
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
  /**
   * Erase, move, recolour and delete all change the middle of the page, which
   * the append protocol cannot express. They are sent as a delta naming the
   * strokes involved -- never as a fresh copy of the whole page, which would
   * discard whatever another device drew in the meantime. ADR-058.
   */
  onDelta: (delta: InkDelta) => void;
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
  private readonly painter: InkPainter;
  private readonly framing: InkFraming;
  /** Ids rubbed out during the current eraser sweep. */
  private readonly erased = new Set<string>();

  constructor(opts: EngineOptions) {
    this.opts = opts;
    this.surface = new InkSurface(opts.committed, opts.live, this.view);
    this.painter = new InkPainter(this.surface, this.view, () => this.scene, opts.grid);
    this.framing = new InkFraming(this.view, this.surface, this.painter, opts.onView);
    this.live = opts.live;

    // Without this, a two-finger drag scrolls the page mid-stroke.
    this.live.style.touchAction = "none";
    this.input = new InkInput(this.live, this);
  }

  destroy() {
    this.painter.cancel();
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

  /**
   * Strokes somebody else drew. The camera does not move and the selection is
   * not touched -- writing here must not scroll out from under somebody
   * because a laptop in the next room caught up. ADR-058.
   */
  applyRemote(incoming: Stroke[]) {
    if (newcomers(this.strokes, incoming).length === 0) return;
    this.strokes = mergePages(this.strokes, incoming);
    this.repaint();
  }

  /** Adopt the server's page, keeping what is still queued here. The selection
   *  goes, because the strokes it pointed at may not have survived. */
  reconcile(server: Stroke[], pending: readonly Stroke[]) {
    this.strokes = mergePages(server, pending);
    this.dropSelection();
    this.repaint();
  }

  fitToContent() { this.framing.fitTo(this.strokes); }

  resize(cssWidth: number, cssHeight: number) { this.framing.resize(cssWidth, cssHeight); }

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
    // The strokes themselves, because a recolour changes what they ARE. The
    // server matches them by id and keeps their place in paint order.
    this.opts.onDelta({ remove: [], upsert: [...this.selection.selected] });
  }

  /** Delete what the lasso caught, naming them rather than resending the
   *  page around them. */
  deleteSelection() {
    if (this.selection.count === 0) return;
    const doomed = [...this.selection.selected];
    this.strokes = without(this.strokes, new Set(doomed));
    this.dropSelection();
    this.repaint();
    this.opts.onDelta({ remove: doomed.map((s) => s.id), upsert: [] });
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
    const hit = eraseNear(this.strokes, x, y, ERASE_RADIUS / this.view.k);
    if (!hit) return false;
    this.strokes = hit.kept;
    // Accumulated across the whole sweep, so dragging the eraser over a
    // sentence is one delta rather than one per pointer sample.
    for (const stroke of hit.removed) this.erased.add(stroke.id);
    this.repaint();
    return true;
  }

  endErase(erased: boolean) {
    if (!erased || this.erased.size === 0) return;
    this.opts.onDelta({ remove: [...this.erased], upsert: [] });
    this.erased.clear();
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
      // Moved strokes are the same strokes with different points, so this is
      // an upsert by id -- nothing else on the page is touched.
      if (this.selection.endDrag()) {
        this.opts.onDelta({ remove: [], upsert: [...this.selection.selected] });
      }
      return;
    }
    this.selection.settle(this.strokes);
    this.opts.onSelectionChange?.(this.selection.summary);
    this.paintOverlay();
  }

  // ----------------------------------------------------------- render ----
  // WHEN to paint is `InkPainter`; this is only which paint to ask for.

  private get scene(): Scene {
    return {
      strokes: this.strokes, sel: this.selection, capture: this.strokeCapture,
      index: this.index, k: this.view.k,
    };
  }

  /** The camera moved under the pointer: framing decides what that costs. */
  onView() { this.framing.moved(); }

  scheduleLive() { this.painter.live(); }
  private paintOverlay() { this.painter.overlay(); }
  private repaint() { this.painter.page(); }
}
