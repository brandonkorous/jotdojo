import type { TextBox } from "@jotacular/domain";
import { CARD_PAD, inkOn } from "@jotacular/ink-render";
import { isEmpty } from "./ink-objects";

/**
 * The object plane: typed text, on the same surface as the ink. ADR-065.
 *
 * A CSS-transformed layer OUTSIDE the canvases, and the "outside" is not a
 * detail. Scaling a `<canvas>` through a transformed ancestor scales its bitmap
 * and blurs the ink, so the canvases keep their own internal
 * `setTransform(dpr*k, ...)` and stay flat. Both read the same InkViewport, so
 * they move together.
 *
 * The boxes are real `<textarea>`s. markdown-marks.ts names the reasons and
 * they all still apply: Apple Scribble only works in real text fields, and IME,
 * paste, native undo and spellcheck are not things to reimplement on a canvas.
 * docs/10 also requires that everything drawable is typeable.
 */

/**
 * iOS Safari zooms the page when a field with a computed font-size under 16px
 * takes focus, and it tests the COMPUTED size -- before any ancestor transform.
 * So a box is never smaller than this, and the camera does the shrinking.
 */
export const MIN_SIZE = 16;

export type PlaneHost = {
  /** A box's text changed and should be saved. Debounced by the caller. */
  onEdit: (box: TextBox) => void;
  /** Editing finished. An empty box is removed rather than saved. */
  onDone: (box: TextBox) => void;
  onRemove: (id: string) => void;
};

export class InkPlane {
  private readonly el: HTMLElement;
  private readonly host: PlaneHost;
  private readonly nodes = new Map<string, HTMLTextAreaElement>();
  private boxes: TextBox[] = [];
  /** Which box has the caret. Nothing else may repaint it out from under them. */
  private editing: string | null = null;
  /** What the TOOL asked for. Separate from whether a box has the caret,
   *  because placing a box hands the tool straight back to the spine and the
   *  caret must survive that. ADR-065. */
  private wanted = false;

  constructor(el: HTMLElement, host: PlaneHost) {
    this.el = el;
    this.host = host;
  }

  destroy() {
    for (const node of this.nodes.values()) node.remove();
    this.nodes.clear();
  }

  /** Where the camera is. Written every frame beside the grid, so the text
   *  moves WITH the ink rather than a frame behind it. */
  frame(x: number, y: number, k: number) {
    this.el.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
  }

  /**
   * Whether boxes accept pointer events.
   *
   * Off for every tool but text. A lasso has to pass THROUGH the plane to reach
   * the canvas underneath, and a textarea that swallowed the pointer would make
   * half the surface unselectable without showing why.
   */
  setInteractive(on: boolean) {
    this.wanted = on;
    this.apply();
  }

  /** A box takes the pointer when the tool asks for it OR while it is being
   *  typed into. Blurring one mid-word because the tool changed underneath is
   *  the bug this exists to prevent. */
  private apply() {
    const on = this.wanted || this.editing !== null;
    for (const node of this.nodes.values()) node.style.pointerEvents = on ? "auto" : "none";
  }

  render(boxes: readonly TextBox[]) {
    this.boxes = [...boxes];
    const seen = new Set<string>();

    for (const box of boxes) {
      seen.add(box.id);
      const node = this.nodes.get(box.id) ?? this.create(box);
      this.place(node, box);
      // NEVER overwrite the field somebody is typing into. React's controlled
      // -input problem, arriving through a different door: a remote update
      // landing mid-word would move the caret to the end of it.
      if (this.editing !== box.id && node.value !== box.text) node.value = box.text;
    }

    for (const [id, node] of this.nodes) {
      if (seen.has(id)) continue;
      node.remove();
      this.nodes.delete(id);
      if (this.editing === id) this.editing = null;
    }
  }

  /** Put the caret in a box, making the plane interactive for as long as it
   *  takes. Used by the text tool and by tapping an existing box. */
  focus(id: string) {
    const node = this.nodes.get(id);
    if (!node) return;
    this.editing = id;
    this.apply();
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
  }

