import type { Point } from "@jotdojo/domain";

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

/** Canvas-space sample, with everything a later model might want to read. */
export function pointFrom(e: PointerEvent, rect: DOMRect, startedAt: number): Point {
  // A mouse reports pressure 0 when down and there is no meaningful value to
  // read; 0.5 keeps the width where an unmodulated pen would sit.
  const pressure = e.pointerType === "mouse" || e.pressure === 0 ? 0.5 : e.pressure;
  return [
    e.clientX - rect.left,
    e.clientY - rect.top,
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
 */
export function bindPointer(
  el: HTMLElement,
  h: { down: (e: PointerEvent) => void; move: (e: PointerEvent) => void; up: (e: PointerEvent) => void },
): () => void {
  const pairs = [
    ["pointerdown", h.down], ["pointermove", h.move], ["pointerup", h.up],
    ["pointercancel", h.up], ["pointerleave", h.up],
  ] as const;
  for (const [name, fn] of pairs) el.addEventListener(name, fn);
  return () => { for (const [name, fn] of pairs) el.removeEventListener(name, fn); };
}
