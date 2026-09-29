import type { Stroke, TextBox } from "@jotacular/domain";
import type { ViewSnapshot } from "./ink-viewport";
import type { Bounds } from "./ink-geometry";
import { boxAt, boxesBounds, drawnBox, isEmpty, newBox } from "./ink-objects";
import { InkPlane, MIN_SIZE } from "./ink-plane";
import { NARROW } from "./use-narrow";
import { newBoxWidth } from "./new-box-width";
import { rememberedCard } from "./card-memory";
import type { StrokesIn } from "./ink-note-art";

/**
 * The text half of the engine. ADR-065.
 *
 * Split from ink-engine.ts, which was already at the size limit, and the seam
 * is a real one: the engine is a state machine over STROKES and a painter for
 * two canvases. Text is neither -- it is DOM, laid out by the browser, and the
 * only thing the two halves share is the camera and the selection.
 *
 * Everything here is world coordinates. `InkPlane` owns the elements.
 */

/** The rule lives in `new-box-width.ts` so a smoke script can assert it; this
 *  file only answers the question it cannot: whether we are on a phone. */
const onPhone = () =>
  typeof window !== "undefined" && window.matchMedia(NARROW).matches;

export type TextLayerHost = {
  /** A box changed and the page should hear about it. */
  onChange: (boxes: readonly TextBox[]) => void;
  /** Something moved that the camera should be able to frame. */
  onGeometry: () => void;
  /** What was drawn in a note. ADR-134. */
  strokesIn?: StrokesIn;
  /** The layer number just above everything on the page. ADR-136. */
  nextZ?: () => number;
};

export class InkTextLayer {
  private readonly plane: InkPlane;
  private readonly host: TextLayerHost;
  private boxes: TextBox[] = [];

  constructor(el: HTMLElement, host: TextLayerHost) {
    this.host = host;
    this.plane = new InkPlane(el, {
      onEdit: () => { this.plane.render(this.boxes); this.host.onGeometry(); },
      onDone: () => this.publish(),
      onRemove: (id) => {
        this.boxes = this.boxes.filter((b) => b.id !== id);
        this.plane.render(this.boxes);
        this.publish();
      },
      strokesIn: host.strokesIn,
    });
  }

  destroy() { this.plane.destroy(); }

  /** The elements standing for one object, for stacking. ADR-136. */
  els(id: string): Element[] { return this.plane.els(id); }

  get all(): readonly TextBox[] { return this.boxes; }
  get isEditing() { return this.plane.isEditing; }

  /** Load a page. Copied, because the engine mutates boxes in place when a
   *  selection is dragged -- the same reason `load` copies strokes. */
  load(boxes: readonly TextBox[]) {
    this.boxes = boxes.map((b) => ({ ...b }));
    this.plane.render(this.boxes);
  }

  /**
   * Somebody else's text. The caret does not move and the box being typed into
   * is not overwritten -- InkPlane refuses that, for the same reason `adopt`
   * refuses a remote revision while dirty. ADR-058.
   */
  applyRemote(boxes: readonly TextBox[]) {
    const mine = this.boxes.find((b) => b.id === this.editingId());
    this.boxes = boxes.map((b) => (b.id === mine?.id ? mine : { ...b }));
    // A box still being typed into may be too new for the other side to know
    // -- an empty one is never sent -- so it stays rather than vanishing.
    if (mine && !boxes.some((b) => b.id === mine.id)) this.boxes.push(mine);
    this.plane.render(this.boxes);
  }

  frame(view: ViewSnapshot) { this.k = view.k; this.plane.frame(view.x, view.y, view.k); }

  /** The zoom at the last frame, so a new box is readable where it is made. */
  private k = 1;

  /** 16px ON THE GLASS whatever the zoom, and never below the floor iOS needs:
   *  a box made at 10% used to have 1.6px text, a line nobody could read. */
  private get newSize() { return Math.max(MIN_SIZE, MIN_SIZE / this.k); }