  blur() {
    if (!this.editing) return;
    this.nodes.get(this.editing)?.blur();
  }

  get isEditing() { return this.editing !== null; }

  private box(id: string): TextBox | undefined {
    return this.boxes.find((b) => b.id === id);
  }

  private create(box: TextBox): HTMLTextAreaElement {
    const node = document.createElement("textarea");
    node.className = "jd-text-box";
    node.dataset.id = box.id;
    node.rows = 1;
    node.spellcheck = true;
    node.style.pointerEvents = this.wanted || this.editing !== null ? "auto" : "none";
    node.setAttribute("aria-label", "Text on the canvas");

    node.addEventListener("input", () => {
      const current = this.box(box.id);
      if (!current) return;
      current.text = node.value;
      this.grow(node, current);
      this.host.onEdit(current);
    });
    node.addEventListener("focus", () => { this.editing = box.id; this.apply(); });
    node.addEventListener("blur", () => {
      if (this.editing === box.id) { this.editing = null; this.apply(); }
      const current = this.box(box.id);
      if (!current) return;
      // A person who tapped, thought better of it and tapped elsewhere should
      // not leave a trail of empty rectangles behind them.
      if (isEmpty(current)) this.host.onRemove(current.id);
      else this.host.onDone(current);
    });
    // Escape leaves the box without deleting what is in it. Delete and
    // Backspace are handled on the window for selections and must not be
    // stolen from a field somebody is typing into.
    node.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.stopPropagation(); node.blur(); }
    });

    this.el.append(node);
    this.nodes.set(box.id, node);
    return node;
  }

  private place(node: HTMLTextAreaElement, box: TextBox) {
    const size = Math.max(MIN_SIZE, box.size);
    node.style.width = `${box.w}px`;
    node.style.fontSize = `${size}px`;
    // `dress` owns left and top: a card's padding shifts the element back by
    // what it gains, so the two cannot be set independently.
    this.dress(node, box, size);
    this.grow(node, box);
  }

  /**
   * A card, or words straight onto the page. ADR-079.
   *
   * The padding inflates OUTWARD -- the element is offset back by exactly what
   * it gains -- so colouring a note never moves a word. `cardBounds` computes
   * the same rectangle for the lasso and the export.
   *
   * The ink is derived from the fill rather than stored, which is what makes it
   * impossible to end up with a card whose text cannot be read on it.
   */
  private dress(node: HTMLTextAreaElement, box: TextBox, size: number) {
    const pad = box.fill ? size * CARD_PAD : 0;
    node.classList.toggle("jd-card", Boolean(box.fill));
    node.style.background = box.fill ?? "transparent";
    node.style.color = box.fill ? inkOn(box.fill) : box.color;
    node.style.caretColor = box.fill ? inkOn(box.fill) : "";
    node.style.padding = `${pad}px`;
    node.style.borderRadius = box.fill ? `${size * 0.5}px` : "";
    node.style.left = `${box.x - pad}px`;
    node.style.top = `${box.y - pad}px`;
  }

  /**
   * A textarea does not size to its content, so it is told to. ADR-078.
   *
   * `h` is the height somebody DREW, and it is a floor rather than a ceiling:
   * a card keeps the size it was dragged out to when its text is one short
   * line, and grows when the text outgrows it. Clipping is not an option on a
   * surface whose whole job is not losing what you typed.
   *
   * `h` is never written back from here. It records an intention, not a
   * measurement -- store the measured height and a deleted paragraph could
   * never shrink the box again, because the floor would have swallowed it.
   */
  private grow(node: HTMLTextAreaElement, box: TextBox) {
    // Reset first, or it only ever grows and a deleted paragraph leaves the
    // gap behind.
    node.style.height = "auto";
    node.style.height = `${Math.max(box.h ?? 0, node.scrollHeight)}px`;
  }
}
