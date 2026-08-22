import type { InkDocument, Stroke } from "@jotdojo/domain";

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
 */

export type RenderOptions = {
  /** Recognition wants maximum legibility; a thumbnail wants fidelity. */
  mode: "recognition" | "preview";
  /** Longest edge in pixels. The document's own canvas size is the aspect. */
  maxEdge?: number;
};

const PRESSURE_RANGE = [0.45, 1.6] as const;

function widthAt(stroke: Stroke, pressure: number): number {
  if (stroke.tool === "highlighter") return stroke.width;
  const [lo, hi] = PRESSURE_RANGE;
  return stroke.width * (lo + (hi - lo) * Math.min(1, Math.max(0, pressure)));
}

const n = (v: number) => Math.round(v * 100) / 100;

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
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    out.push(
      `<path d="M${n(p1[0])} ${n(p1[1])}C${n(c1x)} ${n(c1y)} ${n(c2x)} ${n(c2y)} ${n(p2[0])} ${n(p2[1])}"`
      + ` fill="none" stroke="${ink}" stroke-width="${n(widthAt(stroke, (p1[3] + p2[3]) / 2))}"`
      + ` stroke-linecap="round" stroke-linejoin="round" opacity="${alpha}"/>`,
    );
  }
  return out;
}

const escapeAttr = (v: string) => v.replace(/[<>&"']/g, (c) =>
  ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c]!));

export function toSvg(doc: InkDocument, options: RenderOptions): string {
  const { w, h } = doc.canvas;
  const maxEdge = options.maxEdge ?? (options.mode === "recognition" ? 2000 : 480);
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  const outW = Math.max(1, Math.round(w * scale));
  const outH = Math.max(1, Math.round(h * scale));

  const recognition = options.mode === "recognition";
  const body = doc.strokes.flatMap((stroke) => {
    // Colour is thrown away for recognition on purpose. The highlighter keeps
    // some transparency either way so struck-through text stays readable
    // underneath it rather than becoming a solid bar the model has to guess at.
    const ink = recognition ? "#000000" : escapeAttr(stroke.color);
    const alpha = stroke.tool === "highlighter" ? (recognition ? 0.25 : 0.35) : 1;
    return segments(stroke, ink, alpha);
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}"`,
    ` viewBox="0 0 ${n(w)} ${n(h)}">`,
    `<rect width="100%" height="100%" fill="${recognition ? "#FFFFFF" : "none"}"/>`,
    ...body,
    "</svg>",
  ].join("");
}

/**
 * Split a tall page into overlapping horizontal bands.
 *
 * A model reading a full page at once tends to skim the middle. Bands keep it
 * focused, and the overlap means a line of handwriting that falls on a seam is
 * whole in at least one of them -- without it, every band boundary would cut a
 * word in half and both halves would be misread. docs/08.
 */
export function bands(doc: InkDocument, bandHeight = 700, overlap = 80): InkDocument[] {
  const { w, h } = doc.canvas;
  if (h <= bandHeight) return [doc];

  const out: InkDocument[] = [];
  for (let top = 0; top < h; top += bandHeight - overlap) {
    const bottom = Math.min(h, top + bandHeight);
    // A stroke belongs to a band if any part of it is inside. Strokes are not
    // clipped -- a letter with a descender crossing the line should be drawn
    // whole, even if that means it appears in two bands.
    const strokes = doc.strokes.filter((s) =>
      s.pts.some((p) => p[1] >= top && p[1] <= bottom));
    if (strokes.length === 0) continue;
    out.push({
      v: 1,
      canvas: { w, h: bottom - top },
      strokes: strokes.map((s) => ({
        ...s,
        pts: s.pts.map((p) => [p[0], p[1] - top, p[2], p[3], p[4], p[5]] as typeof p),
      })),
    });
    if (bottom >= h) break;
  }
  return out.length > 0 ? out : [doc];
}
