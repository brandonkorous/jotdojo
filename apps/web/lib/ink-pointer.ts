import type { Point } from "@jotacular/domain";
import type { ViewSnapshot } from "./ink-viewport";

/**
 * Palm rejection, which the web gives us almost for free.
 *
 * `pointerType` separates `pen` from `touch` cleanly, so the rule is: once a
 * stylus has touched this page at all, touch stops drawing. A hand resting on
 * an iPad while writing generates touch events the whole time, and they are
 * indistinguishable from a deliberate finger stroke except by that context.
 *
 * The flag is per page rather than per stroke because the palm lands before
 * the nib does, and a per-stroke check would let the first millimetre of every
 * line through. docs/08-ink.md.
 */
export class PalmGuard {
  private hasSeenPen = false;

  accepts(e: PointerEvent): boolean {
    if (e.pointerType === "pen") {
      this.hasSeenPen = true;
      return true;
    }
    if (e.pointerType === "touch" && this.hasSeenPen) return false;
    return true;
  }
}

/**
 * World-space sample, with everything a later model might want to read.
 *
 * The ONE place screen coordinates become document coordinates, which is why
 * the viewport only has to be threaded here: every hit test downstream --
 * erase, lasso, marquee -- already works in this space and needs no change.
 */
export function pointFrom(
  e: PointerEvent, rect: DOMRect, startedAt: number, v: ViewSnapshot,
): Point {
  // A mouse reports pressure 0 when down and there is no meaningful value to
  // read; 0.5 keeps the width where an unmodulated pen would sit.
  const pressure = e.pointerType === "mouse" || e.pressure === 0 ? 0.5 : e.pressure;
  return [
    (e.clientX - rect.left - v.x) / v.k,
    (e.clientY - rect.top - v.y) / v.k,
    performance.now() - startedAt,
    pressure,
    e.tiltX ?? 0,
    e.tiltY ?? 0,
  ];
}

/**
 * Every sample the pen produced, not just the one per frame the event carries.
 *
 * Safari does not implement getCoalescedEvents, so Apple Pencil ink is
 * reconstructed from far fewer samples than the hardware captured -- which is
 * exactly why the curve fitting in ink-paint is not optional. Chrome on Android
 * does implement it, so S Pen ink is genuinely smoother here than Pencil ink.
 * That will be reported as an iPad bug. It is not one. docs/08.
 */
export function samplesOf(e: PointerEvent): PointerEvent[] {
  const events = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [e];
  return events.length > 0 ? events : [e];
}

/**
 * Attach the pointer handlers and hand back the way to remove them.
 *
 * One list rather than two. Adding a listener in the constructor and forgetting
 * it in `destroy` leaks a canvas per note opened, and the two lists drifting is
 * the only way that happens.
 *
 * NO `pointerleave`, and its absence is load-bearing. The engine calls
 * `setPointerCapture` on pointerdown, and moving capture to an element fires
 * `pointerout`/`pointerleave` as the capture target changes -- carrying the
 * SAME pointerId, while the pen is still down. `onUp` guards on exactly those
 * two things, so the leave passed the guard and ended the stroke at one point,
 * which `capture.finish()` then discards. Nothing drawn, no error, and only on
 * touch: a mouse does not fire leave when capture lands on the element it is
 * already over. That is why the iPhone drew nothing and the desktop was fine.
 *
 * Nothing is lost by dropping it. Capture guarantees `pointerup` reaches this
 * element even when the finger leaves it, and `pointercancel` still covers a
 * genuine abort -- so a stroke that runs off the edge now continues instead of
 * being cut, which is what someone drawing expects anyway.
 */
export function bindPointer(
  el: HTMLElement,
  h: { down: (e: PointerEvent) => void; move: (e: PointerEvent) => void; up: (e: PointerEvent) => void },
): () => void {
  const pairs = [
    ["pointerdown", h.down], ["pointermove", h.move], ["pointerup", h.up],
    ["pointercancel", h.up],
  ] as const;
  for (const [name, fn] of pairs) el.addEventListener(name, fn);
  return () => { for (const [name, fn] of pairs) el.removeEventListener(name, fn); };
}
