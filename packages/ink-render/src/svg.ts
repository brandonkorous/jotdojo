import type { InkDocument } from "@jotacular/domain";
import { bounds, contentBounds, medianWidth, type Bounds } from "./geometry";
import { arrows, escapeAttr, n, segments, stickers, textLines } from "./svg-parts";

/**
 * Strokes to SVG, for recognition and for thumbnails.
 *
 * SVG rather than a canvas, because this runs in the worker where there is no
 * DOM, and rasterising an SVG with sharp needs no native canvas binding. The
 * curve fitting is the same Catmull-Rom conversion the browser engine uses, so
 * what the model reads is what the person saw.
 *
 * For recognition the ink is redrawn **black on white regardless of the pen
 * colour** (docs/08). A model reading pale grey handwriting on cream paper is
 * being asked to do two jobs, and it does the second one worse.
 *
 * NOTHING HERE READS `doc.canvas`. The frame comes from the ink. ADR-053.
 *
 * What each OBJECT looks like is svg-parts.ts. This file is the frame round
 * them: the viewBox, the scale, the paper, and the order they stack in.
 */

export type RenderOptions = {
  /**
   * What the image is FOR, which decides three things at once.
   *
   *   recognition  black on white paper, enlarged to a legibility floor
   *   preview      real colours, transparent, small, never enlarged
   *   viewing      real colours on white paper, big enough for a person
   */
  mode: "recognition" | "preview" | "viewing";
  /** Longest edge of ONE image, in pixels. Tiling is what keeps a wall of
   *  writing under it without shrinking it to mush. */
  maxEdge?: number;
  /** The rect to frame. A tile passes its own; otherwise the content box. */
  bounds?: Bounds;
  /** Quiet margin in OUTPUT pixels, so the gutter looks the same at any scale. */
  padPx?: number;
  /** How far recognition may enlarge small ink. */
  maxUpscale?: number;
  /**
   * Draw the page's typed text boxes as well. DEFAULT FALSE, and the default is
   * the point. ADR-065.
   *
   * If typed text reaches the SVG the recogniser reads, the model reads it back
   * as handwriting -- and `renderBlock` then presents a confidence-scored guess
   * where a certainty already existed. Recognition never sets this. Export and
   * `view_note` always do, because a person looking at the page expects to see
   * what is on it.
   */
  text?: boolean;
};

/** Below this a stroke stops being reliably resolvable by a vision model. */
const TARGET_INK_PX = 2.5;
const MAX_UPSCALE = 4;

/** Longest edge when the caller does not say. A thumbnail is a thumbnail; an
 *  export is looked at by a person and a page of writing has to survive it. */
const DEFAULT_EDGE = { recognition: 2000, preview: 480, viewing: 1600 } as const;


/**
 * How much to magnify, and the one place recognition is allowed to ENLARGE.
 *
 * Not scale-to-fill: blowing a two-word sticky note up to 2000px would cost a
 * full page of tokens to read nine letters. Scale to a legibility floor and
 * stop, then let `maxEdge` cap the result.
 */
export function scaleFor(doc: InkDocument, box: Bounds, o: RenderOptions): number {
  const cap = (o.maxEdge ?? DEFAULT_EDGE[o.mode]) / Math.max(box.w, box.h, 1);
  const ceiling = o.maxUpscale ?? MAX_UPSCALE;

  // A thumbnail is shown at thumbnail size whatever we do, so enlarging costs
  // bytes and buys nothing.
  if (o.mode === "preview") return Math.min(1, cap);
  // An export fills its frame. A person asked for this image and will look at
  // it, so the token argument above does not apply.
  if (o.mode === "viewing") return Math.min(cap, ceiling);

  const typical = medianWidth(doc.strokes);
  const legible = typical > 0 ? TARGET_INK_PX / typical : 1;
  return Math.min(cap, Math.max(1, Math.min(ceiling, legible)));
}

/** A page with no ink on it. Valid, tiny, and never worth sending to a model. */
const EMPTY = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"></svg>';


export function toSvg(doc: InkDocument, options: RenderOptions): string {
  const recognition = options.mode === "recognition";
  // Paper, rather than nothing. A thumbnail sits on a card that supplies its
  // own background; a downloaded PNG is opened against whatever the viewer
  // happens to be, and dark grey ink on a transparent ground disappears.
  const paper = options.mode !== "preview";
  // The frame follows what is being DRAWN. With text on, a note that is
  // nothing but a typed box has to have a frame; with text off, the frame must
  // not stretch over ground with no handwriting on it. ADR-065.
  const box = options.bounds ?? (options.text ? contentBounds(doc) : bounds(doc));
  if (!box) return EMPTY;

  const scale = scaleFor(doc, box, options);
  const padU = (options.padPx ?? (options.mode === "preview" ? 8 : 24)) / scale;
  const vx = box.x - padU;
  const vy = box.y - padU;
  const vw = box.w + padU * 2;
  const vh = box.h + padU * 2;

  // Text UNDER the ink, so a highlighter drawn over a typed line reads the way
  // it does on the canvas rather than being painted out by it.
  const typed = options.text
    ? (doc.texts ?? []).flatMap((box) => textLines(box, escapeAttr))
    : [];
  // Arrows follow `text` for the reason typed boxes do: recognition must never
  // see them. A vision model handed an arrow reads it as a pen stroke, and the
  // sentence it is worth is already in the block's body. ADR-108.
  const drawn = options.text ? arrows(doc, escapeAttr) : [];
  // Stickers follow `text` for the same reason again, and it matters more here:
  // a vision model handed a fire icon transcribes it as a squiggle, so a mark
  // somebody put ON the writing would come back as part of the writing. ADR-115.
  const stuck = options.text ? stickers(doc, escapeAttr) : [];

  const body = doc.strokes.flatMap((stroke) => {
    // Colour is thrown away for recognition on purpose. The highlighter keeps
    // some transparency either way so struck-through text stays readable
    // underneath it rather than becoming a solid bar the model has to guess at.
    const ink = recognition ? "#000000" : escapeAttr(stroke.color);
    const alpha = stroke.tool === "highlighter" ? (recognition ? 0.25 : 0.35) : 1;
    return segments(stroke, ink, alpha);
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    ` width="${Math.max(1, Math.round(vw * scale))}"`,
    ` height="${Math.max(1, Math.round(vh * scale))}"`,
    ` viewBox="${n(vx)} ${n(vy)} ${n(vw)} ${n(vh)}">`,
    // EXPLICIT x/y, not width="100%". Percentages resolve against the viewport
    // with x/y defaulting to 0, so with a negative viewBox origin the white
    // lands off-screen and the PNG rasterises transparent. ADR-053.
    `<rect x="${n(vx)}" y="${n(vy)}" width="${n(vw)}" height="${n(vh)}"`,
    ` fill="${paper ? "#FFFFFF" : "none"}"/>`,
    // Ink first, then typed text over it -- the order the editor shows, where
    // the object plane sits above both canvases. These were reversed, which
    // nothing could see while text was transparent and everything would see the
    // moment a box had a fill. ADR-078.
    //
    // Arrows first of all, matching the canvas: they are on the committed
    // layer, under the ink and under the object plane. ADR-108.
    ...drawn,
    ...body,
    ...typed,
    // Stickers last, so they are on TOP of everything. A sticker is stuck onto
    // the page rather than drawn into it, and one that a stroke could cover
    // would stop being a mark about the thing underneath it. ADR-115.
    ...stuck,
    "</svg>",
  ].join("");
}
