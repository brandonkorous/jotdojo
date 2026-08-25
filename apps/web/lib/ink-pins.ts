import type { Bounds } from "./ink-geometry";
import type { ViewSnapshot } from "./ink-viewport";

/**
 * A mark beside the thing somebody said something about. ADR-107.
 *
 * A page holds five unrelated notes as often as it holds one thought, so a
 * count in the corner of the screen answers a question nobody asked. The pin
 * puts the count where the argument is.
 *
 * NOT on the transformed object plane, and that is the whole design. A pin is
 * chrome about the page rather than part of it: zooming out to see a whole
 * whiteboard must not shrink the one control that says where the conversation
 * is. So each pin is placed in screen coordinates every frame and never
 * scaled.
 */
export type Pin = {
  /** The object it hangs off -- a text box, a photograph, or a stroke. */
  anchorId: string;
  count: number;
  /** How many of those are still outstanding. Zero means dealt with, which is
   *  a quieter pin rather than no pin. */
  open: number;
};

export type PinHost = {
  /** Where that object is on the page, or null once it has been erased. */
  locate: (anchorId: string) => Bounds | null;
  /** The camera. Read here as well as handed in by the paint loop, so a pin
   *  that has just appeared is placed before the next frame rather than
   *  spending one at the corner of the canvas. */
  view: () => ViewSnapshot;
};

/** How far off the edge a pin may sit before it stops being drawn. */
const MARGIN = 64;

export class InkPins {
  private readonly nodes = new Map<string, HTMLButtonElement>();
  private pins: readonly Pin[] = [];
  private onOpen: ((anchorId: string) => void) | null = null;

  constructor(private readonly el: HTMLElement, private readonly host: PinHost) {}

  destroy() {
    for (const node of this.nodes.values()) node.remove();
    this.nodes.clear();
  }

  /**
   * What there is to mark, and what to do when one is pressed.
   *
   * The handler arrives WITH the data rather than at construction, because the
   * engine is built once by an async mount and the drawer it opens is React
   * state that changes per render. One push, both facts, no plumbing through
   * three components to keep them in step.
   */
  set(pins: readonly Pin[], onOpen: (anchorId: string) => void) {
    this.pins = pins;
    this.onOpen = onOpen;

    const seen = new Set(pins.map((p) => p.anchorId));
    for (const [id, node] of this.nodes) {
      if (seen.has(id)) continue;
      node.remove();
      this.nodes.delete(id);
    }
    for (const pin of pins) this.dress(this.node(pin.anchorId), pin);
    this.frame(this.host.view());
  }

  /**
   * Put every pin where its object now is.
   *
   * Called from the paint loop on EVERY frame that changed anything, not only
   * on a camera move: dragging a note has to carry its pin along, and a pin
   * that arrived a frame late would read as one that had come loose.
   */
  frame(view: ViewSnapshot) {
    if (this.pins.length === 0) return;
    const w = this.el.clientWidth;
    const h = this.el.clientHeight;

    for (const pin of this.pins) {
      const node = this.nodes.get(pin.anchorId);
      if (!node) continue;
      const at = this.host.locate(pin.anchorId);
      // Erased, or somewhere else entirely. The comment survives it -- the
      // drawer still lists the thread -- so this is a hidden pin, not a
      // removed one.
      if (!at) { node.hidden = true; continue; }

      // The TOP-LEFT corner, not the top-right. A text box is as wide as it
      // was drawn rather than as wide as its words, so a pin on the right edge
      // floats in empty paper a long way from the sentence it is about. The
      // left corner is where the words start, which is where a margin note
      // goes on real paper.
      const x = view.x + at.x * view.k;
      const y = view.y + at.y * view.k;
      node.hidden = x < -MARGIN || y < -MARGIN || x > w + MARGIN || y > h + MARGIN;
      // `translate`, NEVER `transform`. The two compose in spec order --
      // translate, then scale, then transform -- so a `scale` from :hover
      // written into `transform` would MULTIPLY this offset and throw the pin
      // 12% of the way across the page, out from under the pointer that was
      // hovering it. docs/10 states the rule; this is its mirror image.
      node.style.translate = `${Math.round(x)}px ${Math.round(y)}px`;
    }
  }

  private node(anchorId: string): HTMLButtonElement {
    const held = this.nodes.get(anchorId);
    if (held) return held;

    const node = document.createElement("button");
    node.type = "button";
    node.className = "jd-pin";
    // Hidden until the first frame places it. Without this a pin appears at
    // the top-left corner of the canvas for one frame on load, which reads as
    // a flicker rather than as a mark.
    node.hidden = true;
    node.addEventListener("pointerdown", (e) => e.stopPropagation());
    node.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onOpen?.(anchorId);
    });
    this.el.append(node);
    this.nodes.set(anchorId, node);
    return node;
  }

  /** The count, and whether anything is still outstanding. Both are written as
   *  words too: colour is never the only signal. docs/10. */
  private dress(node: HTMLButtonElement, pin: Pin) {
    node.textContent = String(pin.count);
    node.dataset.open = String(pin.open > 0);
    node.setAttribute("aria-label", label(pin));
  }
}

function label(pin: Pin): string {
  const said = pin.count === 1 ? "1 comment" : `${pin.count} comments`;
  return pin.open > 0 ? `${said}, ${pin.open} outstanding` : `${said}, all dealt with`;
}
