import type { TextBox } from "@jotdojo/domain";
import type { ViewSnapshot } from "./ink-viewport";
import type { Bounds } from "./ink-geometry";
import { boxAt, boxesBounds, drawnBox, isEmpty, newBox } from "./ink-objects";
import { InkPlane, MIN_SIZE } from "./ink-plane";
import type { InkTool } from "./canvas-tool";

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

/** A new box is about a third of the visible width, which is a paragraph on a
 *  phone and a column on a laptop. Somebody can drag it after. */
const NEW_WIDTH_FRACTION = 0.33;

export type TextLayerHost = {
  /** A box changed and the page should hear about it. */
  onChange: (boxes: readonly TextBox[]) => void;
  /** Something moved that the camera should be able to frame. */
  onGeometry: () => void;
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
    });
  }

  destroy() { this.plane.destroy(); }

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
    this.plane.render(this.boxes);
  }

  frame(view: ViewSnapshot) { this.plane.frame(view.x, view.y, view.k); }

  /** Only the text tool lets a box take the pointer. Everything else has to
   *  pass through to the canvas underneath. */
  setTool(tool: InkTool | "text") {
    this.plane.setInteractive(tool === "textbox");
  }

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
    const box = newBox(x, y, { size: MIN_SIZE, color: style.color },
      Math.max(120, visibleWidth * NEW_WIDTH_FRACTION));
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
    const box = drawnBox(rect, { size: MIN_SIZE, color: style.color });
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
