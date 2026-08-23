import type { InkDelta, Stroke, TextBox } from "@jotdojo/domain";
import type { InkTool } from "./canvas-tool";
import { StrokeCapture } from "./ink-capture";
import { eraseNear } from "./ink-edit";
import { mergePages, newcomers } from "./ink-merge";
import { ERASE_RADIUS } from "./ink-paint";
import { InkSurface } from "./ink-surface";
import { InkInput, type InputHost } from "./ink-input";
import { InkViewport } from "./ink-viewport";
import { InkFraming } from "./ink-framing";
import { StrokeIndex } from "./ink-index";
import { type SelectionSummary } from "./ink-selection";
import type { EngineOptions } from "./ink-engine-options";
import { SelectionEditor } from "./ink-engine-select";
import { commitStroke, type Scene } from "./ink-draw";
import { InkPainter } from "./ink-painter";
import { DEFAULT_PEN, type InkStyle } from "./ink-style";
import { InkTextLayer } from "./ink-text-layer";

/**
 * The ink engine: an imperative island React mounts and then leaves alone.
 * Two canvases -- `committed` for finished strokes, `live` for the stroke under
 * the pen, the lasso and the marquee. docs/08-ink.md, ADR-027, ADR-033.
 */

/** Re-exported so callers take both from the engine they already hold. */
export type Tool = InkTool;
export type { SelectionSummary } from "./ink-selection";

export type { EngineOptions } from "./ink-engine-options";

export class InkEngine implements InputHost {
  readonly surface: InkSurface;
  private readonly live: HTMLCanvasElement;
  private readonly opts: EngineOptions;
  private readonly strokeCapture = new StrokeCapture();
  /** The camera. Never in React state -- panning must re-render nothing. */
  readonly view = new InkViewport();
  private readonly index = new StrokeIndex();
  private readonly editor: SelectionEditor;

  private strokes: Stroke[] = [];
  private currentTool: Tool = "pen";
  private style: InkStyle = DEFAULT_PEN;
  private readonly input: InkInput;
  private readonly painter: InkPainter;
  private readonly framing: InkFraming;
  /** Typed text, when a plane was supplied. Null on the marketing hero, which
   *  mounts ink alone. */
  private readonly texts: InkTextLayer | null;
  /** Ids rubbed out during the current eraser sweep. */
  private readonly erased = new Set<string>();

  constructor(opts: EngineOptions) {
    this.opts = opts;
    this.surface = new InkSurface(opts.committed, opts.live, this.view);
    this.texts = opts.plane
      ? new InkTextLayer(opts.plane, {
        // A text box is an object on the page like a stroke is, so it travels
        // as the same delta -- one version, one subscription. ADR-058, ADR-065.
        onChange: (boxes) => opts.onDelta({ remove: [], upsert: [], texts: [...boxes] }),
        onGeometry: () => this.paintOverlay(),
      })
      : null;
    this.painter = new InkPainter(
      this.surface, this.view, () => this.scene, opts.grid, this.texts ?? undefined,
    );
    this.framing = new InkFraming(this.view, this.surface, this.painter, opts.onView);
    this.editor = new SelectionEditor({
      strokes: () => this.strokes,
      setStrokes: (next) => { this.strokes = next; },
      texts: () => this.texts,
      index: this.index,
      onDelta: opts.onDelta,
      onChange: opts.onSelectionChange,
      repaint: () => this.repaint(),
      overlay: () => this.paintOverlay(),
    });
    this.live = opts.live;

    // Without this, a two-finger drag scrolls the page mid-stroke.
    this.live.style.touchAction = "none";
    this.input = new InkInput(this.live, this);
  }

  destroy() {
    this.painter.cancel();
    this.input.destroy();
    this.texts?.destroy();
  }

  setTool(tool: Tool) {
    // Leaving select drops the selection: a marquee that outlives the tool that
    // made it is a promise the next pen stroke will not keep.
    if (tool !== "select") this.dropSelection();
    this.currentTool = tool;
    this.strokeCapture.setStyle(tool, this.style.color, this.style.width);
    // Only the text tool lets a box take the pointer. Everything else has to
    // pass through the plane to the canvas underneath, or half the surface
    // stops being drawable without showing why. ADR-065.
    this.texts?.setTool(tool);
  }

  /** Colour and width for the CURRENT tool. React owns one of these per tool
   *  and pushes whichever applies, so the marker keeps its own. ADR-045. */
  setStyle(style: InkStyle) {
    this.style = style;
    this.strokeCapture.setStyle(this.currentTool, style.color, style.width);
  }

  /** Load an existing page, and frame it. Opening a note on an endless
   *  surface must never land on empty paper miles from the writing. */
  load(strokes: Stroke[], texts: TextBox[] = []) {
    this.strokes = strokes.map((s) => ({ ...s, pts: [...s.pts] }));
    this.texts?.load(texts);
    this.dropSelection();
    this.fitToContent();
  }

  /** Somebody else's text boxes. Like applyRemote for strokes: the camera does
   *  not move, and the box being typed into is not overwritten. */
  applyRemoteTexts(texts: TextBox[]) { this.texts?.applyRemote(texts); }

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

  fitToContent() { this.framing.fitTo(this.strokes, this.texts?.bounds()); }

  resize(cssWidth: number, cssHeight: number) { this.framing.resize(cssWidth, cssHeight); }

  // Editing what the lasso caught is `SelectionEditor`: it reaches two arrays
  // now and had outgrown a class that also owns the frame loop.
  dropSelection() { this.editor.drop(); }
  deleteSelection() { this.editor.remove(); }
  restyleSelection(patch: { color?: string; width?: number }, publish = true) {
    this.editor.restyle(patch, publish);
  }

  // ------------------------------------------------------------- input ----
  //
  // `InkInput` owns what a pointer is DOING; everything below is what the page
  // does about it. The host contract is narrow on purpose -- input may ask for
  // changes and may never paint.

  get tool() { return this.currentTool; }
  get sel() { return this.editor.sel; }
  get capture() { return this.strokeCapture; }

  /** Whether the text plane took the tap. The canvas draws nothing when it did,
   *  so a stray stroke never lands under a box somebody is editing. */
  tapText(x: number, y: number): boolean {
    const width = this.view.visible(this.surface.width, this.surface.height).w;
    const took = this.texts?.tapAt(x, y, this.style, width) ?? false;
    if (took) this.opts.onTextPlaced?.();
    return took;
  }

  /** Anything with a caret in it should lose it before the pen touches down. */
  blurText() { this.texts?.blur(); }

  eraseAt(x: number, y: number): boolean {
    // The eraser does NOT delete text boxes -- whiteboard convention, and the
    // right one: rubbing at a diagram should not silently swallow the label
    // beside it. Lasso and Delete are how a box goes. ADR-065.
    //
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

  dragSelection(x: number, y: number) { this.editor.dragTo(x, y); }

  finishSelect() { this.editor.finish(); }

  // ----------------------------------------------------------- render ----
  // WHEN to paint is `InkPainter`; this is only which paint to ask for.

  private get scene(): Scene {
    return {
      strokes: this.strokes, sel: this.editor.sel, capture: this.strokeCapture,
      index: this.index, k: this.view.k,
    };
  }

  /** The camera moved under the pointer: framing decides what that costs. */
  onView() { this.framing.moved(); }

  scheduleLive() { this.painter.live(); }
  private paintOverlay() { this.painter.overlay(); }
  private repaint() { this.painter.page(); }
}
