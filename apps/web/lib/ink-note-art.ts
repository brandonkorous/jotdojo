import type { Stroke, TextBox } from "@jotacular/domain";
import { extent, fillOf, segments, turnAttr, type Bounds } from "@jotacular/ink-render";
import { HIGHLIGHTER_ALPHA } from "./ink-paint";

const SVG = "http://www.w3.org/2000/svg";
const n = (v: number) => Math.round(v * 100) / 100;
const esc = (v: string) => v.replace(/[<>&"']/g, "");

/** What a note has drawn in it. */
export type StrokesIn = (noteId: string) => readonly Stroke[];

/**
 * Each note's own sheet: its colour, then what was drawn in it. ADR-134.
 *
 * An SVG placed just before the note's textarea on the object plane, so the
 * words sit on the drawing, the drawing on the colour, and a photo put on top
 * of the note still covers all three. World units, like everything on the
 * plane; the strokes' points are already where they are on the page.
 */
export class NoteArt {
  private readonly art = new Map<string, { svg: SVGSVGElement; key: string }>();

  constructor(private readonly strokesIn: StrokesIn) {}

  draw(node: HTMLElement, box: TextBox) {
    let entry = this.art.get(box.id);
    if (!entry) {
      const svg = document.createElementNS(SVG, "svg");
      svg.setAttribute("class", "jd-note-art");
      svg.setAttribute("aria-hidden", "true");
      node.before(svg);
      entry = { svg, key: "" };
      this.art.set(box.id, entry);
    }
    const inside = this.strokesIn(box.id);
    // The card is the note AS LAID OUT -- it grows with its words, which an
    // estimate would not follow. Same box the textarea turns about.
    const card: Bounds = {
      x: parseFloat(node.style.left), y: parseFloat(node.style.top),
      w: node.offsetWidth, h: node.offsetHeight,
    };
    const key = signature(box, card, inside);
    if (key === entry.key) return;
    entry.key = key;
    paint(entry.svg, box, card, inside);
  }

  el(id: string): Element | undefined { return this.art.get(id)?.svg; }

  drop(id: string) {
    this.art.get(id)?.svg.remove();
    this.art.delete(id);
  }

  destroy() { for (const id of [...this.art.keys()]) this.drop(id); }
}

/** Enough to know whether anything drawn changed, without a hash of points. */
function signature(box: TextBox, card: Bounds, inside: readonly Stroke[]) {
  const ink = inside.map((s) => {
    const a = s.pts[0]!;
    const z = s.pts[s.pts.length - 1]!;
    return `${s.id}:${s.pts.length}:${a[0]},${a[1]}:${z[0]},${z[1]}:${s.width}:${s.color}`;
  }).join("|");
  return `${card.x},${card.y},${card.w},${card.h}|${box.rot ?? 0}|${fillOf(box)}|${ink}`;
}

function paint(
  svg: SVGSVGElement, box: TextBox, card: Bounds, inside: readonly Stroke[],
) {
  const e = extent(card, box.rot);
  svg.setAttribute("viewBox", `${n(e.x)} ${n(e.y)} ${n(e.w)} ${n(e.h)}`);
  Object.assign(svg.style, { left: `${e.x}px`, top: `${e.y}px`, width: `${e.w}px`, height: `${e.h}px` });
  const r = box.size * 0.5;
  svg.innerHTML =
    `<rect x="${n(card.x)}" y="${n(card.y)}" width="${n(card.w)}" height="${n(card.h)}"`
    + ` rx="${n(r)}" fill="${esc(fillOf(box))}"${turnAttr(card, box.rot)}/>`
    + strokeMarkup(inside, (c) => c);
}

/** Strokes as SVG markup: highlights as one translucent coat (ADR-132), then
 *  ink. `ink` maps a stored colour to the one drawn -- a note keeps its own,
 *  the page flips dark ink at night. */
export function strokeMarkup(strokes: readonly Stroke[], ink: (color: string) => string): string {
  const marks = strokes.filter((s) => s.tool === "highlighter");
  const wash = marks.length
    ? `<g opacity="${HIGHLIGHTER_ALPHA}">${marks.flatMap((s) => segments(s, esc(ink(s.color)), 1)).join("")}</g>`
    : "";
  return wash + strokes.filter((s) => s.tool !== "highlighter")
    .flatMap((s) => segments(s, esc(ink(s.color)), 1)).join("");
}
