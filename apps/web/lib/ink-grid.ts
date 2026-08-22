import type { ViewSnapshot } from "./ink-viewport";

/**
 * The dot grid, as CSS custom properties rather than a third canvas. ADR-053.
 *
 * At 1440x900 a 24px grid is ~2,200 dots. On a canvas that is 2,200 arc+fill
 * calls per pan frame, on the same main thread the next Apple Pencil sample
 * arrives on -- which is the budget `desynchronized: true` was bought to
 * protect. A repeating background is composited for free instead.
 */

/** Grid spacing in WORLD units, at k = 1. */
export const GRID_WORLD = 24;

/** The band the SCREEN spacing is kept inside, whatever the zoom. */
export const MIN_SCREEN = 16;
export const MAX_SCREEN = 64;

/**
 * World spacing quantized to a power-of-two ladder.
 *
 * Zoomed out to k = 0.1 an unquantized grid puts dots 2.4px apart and turns to
 * moire. Doubling keeps every dot of the coarser grid on top of a dot of the
 * finer one, so the pattern steps without appearing to slide.
 */
export function gridStep(k: number): number {
  if (!Number.isFinite(k) || k <= 0) return GRID_WORLD;
  let step = GRID_WORLD;
  while (step * k < MIN_SCREEN) step *= 2;
  while (step * k > MAX_SCREEN) step /= 2;
  return step;
}

/** JS `%` keeps the sign of the dividend, so the raw remainder jumps the grid
 *  a whole cell the moment someone pans past zero. */
export function wrap(v: number, step: number): number {
  return step > 0 ? ((v % step) + step) % step : 0;
}

export type GridVars = { step: number; x: number; y: number; dot: number };

/** Screen spacing and phase for the current camera. Pure, because this is the
 *  arithmetic that goes quietly wrong and there is no DOM harness here. */
export function gridVars(v: ViewSnapshot): GridVars {
  const step = gridStep(v.k) * v.k;
  return {
    step,
    x: wrap(v.x, step),
    y: wrap(v.y, step),
    // Dots grow a little with the cell, so a coarse grid does not read as a
    // fine one that someone spilled.
    dot: Math.min(1.6, Math.max(0.8, step / 26)),
  };
}

export function paintGrid(el: HTMLElement, v: ViewSnapshot) {
  const g = gridVars(v);
  el.style.setProperty("--jd-grid", `${g.step}px`);
  el.style.setProperty("--jd-grid-x", `${g.x}px`);
  el.style.setProperty("--jd-grid-y", `${g.y}px`);
  el.style.setProperty("--jd-dot-r", `${g.dot}px`);
}
