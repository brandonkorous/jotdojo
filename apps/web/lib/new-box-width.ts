/**
 * How wide a new text box starts. Issue 015.
 *
 * A third of the visible width is a column on a laptop and was ALSO a column on
 * a phone: at 360px the old arithmetic was `max(120, 118.8)`, so the phone case
 * was the one the fraction never reached. A sentence should use the phone.
 */

export const NEW_WIDTH_FRACTION = 0.33;
export const PHONE_WIDTH_FRACTION = 0.92;
export const MIN_NEW_WIDTH = 120;

/**
 * `visibleWidth` is WORLD units and `onPhone` is about the SCREEN, which is why
 * they are two arguments. A zoomed-out laptop has a wide world and is still not
 * a phone; a zoomed-in phone has a narrow world and still is one.
 */
export function newBoxWidth(visibleWidth: number, onPhone: boolean): number {
  const fraction = onPhone ? PHONE_WIDTH_FRACTION : NEW_WIDTH_FRACTION;
  return Math.max(MIN_NEW_WIDTH, visibleWidth * fraction);
}
