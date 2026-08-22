/**
 * One repaint per frame, whatever asked for it.
 *
 * The engine used to repaint synchronously from inside pointer handlers:
 * `eraseAt` once per erasing SAMPLE, and a selection drag once per
 * `pointermove`. Both are full-page repaints, at pointer rate, on the same
 * thread the next Apple Pencil sample arrives on -- and a pen reports far
 * faster than a display refreshes, so most of that work was thrown away
 * unseen.
 *
 * Marking is cheap and idempotent; the paint happens once, on the frame.
 */

export type Dirty = "page" | "overlay" | "live" | "grid";

export class FrameLoop {
  private readonly dirty = new Set<Dirty>();
  private raf = 0;

  constructor(private readonly paint: (dirty: ReadonlySet<Dirty>) => void) {}

  mark(...what: Dirty[]) {
    for (const w of what) this.dirty.add(w);
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      // Drained BEFORE painting, so anything marked during the paint schedules
      // a fresh frame instead of being swallowed by this one.
      const now = new Set(this.dirty);
      this.dirty.clear();
      this.paint(now);
    });
  }

  cancel() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.dirty.clear();
  }
}
