/**
 * Dragging the page with a mouse. ADR-123.
 *
 * The pan tool drags with any button; every other tool drags with the middle
 * one. Fingers already pan with two (ink-gestures.ts), so this is the mouse's.
 */
export type PanHost = {
  readonly view: { panBy(dx: number, dy: number): void };
  onView(): void;
};

export class PanDrag {
  private last: { x: number; y: number } | null = null;
  private pointer: number | null = null;

  get active() { return this.pointer !== null; }

  /** Whether this press is a pan: the pan tool, or the middle button. */
  static wants(tool: string, e: { button: number }) {
    return tool === "pan" || e.button === 1;
  }

  down(e: PointerEvent) {
    this.pointer = e.pointerId;
    this.last = { x: e.clientX, y: e.clientY };
  }

  move(host: PanHost, e: PointerEvent): boolean {
    if (e.pointerId !== this.pointer || !this.last) return false;
    host.view.panBy(e.clientX - this.last.x, e.clientY - this.last.y);
    this.last = { x: e.clientX, y: e.clientY };
    host.onView();
    return true;
  }

  up(e: PointerEvent): boolean {
    if (e.pointerId !== this.pointer) return false;
    this.pointer = null;
    this.last = null;
    return true;
  }
}
