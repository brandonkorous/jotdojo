import type { ImageOnPage, NoteImage, Stroke, TextBox } from "@jotacular/domain";
import type { InkTool } from "./canvas-tool";
import { StrokeCapture } from "./ink-capture";
import type { Bounds } from "./ink-geometry";
import type { LiveMerge } from "./ink-engine-live";
import type { InkSurface } from "./ink-surface";
import { InkInput, type InputHost } from "./ink-input";
import { InkViewport } from "./ink-viewport";
import type { InkFraming } from "./ink-framing";
import { StrokeIndex } from "./ink-index";
import { ERASE_RADIUS } from "./ink-paint";
import { type SelectionSummary } from "./ink-selection";
import type { EngineOptions } from "./ink-engine-options";
import { assemble } from "./ink-engine-build";
import type { Page } from "./ink-engine-page";
import type { SelectionEditor } from "./ink-engine-select";
import type { Eraser } from "./ink-engine-erase";
import { commitStroke, type Scene } from "./ink-draw";
import type { InkPainter } from "./ink-painter";
import type { InkPins } from "./ink-pins";
import { DEFAULT_PEN, type InkStyle } from "./ink-style";
import type { ObjectPlane } from "./ink-object-plane";
import { clientRect, worldAt } from "./ink-screen";

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
  private pendingText: Bounds | null = null;
  private style: InkStyle = DEFAULT_PEN;
  private readonly input: InkInput;
  private readonly painter: InkPainter;
  private readonly framing: InkFraming;
  /** Typed text and photographs, when a plane was supplied. Null on the
   *  marketing hero, which mounts ink alone. ADR-065, ADR-103. */
  private readonly plane: ObjectPlane | null;
  private readonly eraser: Eraser;
  readonly remote: LiveMerge;
  /** Where the comments are. Null wherever there is no layer to draw them on --
   *  the marketing hero, and an anonymous draft. ADR-107. */
  readonly pins: InkPins | null;

  constructor(opts: EngineOptions) {
    this.opts = opts;
    // Already wired -- ink-engine-build.ts says why that is a file of its own.
    // `remote` is exposed rather than relayed, as `selection` is. ADR-058.
    const parts = assemble(opts, this.view, this.index, {
      strokes: () => this.strokes,
      setStrokes: (next) => { this.strokes = next; },
      scene: () => this.scene,
      page: () => this.objects,
      zoom: () => this.view.k,
      repaint: () => this.repaint(),
      overlay: () => this.paintOverlay(),
      dropSelection: () => this.dropSelection(),
    });
    this.surface = parts.surface;
    this.plane = parts.plane;
    this.pins = parts.pins;
    this.painter = parts.painter;
    this.framing = parts.framing;
    this.editor = parts.editor;
    this.remote = parts.remote;
    this.eraser = parts.eraser;
    this.live = opts.live;

    // Without this, a two-finger drag scrolls the page mid-stroke.
    this.live.style.touchAction = "none";
    this.input = new InkInput(this.live, this, opts.gestures);
  }

  destroy() {
    this.painter.cancel();
    this.input.destroy();
    this.plane?.destroy();
    this.pins?.destroy();
  }

  /** The page as one set of objects rather than three arrays. Only comments
   *  ask for it; `ink-engine-page.ts` is what reads it. ADR-107. */
  get objects(): Page {
    return {
      strokes: this.strokes,
      texts: this.texts?.all ?? [],
      images: this.plane?.images.all ?? [],
    };
  }

  /** The text half of the plane, which is all most call sites ever wanted. */
  private get texts() { return this.plane?.texts ?? null; }
  setTool(tool: Tool) {
    // Leaving select drops the selection: a marquee that outlives the tool that
    // made it is a promise the next pen stroke will not keep.
    if (tool !== "select") this.dropSelection();
    this.currentTool = tool;
    this.strokeCapture.setStyle(tool, this.style.color, this.style.width);
  }

  /** Whether a note takes a tap. Separate from the tool: the spine reaches
   *  this engine as `pen`, and `canReachText` says why. ADR-085. */
  setTextReachable(on: boolean) { this.texts?.setReachable(on); }

  /** Colour and width for the CURRENT tool. React owns one of these per tool
   *  and pushes whichever applies, so the marker keeps its own. ADR-045. */
  setStyle(style: InkStyle) {
    this.style = style;
    this.strokeCapture.setStyle(this.currentTool, style.color, style.width);
  }

  /** Load a page and frame it: opening a note on an endless surface must never
   *  land on empty paper miles from the writing. */
  load(strokes: Stroke[], texts: TextBox[] = [], images: ImageOnPage[] = []) {
    this.strokes = strokes.map((s) => ({ ...s, pts: [...s.pts] }));
    this.plane?.load(texts, images);
    this.dropSelection();
    this.fitToContent();
  }

  /** Give a home to photographs taken before placements existed. Frames the
   *  page again when it rescued any, because the content just grew. ADR-103. */
  adoptImages(known: readonly NoteImage[]) {
    const at = this.framing.contentBounds(this.strokes, this.plane?.bounds());
    if (this.plane?.images.adoptOrphans(known, at)) this.fitToContent();
  }

  /** Put a photograph where somebody is looking. The bytes are already a
   *  `blocks` row; the page only learns where the picture goes. ADR-103. */
  placeImage(blockId: string, natural: { w: number; h: number }) {
    const r = this.surface.rect();
    this.plane?.images.place(blockId, natural, this.view, { w: r.width, h: r.height });
    this.paintOverlay();
  }

  fitToContent() { this.framing.fitTo(this.strokes, this.plane?.bounds()); }

  resize(cssWidth: number, cssHeight: number) { this.framing.resize(cssWidth, cssHeight); }

  dropSelection() { this.editor.drop(); }

  /** Editing what was caught is `SelectionEditor`, exposed rather than relayed:
   *  one-line wrappers only restated it, and every new action added another. */
  get selection() { return this.editor; }

  // ------------------------------------------------------------- input ----
  // `InkInput` owns what a pointer is DOING; everything below is what the page
  // does about it. Input may ask for changes and may never paint.

  get tool() { return this.currentTool; }
  get sel() { return this.editor.sel; }
  get capture() { return this.strokeCapture; }

  /** Whether the text plane took the tap. The canvas draws nothing when it did,
   *  so a stray stroke never lands under a box somebody is editing. */
  tapText(x: number, y: number): boolean {
    const width = this.view.visible(this.surface.width, this.surface.height).w;
    if (!this.texts?.tapAt(x, y, this.style, width)) return false;
    this.opts.onTextPlaced?.();
    return true;
  }

  /** The box being dragged out. Overlay only: an abandoned drag leaves no
   *  trace, because nothing is stored until the pointer lifts. ADR-078. */
  previewText(rect: Bounds | null) { this.pendingText = rect; }

  /** A box at exactly the rectangle somebody drew. ADR-078. */
  drawText(rect: Bounds) {
    if (this.texts?.drawAt(rect, this.style)) this.opts.onTextPlaced?.();
  }

  /** One object, by tapping it. Same screen-space reach as the eraser, so what
   *  you can rub out you can also pick up -- of all three kinds. ADR-084. */
  tapSelect(x: number, y: number) {
    const reach = ERASE_RADIUS / this.view.k;
    this.editor.pickAt(x, y, reach, this.texts?.all ?? [], this.plane?.images.all ?? []);
  }

  /** The same, from CLIENT coordinates: React has a MouseEvent, not a document
   *  point. `textAtClient` is its sibling for the menu's "put a note here". */
  selectAtClient(clientX: number, clientY: number) {
    const p = worldAt(this.surface, this.view, clientX, clientY);
    this.tapSelect(p.x, p.y);
  }

  textAtClient(clientX: number, clientY: number) {
    const p = worldAt(this.surface, this.view, clientX, clientY);
    this.tapText(p.x, p.y);
  }

  /** Where the selection is ON SCREEN, so the menu can point at the thing it
   *  acts on rather than at the thumb that summoned it. CanvasMenu says why.
   *  Null when nothing is selected. ADR-084. */
  marqueeRect(): DOMRect | null {
    const b = this.editor.sel.marquee;
    return b ? clientRect(this.surface, this.view, b) : null;
  }

  /** Anything with a caret in it should lose it before the pen touches down. */
  blurText() { this.texts?.blur(); }

  eraseAt(x: number, y: number): boolean { return this.eraser.at(x, y); }

  endErase(erased: boolean) { this.eraser.end(erased); }

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
      index: this.index, k: this.view.k, pendingText: this.pendingText,
    };
  }

  /** The camera moved under the pointer: framing decides what that costs. */
  onView() { this.framing.moved(); }

  scheduleLive() { this.painter.live(); }
  private paintOverlay() { this.painter.overlay(); }
  private repaint() { this.painter.page(); }
}
