import type { Sticker } from "@jotacular/domain";
import { placeSticker } from "@jotacular/ink-render";

/**
 * The stickers on the object plane. ADR-115.
 *
 * The third thing that lives on that layer, beside typed text (ink-plane.ts)
 * and photographs (ink-image-plane.ts), and it sits there for the same reason
 * both of those do: the layer is transformed, so a sticker pans and scales
 * with the handwriting for free and never goes through a `<canvas>` ancestor,
 * which would scale a bitmap and blur the ink. ADR-065 established the layer.
 *
 * Nothing here takes a pointer. A sticker is selected by lassoing or tapping
 * it on the ink surface underneath, exactly as a stroke is, so there is no
 * second hit-testing path to disagree with the first.
 *
 * The artwork comes from `placeSticker`, which is also what the exporter
 * calls -- so what is on the screen and what lands in a PNG are placed by one
 * function rather than two that agree today. ADR-078.
 */
const SVG = "http://www.w3.org/2000/svg";

export class InkStickerPlane {
  private readonly el: HTMLElement;
  private readonly nodes = new Map<string, SVGSVGElement>();

  constructor(el: HTMLElement) {
    this.el = el;
  }

  destroy() {
    for (const node of this.nodes.values()) node.remove();
    this.nodes.clear();
  }

  render(stickers: readonly Sticker[]) {
    const live = new Set(stickers.map((s) => s.id));
    for (const [id, node] of this.nodes) {
      if (live.has(id)) continue;
      node.remove();
      this.nodes.delete(id);
    }
    for (const sticker of stickers) this.one(sticker);
  }

  private one(sticker: Sticker) {
    let node = this.nodes.get(sticker.id);
    if (!node) {
      node = document.createElementNS(SVG, "svg");
      node.setAttribute("class", "jd-plane-sticker");
      node.setAttribute("aria-hidden", "true");
      this.el.append(node);
      this.nodes.set(sticker.id, node);
    }
    node.style.left = `${sticker.x}px`;
    node.style.top = `${sticker.y}px`;
    node.style.width = `${sticker.size}px`;
    node.style.height = `${sticker.size}px`;

    // Everything except the position; a drag changes only left and top, and
    // rebuilding the path on every frame of one would be a parse per pixel.
    const signature = `${sticker.name}|${sticker.size}|${sticker.color}`;
    if (node.dataset.signature === signature) return;
    node.dataset.signature = signature;
    this.draw(node, sticker);
  }

  /**
   * The picture, in the sticker's own square.
   *
   * The viewBox is the SIZE rather than the artwork's own box, so
   * `placeSticker`'s document-unit numbers can be used directly -- shifted to
   * the sticker's corner, because this element already sits there.
   */
  private draw(node: SVGSVGElement, sticker: Sticker) {
    node.replaceChildren();
    node.setAttribute("viewBox", `0 0 ${sticker.size} ${sticker.size}`);
    const p = placeSticker(sticker);
    // A name this build has no art for. Skipping beats drawing a hole, and a
    // newer client on the same page is the way it happens. ADR-115.
    if (!p) return;

    const group = document.createElementNS(SVG, "g");
    group.setAttribute(
      "transform",
      `translate(${p.tx - sticker.x} ${p.ty - sticker.y}) scale(${p.k})`,
    );
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", p.art.d);
    path.setAttribute("fill", sticker.color);
    // The die-cut edge. `paint-order` puts the white BEHIND the artwork, which
    // is the whole difference between a sticker and an icon. ADR-115.
    path.setAttribute("stroke", "#FFFFFF");
    path.setAttribute("stroke-width", String(p.stroke));
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("paint-order", "stroke fill");
    group.append(path);
    node.append(group);
  }
}
