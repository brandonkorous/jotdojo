import type { ImageOnPage, Sticker, Stroke, TextBox } from "@jotacular/domain";
import { strokeBounds, type Bounds } from "./ink-geometry";
import { boxesBounds, translateBoxes } from "./ink-objects";
import {
  imagesBounds, stickersBounds, translateImages, translateStickers, unionOf,
} from "./ink-rects";
import { classify, type ShapeKind } from "./ink-shapes";

/**
 * WHAT a selection holds, of every kind. ADR-115.
 *
 * Split from ink-selection.ts when stickers became the fourth kind, and the
 * seam is a real one: that file is a state machine -- a loop being drawn, a
 * marquee settling, a drag running -- while this is only the contents and what
 * can be said about them. The state machine did not grow when the fourth array
 * arrived; the accounting did, in eight places at once.
 *
 * The arrays hold REFERENCES into the engine's own page, which is what lets a
 * drag mutate positions in place and repaint without rebuilding anything.
 */
export type SelectionSummary = {
  count: number;
  pen: boolean;
  marker: boolean;
  /** Where a resize control should start from -- the width of the first pen
   *  stroke caught, so the slider opens on the selection rather than on a
   *  default that would jump it the moment it is touched. */
  penWidth: number | null;
  /** Which objects, by name. Export sends these to the server rather than the
   *  strokes themselves, so what comes back is the saved page. ADR-058. */
  ids: string[];
  /** How many are typed text boxes. The bar says "objects" rather than
   *  "strokes" when a selection holds both, and hides the pen palettes when it
   *  holds only text. ADR-065. */
  texts: number;
  /** How many are photographs. The bar and the menu offer a photo nothing a
   *  pen palette could act on. ADR-103. */
  images: number;
  /** How many are stickers. Recolouring one is meaningful and resizing it is,
   *  but nothing else a pen palette offers is. ADR-115. */
  stickers: number;
  /**
   * What one selected stroke could be tidied into, when the classifier is sure.
   *
   * Null for everything else, and null is the common answer: the same
   * confidence floor hold-to-snap uses, so the menu only offers to make a
   * circle out of something that already looks like one. ADR-066, ADR-084.
   */
  shape: ShapeKind | null;
};

export const NO_SELECTION: SelectionSummary = {
  count: 0, pen: false, marker: false, penWidth: null, ids: [],
  texts: 0, images: 0, stickers: 0, shape: null,
};

export class Held {
  strokes: Stroke[] = [];
  boxes: TextBox[] = [];
  pics: ImageOnPage[] = [];
  marks: Sticker[] = [];

  get count() {
    return this.strokes.length + this.boxes.length + this.pics.length + this.marks.length;
  }

  set(
    strokes: readonly Stroke[], boxes: readonly TextBox[],
    pics: readonly ImageOnPage[], marks: readonly Sticker[],
  ) {
    this.strokes = [...strokes];
    this.boxes = [...boxes];
    this.pics = [...pics];
    this.marks = [...marks];
  }

  clear() { this.set([], [], [], []); }

  /** The marquee round whatever is held, of however many kinds. */
  bounds(): Bounds | null {
    return unionOf([
      strokeBounds(this.strokes), boxesBounds(this.boxes),
      imagesBounds(this.pics), stickersBounds(this.marks),
    ].filter((b): b is Bounds => b !== null));
  }

  /** Move everything held, in place. Strokes move point by point; the other
   *  three are a corner each. */
  translate(dx: number, dy: number) {
    for (const stroke of this.strokes) {
      for (const p of stroke.pts) { p[0] += dx; p[1] += dy; }
    }
    translateBoxes(this.boxes, dx, dy);
    translateImages(this.pics, dx, dy);
    translateStickers(this.marks, dx, dy);
  }

  /**
   * What was caught, not just how much.
   *
   * The kinds matter to the UI: a highlighter recoloured to ink is the grey
   * smear ADR-045 exists to prevent, so the marker palette has to be offered
   * whenever the lasso holds one.
   */
  summary(): SelectionSummary {
    const pen = this.strokes.find((s) => s.tool === "pen");
    return {
      count: this.count,
      pen: pen !== undefined,
      marker: this.strokes.some((s) => s.tool === "highlighter"),
      penWidth: pen?.width ?? null,
      ids: [
        ...this.strokes.map((s) => s.id),
        ...this.boxes.map((b) => b.id),
        ...this.pics.map((i) => i.id),
        ...this.marks.map((m) => m.id),
      ],
      texts: this.boxes.length,
      images: this.pics.length,
      stickers: this.marks.length,
      // Only ever asked of ONE stroke and nothing else: "tidy these six
      // squiggles" is not a thing anybody means, and classifying a whole
      // selection to find out would cost a pass over every point.
      shape: this.onlyStroke ? classify(this.strokes[0]!.pts)?.kind ?? null : null,
    };
  }

  private get onlyStroke() {
    return this.strokes.length === 1 && this.boxes.length === 0
      && this.pics.length === 0 && this.marks.length === 0;
  }
}
