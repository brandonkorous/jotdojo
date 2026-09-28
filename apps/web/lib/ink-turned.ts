import { centreOf, corners, extent, hits, spin, bearing } from "@jotacular/ink-render";

/** Turned objects -- the maths is ink-render's, so screen and export agree.
 *  ADR-122, and ADR-078 for why there is only one copy. */
export { centreOf, corners, extent, hits, spin, bearing };

/** Draw an element turned about its own centre, or upright. */
export function applyTurn(node: HTMLElement | SVGElement, rot?: number) {
  node.style.transform = rot ? `rotate(${rot}deg)` : "";
  node.style.transformOrigin = rot ? "50% 50%" : "";
}
