import { gripPoints, type Frame } from "./ink-selection-grip";
import { GRIPS_RANK } from "./ink-stacker";

const SVG = "http://www.w3.org/2000/svg";
const INK = "#4B5FA8";

/**
 * The handles, drawn ON the object plane rather than on the canvas under it.
 * ADR-122. Under it, a photo or a card beside the held one covered them.
 * World units, so the plane's camera transform carries them; sized by 1/k.
 */
export class GripOverlay {
  private readonly svg: SVGSVGElement;

  constructor(plane: HTMLElement) {
    this.svg = document.createElementNS(SVG, "svg");
    this.svg.setAttribute("class", "jd-grips");
    this.svg.setAttribute("aria-hidden", "true");
    // Above every ranked and unranked thing on the plane. ADR-136.
    this.svg.style.zIndex = String(GRIPS_RANK);
    plane.append(this.svg);
  }

  destroy() { this.svg.remove(); }

  draw(g: Frame | null, k: number) {
    if (!g) return void this.svg.replaceChildren();
    const p = gripPoints(g, k);
    const r = 6 / k;
    const pts = p.outline.map(([x, y]) => `${x},${y}`).join(" ");
    const [rx, ry] = p.resize;
    this.svg.innerHTML =
      `<polygon points="${pts}" fill="none"/>`
      + `<line x1="${p.top[0]}" y1="${p.top[1]}" x2="${p.knob[0]}" y2="${p.knob[1]}"/>`
      + `<circle cx="${p.knob[0]}" cy="${p.knob[1]}" r="${r}" fill="#fff"/>`
      + `<rect x="${rx - r}" y="${ry - r}" width="${r * 2}" height="${r * 2}" fill="#fff"/>`;
    for (const el of this.svg.children) {
      el.setAttribute("stroke", INK);
      el.setAttribute("stroke-width", "1.5");
      el.setAttribute("vector-effect", "non-scaling-stroke");
    }
  }
}
