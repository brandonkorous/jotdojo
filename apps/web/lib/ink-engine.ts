import type { ImageOnPage, Link, NoteImage, Stroke, TextBox } from "@jotacular/domain";
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
import type { InkDoc } from "./ink-engine-doc";
import type { InkLinks } from "./ink-engine-links";
import type { SelectionEditor } from "./ink-engine-select";
import type { Eraser } from "./ink-engine-erase";
import { InkTaps } from "./ink-engine-tap";
import type { ArmedSticker } from "./ink-sticker-layer";
import { InkOpen } from "./ink-engine-open";
import { commitStroke, type Scene } from "./ink-draw";
import type { InkPainter } from "./ink-painter";
import type { InkPins } from "./ink-pins";
import { DEFAULT_PEN, type InkStyle } from "./ink-style";
import type { ObjectPlane } from "./ink-object-plane";

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
  /** The arrows, and the one being aimed. Null beside `plane`. ADR-108. */
  readonly links: InkLinks | null;
  /** What happened to the page, and what can be taken back. ADR-109, ADR-110. */
  readonly doc: InkDoc;
  /** What a tap on the page means, of the four things it can mean. ADR-108. */
  private readonly taps: InkTaps;
  /** Loading a page, resizing it, and pointing the camera at any of it.
   *  Exposed rather than relayed, as `selection` and `remote` are: five
   *  one-line wrappers only restated it. ADR-053. */
  readonly open: InkOpen;

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
      style: () => this.style,
      visibleWidth: () => this.view.visible(this.surface.width, this.surface.height).w,
      reach: () => ERASE_RADIUS / this.view.k,
      repaint: () => this.repaint(),
      overlay: () => this.paintOverlay(),
      dropSelection: () => this.dropSelection(),
      onSelection: () => this.opts.onSelectionChange?.(this.editor.sel.summary),
    });
    this.surface = parts.surface;
    this.plane = parts.plane;
    this.pins = parts.pins;
    this.links = parts.links;
    this.doc = parts.doc;
    this.painter = parts.painter;
    this.framing = parts.framing;
    this.editor = parts.editor;
    this.remote = parts.remote;
    this.eraser = parts.eraser;
    this.live = opts.live;

    this.open = parts.open;
    this.taps = parts.taps;

    // Without this, a two-finger drag scrolls the page mid-stroke.
    this.live.style.touchAction = "none";
    this.input = new InkInput(this.live, this, opts.gestures);
  }

  destroy() {
    this.painter.cancel();
    this.input.destroy();
    this.plane?.destroy();
    this.pins?.destroy();
    this.links?.destroy();
  }

  /** The page as one set of objects rather than three arrays. Comments and
   *  arrows both ask for it; `ink-engine-page.ts` is what reads it. ADR-107. */
  get objects(): Page {
    return {
      strokes: this.strokes,
      texts: this.texts?.all ?? [],
      images: this.plane?.images.all ?? [],
      stickers: this.plane?.stickers.all ?? [],
    };
  }

  /** The text half of the plane, which is all most call sites ever wanted. */
  private get texts() { return this.plane?.texts ?? null; }

  setTool(tool: Tool) {
    // Leaving select drops the selection: a marquee that outlives the tool that
    // made it is a promise the next pen stroke will not keep. An arrow waiting
    // for its second end goes the same way, and for the same reason -- but
    // ARRIVING at select must not cancel one, because that is the tool aiming
    // puts in your hand. ADR-108.
    if (tool !== "select") {
      this.dropSelection();
      this.links?.cancelAim();
    }
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

  /** Which sticker is loaded, if any. The tap handler holds it; this is only
   *  the door React pushes it through. ADR-115. */
  setSticker(sticker: ArmedSticker | null) { this.taps.setSticker(sticker); }

  /** InputHost: put the loaded sticker down here. ADR-115. */
  stampSticker(x: number, y: number) { this.taps.sticker(x, y); }

  /** Start an arrow from the one object that is held. The next tap on another
   *  finishes it; tapping the same one again calls it off. ADR-108. */
  aimFrom(id: string) {
    this.links?.beginAim(id, { color: this.style.color, width: DEFAULT_PEN.width });
  }

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

  /** Whether the text plane took the tap. `ink-engine-tap.ts` owns what a tap
   *  MEANS; everything here is only the wire into it. */
  tapText(x: number, y: number): boolean { return this.taps.text(x, y); }

  /** The box being dragged out. Overlay only: an abandoned drag leaves no
   *  trace, because nothing is stored until the pointer lifts. ADR-078. */
  previewText(rect: Bounds | null) { this.pendingText = rect; }

  /** A box at exactly the rectangle somebody drew. ADR-078. */
  drawText(rect: Bounds) { this.taps.drawText(rect); }

  /** One object, by tapping it -- or the far end of an arrow being aimed. */
  tapSelect(x: number, y: number) { this.taps.select(x, y); }

  /** The three the canvas menu reaches for, all in CLIENT coordinates.
   *  `ink-engine-tap.ts` owns the arithmetic and what each one means. */
  selectAtClient(x: number, y: number) { this.taps.selectAtClient(x, y); }

  textAtClient(x: number, y: number) { this.taps.textAtClient(x, y); }

  marqueeRect(): DOMRect | null { return this.taps.marqueeRect(); }

  /** Anything with a caret in it should lose it before the pen touches down. */
  blurText() { this.texts?.blur(); }

  eraseAt(x: number, y: number): boolean { return this.eraser.at(x, y); }

  endErase(erased: boolean) { this.eraser.end(erased); }

  commit(stroke: Stroke) {
    this.strokes.push(stroke);
    commitStroke(this.surface, stroke);
    // Recorded, not published: the stroke goes out as an APPEND, and only the
    // way back from it is a delta. ADR-109.
    this.doc.history.record({ remove: [], upsert: [stroke] });
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
      // A thunk, so a frame that only repaints the overlay never resolves an
      // arrow. `Scene` says why that matters. ADR-108.
      links: () => this.links?.segments() ?? [],
      aim: this.links?.aimSegment() ?? null,
    };
  }

  /** The camera moved under the pointer: framing decides what that costs. */
  onView() { this.framing.moved(); }

  scheduleLive() { this.painter.live(); }
  private paintOverlay() { this.painter.overlay(); }
  private repaint() { this.painter.page(); }
}
