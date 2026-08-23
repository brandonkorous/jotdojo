import type { InkDocument, Stroke, TextBox } from "@jotacular/domain";
import { bounds, contentBounds, control, medianWidth, widthAt, type Bounds } from "./geometry";
import { cardBounds, inkOn } from "./text-geometry";

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

const n = (v: number) => Math.round(v * 100) / 100;

const escapeAttr = (v: string) => v.replace(/[<>&"']/g, (c) =>
  ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&#39;", '"': "&quot;" }[c]!));

/**
 * One stroke becomes one path per segment, because width follows pressure and
 * a single path can only have one stroke-width. Verbose, and the alternative
 * is a dead uniform line.
 */
function segments(stroke: Stroke, ink: string, alpha: number): string[] {
  const pts = stroke.pts;
  if (pts.length === 0) return [];

  if (pts.length === 1) {
    const p = pts[0]!;
    return [`<circle cx="${n(p[0])}" cy="${n(p[1])}" r="${n(widthAt(stroke, p[3]) / 2)}" fill="${ink}" opacity="${alpha}"/>`];
  }

  const out: string[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const c = control(pts, i);
    out.push(
      `<path d="M${n(p1[0])} ${n(p1[1])}C${n(c.c1x)} ${n(c.c1y)} ${n(c.c2x)} ${n(c.c2y)} ${n(p2[0])} ${n(p2[1])}"`
      + ` fill="none" stroke="${ink}" stroke-width="${n(widthAt(stroke, (p1[3] + p2[3]) / 2))}"`
      + ` stroke-linecap="round" stroke-linejoin="round" opacity="${alpha}"/>`,
    );
  }
  return out;
}

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

/**
 * A text box, as SVG.
 *
 * Wrapped by hand, because SVG has no flow layout and the browser is not here.
 * The estimate is deliberately crude -- this is a picture of a page, not a
 * typesetter, and a line that breaks a word early costs nothing next to text
 * that runs off the edge of the image.
 */
function textLines(box: TextBox, escape: (v: string) => string): string[] {
  const perLine = Math.max(1, Math.floor(box.w / (box.size * 0.55)));
  const out: string[] = [];
  const ink = box.fill ? inkOn(box.fill) : box.color;
  for (const paragraph of box.text.split("\n")) {
    if (!paragraph.trim()) { out.push(""); continue; }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (line && (line.length + word.length + 1) > perLine) { out.push(line); line = word; }
      else line = line ? `${line} ${word}` : word;
    }
    out.push(line);
  }
  // A leading dominant-baseline would fight the per-line dy below, so the first
  // line sits one size down from the box's top edge, where a person put it.
  const lines = out.map((line, i) =>
    `<text x="${n(box.x)}" y="${n(box.y + box.size * (i + 1))}"`
    + ` font-family="ui-sans-serif, system-ui, sans-serif" font-size="${n(box.size)}"`
    + ` fill="${escape(ink)}" xml:space="preserve">${escape(line)}</text>`);

  return box.fill ? [cardRect(box, escape), ...lines] : lines;
}

/**
 * The card behind the words. ADR-079.
 *
 * Flat -- no gradient, no glow, per design.md §12. The lift ADR-077 restored
 * lives in CSS on the editor's own cards and deliberately does not come here:
 * an SVG drop-shadow is a filter, filters rasterise unpredictably across
 * renderers, and a note exported as a picture wants to read as paper rather
 * than as a screenshot of an interface.
 */
function cardRect(box: TextBox, escape: (v: string) => string): string {
  const b = cardBounds(box);
  const r = box.size * 0.5;
  return `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}"`
    + ` rx="${n(r)}" ry="${n(r)}" fill="${escape(box.fill!)}"/>`;
}

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
    ...body,
    ...typed,
    "</svg>",
  ].join("");
}
