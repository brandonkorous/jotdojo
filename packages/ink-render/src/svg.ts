import type { InkDocument, Stroke } from "@jotdojo/domain";
import { bounds, control, medianWidth, widthAt, type Bounds } from "./geometry";

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
  /** Recognition wants maximum legibility; a thumbnail wants fidelity. */
  mode: "recognition" | "preview";
  /** Longest edge of ONE image, in pixels. Tiling is what keeps a wall of
   *  writing under it without shrinking it to mush. */
  maxEdge?: number;
  /** The rect to frame. A tile passes its own; otherwise the content box. */
  bounds?: Bounds;
  /** Quiet margin in OUTPUT pixels, so the gutter looks the same at any scale. */
  padPx?: number;
  /** How far recognition may enlarge small ink. */
  maxUpscale?: number;
};

/** Below this a stroke stops being reliably resolvable by a vision model. */
const TARGET_INK_PX = 2.5;
const MAX_UPSCALE = 4;

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
  const recognition = o.mode === "recognition";
  const maxEdge = o.maxEdge ?? (recognition ? 2000 : 480);
  const cap = maxEdge / Math.max(box.w, box.h, 1);
  if (!recognition) return Math.min(1, cap);

  const typical = medianWidth(doc.strokes);
  const legible = typical > 0 ? TARGET_INK_PX / typical : 1;
  return Math.min(cap, Math.max(1, Math.min(o.maxUpscale ?? MAX_UPSCALE, legible)));
}

/** A page with no ink on it. Valid, tiny, and never worth sending to a model. */
const EMPTY = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"></svg>';

export function toSvg(doc: InkDocument, options: RenderOptions): string {
  const recognition = options.mode === "recognition";
  const box = options.bounds ?? bounds(doc);
  if (!box) return EMPTY;

  const scale = scaleFor(doc, box, options);
  const padU = (options.padPx ?? (recognition ? 24 : 8)) / scale;
  const vx = box.x - padU;
  const vy = box.y - padU;
  const vw = box.w + padU * 2;
  const vh = box.h + padU * 2;

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
    ` fill="${recognition ? "#FFFFFF" : "none"}"/>`,
    ...body,
    "</svg>",
  ].join("");
}
