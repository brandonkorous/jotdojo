import { DomainError } from "./errors";

/**
 * How far an object on the page is turned, in degrees, clockwise, about its
 * own centre. ADR-122. Absent is upright, which is every object written
 * before turning existed -- so absent, not zero, is what upright stores.
 */
export type Turned = { rot?: number };

/** Within a hair of upright is upright: a card that is 0.3 degrees off reads
 *  as a mistake, not as a choice. */
const SNAP = 1;

/** In (-180, 180], rounded to a tenth, or undefined for upright. */
export function turn(given: unknown, where: string, code: string): number | undefined {
  if (given === undefined || given === null) return undefined;
  if (typeof given !== "number" || !Number.isFinite(given)) {
    throw new DomainError(`${where}: rot must be a finite number`, code, 400);
  }
  return normalTurn(given);
}

export function normalTurn(deg: number): number | undefined {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  d = Math.round(d * 10) / 10;
  return Math.abs(d) < SNAP ? undefined : d;
}

/** Spread into a validated object, so upright stays absent. */
export const withTurn = (rot: number | undefined): Turned => (rot === undefined ? {} : { rot });
