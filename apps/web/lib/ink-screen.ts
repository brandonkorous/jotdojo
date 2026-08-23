import type { Bounds } from "./ink-geometry";
import type { InkSurface } from "./ink-surface";
import type { InkViewport } from "./ink-viewport";

/**
 * The seam between where a thing IS and where it is on the glass. ADR-084.
 *
 * Three coordinate spaces meet on this canvas: client coordinates, which is
 * what a browser event carries; surface coordinates, which is client minus the
 * canvas's own offset; and document coordinates, which is where strokes and
 * notes actually live. `pointFrom` already crosses all three for pointer
 * events, and everything else was doing the arithmetic where it stood.
 *
 * It is collected here because the menu made the traffic go BOTH ways for the
 * first place -- a React event arrives in client coordinates and has to become
 * a document point, and a selection lives in document coordinates and has to
 * become a rectangle a popup can point at.
 */

/** Where a client point lands in the document. */
export function worldAt(
  surface: InkSurface, view: InkViewport, clientX: number, clientY: number,
): { x: number; y: number } {
  const r = surface.rect();
  return {
    x: view.toWorldX(clientX - r.left),
    y: view.toWorldY(clientY - r.top),
  };
}

/**
 * A document rectangle as one on the glass, for a popup to anchor to.
 *
 * A `DOMRect` because that is what a virtual anchor has to look like: Base UI
 * positions against anything with a `getBoundingClientRect()`, which is how a
 * menu points at a spot on a canvas that has no element of its own.
 */
export function clientRect(
  surface: InkSurface, view: InkViewport, b: Bounds,
): DOMRect {
  const r = surface.rect();
  return new DOMRect(
    r.left + view.x + b.x * view.k,
    r.top + view.y + b.y * view.k,
    b.w * view.k,
    b.h * view.k,
  );
}
