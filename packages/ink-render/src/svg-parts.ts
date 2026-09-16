import type { InkDocument, Link, Stroke, TextBox } from "@jotacular/domain";
import { control, widthAt } from "./geometry";
import { cardBounds, inkOn } from "./text-geometry";
import { segmentFor, type Segment } from "./links";

/**
 * What one THING on the page looks like: a stroke, a typed box, the card
 * behind it, an arrow between two of them. ADR-078, ADR-079, ADR-108.
 *
 * Split from svg.ts when arrows took that file past its size limit. The seam
 * is a real one: everything here draws a single object and knows nothing about
 * the page, while svg.ts decides the frame, the scale, the paper and the order
 * -- and never draws anything itself.
 */

/** Two decimal places. An SVG of a page of handwriting is mostly digits, and
 *  the third one is below a pixel at every scale this renders at. */
export const n = (v: number) => Math.round(v * 100) / 100;

export const escapeAttr = (v: string) => v.replace(/[<>&"']/g, (c) =>
  ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&#39;", '"': "&quot;" }[c]!));
/**
 * One stroke becomes one path per segment, because width follows pressure and
 * a single path can only have one stroke-width. Verbose, and the alternative
 * is a dead uniform line.
 */
export function segments(stroke: Stroke, ink: string, alpha: number): string[] {
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
 * A text box, as SVG.
 *
 * Wrapped by hand, because SVG has no flow layout and the browser is not here.
 * The estimate is deliberately crude -- this is a picture of a page, not a
 * typesetter, and a line that breaks a word early costs nothing next to text
 * that runs off the edge of the image.
 */
export function textLines(box: TextBox, escape: (v: string) => string): string[] {
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

/**
 * One arrow, as SVG. ADR-108.
 *
 * Drawn UNDER the strokes and under the typed boxes, matching the canvas --
 * where arrows go on the committed layer and the object plane sits above it.
 * A marker is used rather than a hand-built triangle: it rotates with the line
 * for free and rasterises identically in sharp and in a browser.
 */
function arrow(link: Link, seg: Segment, escape: (v: string) => string): string {
  const ink = escape(link.color);
  const head = `url(#h-${escape(link.id)})`;
  return `<path d="M${n(seg.x1)} ${n(seg.y1)}L${n(seg.x2)} ${n(seg.y2)}"`
    + ` fill="none" stroke="${ink}" stroke-width="${n(link.width)}" stroke-linecap="round"`
    + (link.head === "none" ? "" : ` marker-end="${head}"`)
    + (link.head === "both" ? ` marker-start="${head}"` : "")
    + "/>";
}

/** The arrowhead itself, defined once per arrow so it can take the line's
 *  colour. `orient` is what makes it turn with the line. */
function arrowHead(link: Link, escape: (v: string) => string): string {
  return `<marker id="h-${escape(link.id)}" viewBox="0 0 10 10" refX="9" refY="5"`
    + ` markerWidth="5" markerHeight="5" orient="auto-start-reverse">`
    + `<path d="M0 0L10 5L0 10z" fill="${escape(link.color)}"/></marker>`;
}

/** Every arrow that can be drawn, with the line to draw it on. An arrow whose
 *  ends have collapsed is left out rather than drawn as a blot. */
export function arrows(doc: InkDocument, escape: (v: string) => string): string[] {
  const out: string[] = [];
  for (const link of doc.links ?? []) {
    const seg = segmentFor(link, doc);
    if (!seg) continue;
    out.push(arrowHead(link, escape), arrow(link, seg, escape));
  }
  return out;
}