  /**
   * Whether a note may take a pointer at all.
   *
   * A signal of its own rather than a reading of the tool, and that IS the fix:
   * `inkToolFor` collapses the spine to `"pen"` before the engine sees it, so a
   * tool-derived answer said no on the tool people type with, and a note once
   * placed could never be opened again. ADR-085.
   *
   * Off for the pen, the marker, the eraser and the lasso. All four have to
   * pass THROUGH the plane to the canvas underneath, and a textarea that
   * swallowed the pointer would make half the surface undrawable.
   */
  setReachable(on: boolean) { this.plane.setInteractive(on); }

  bounds(): Bounds | null { return boxesBounds(this.boxes); }

  /**
   * Tap with the text tool: into the box that is there, or a new one.
   *
   * Returns whether it took the tap. The canvas does nothing when it did --
   * that is what stops a stray stroke being drawn under a box somebody is
   * trying to edit.
   */
  tapAt(x: number, y: number, style: { color: string }, visibleWidth: number): boolean {
    const hit = boxAt(this.boxes, x, y);
    if (hit) {
      this.plane.focus(hit.id);
      return true;
    }
    const box = { ...newBox(x, y, { size: this.newSize, color: style.color },
      newBoxWidth(visibleWidth, onPhone())), fill: rememberedCard(), ...this.top() };
    this.boxes.push(box);
    this.plane.render(this.boxes);
    this.plane.focus(box.id);
    // Not published yet. An empty box is not a fact about the page, and saving
    // one would put a rectangle on every other device the moment somebody
    // tapped and changed their mind.
    return true;
  }

  /**
   * A box at exactly the rectangle somebody dragged out. ADR-078.
   *
   * Unlike `tapAt` this never hits an existing box: the drag started on empty
   * ground, and a rectangle drawn across one is a new box over it rather than
   * an instruction to edit what is underneath.
   */
  drawAt(rect: Bounds, style: { color: string }): boolean {
    const box = { ...drawnBox(rect, { size: this.newSize, color: style.color }), fill: rememberedCard(), ...this.top() };
    this.boxes.push(box);
    this.plane.render(this.boxes);
    this.plane.focus(box.id);
    // Not published, for the same reason a tapped box is not: an empty box is
    // not a fact about the page.
    return true;
  }

  /** Whether a point lands on a box at all, for tools that must not draw
   *  through one. */
  hits(x: number, y: number): boolean { return boxAt(this.boxes, x, y) !== null; }

  remove(ids: readonly string[]): boolean {
    const gone = new Set(ids);
    const before = this.boxes.length;
    this.boxes = this.boxes.filter((b) => !gone.has(b.id));
    if (this.boxes.length === before) return false;
    this.plane.render(this.boxes);
    return true;
  }

  /**
   * A finished stroke that STARTED in a note belongs to it, and is drawn on
   * the note's sheet from now on. True when it joined one. ADR-134.
   */
  attach(stroke: Stroke): boolean {
    const p = stroke.pts[0];
    const box = p ? boxAt(this.boxes, p[0], p[1]) : null;
    if (!box) return false;
    stroke.in = box.id;
    this.plane.render(this.boxes);
    return true;
  }

  /** A new note goes on top of the page. ADR-136. */
  private top() { return this.host.nextZ ? { z: this.host.nextZ() } : {}; }

  /** Redraw after a drag moved boxes in place. */
  refresh() { this.plane.render(this.boxes); }

  /** Everything with words in it. Empty boxes are never sent: they are a
   *  caret waiting to be used, not content. */
  publish() {
    this.boxes = this.boxes.filter((b) => !isEmpty(b) || this.editingId() === b.id);
    this.plane.render(this.boxes);
    this.host.onChange(this.boxes.filter((b) => !isEmpty(b)));
    this.host.onGeometry();
  }

  blur() { this.plane.blur(); }

  private editingId(): string | null {
    return this.plane.isEditing
      ? (document.activeElement as HTMLElement | null)?.dataset?.id ?? null
      : null;
  }
}
