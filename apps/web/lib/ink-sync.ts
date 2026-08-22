import type { Stroke } from "@jotdojo/domain";
import { appendStrokesAction, replaceStrokesAction } from "@/app/actions";

/**
 * Eager stroke sync. docs/08-ink.md.
 *
 * Strokes upload as they are drawn -- every ten strokes or two seconds,
 * whichever comes first -- rather than on save. Safari evicts script-writable
 * storage under pressure and after disuse, so a finished drawing must never
 * exist only in the browser.
 *
 * The asymmetry is deliberate and worth stating: losing a typed paragraph is
 * annoying because it can be retyped. Losing a hand-drawn page is unforgivable,
 * because it cannot.
 *
 * The queue is therefore only ever emptied on confirmation from the server.
 * Anything that fails stays queued and goes out with the next flush.
 */

const BATCH_SIZE = 10;
const BATCH_MS = 2000;

export type SyncState = "idle" | "saving" | "retrying";

export class InkSync {
  private queue: Stroke[] = [];
  /** How many strokes the SERVER has, which is the only count that matters. */
  private confirmed = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight = false;
  private full: Stroke[] | null = null;

  constructor(
    private readonly blockId: string,
    private readonly onState: (state: SyncState) => void,
    confirmed = 0,
  ) {
    this.confirmed = confirmed;
  }

  push(strokes: Stroke[]) {
    this.queue.push(...strokes);
    if (this.queue.length >= BATCH_SIZE) return void this.flush();
    if (!this.timer) this.timer = setTimeout(() => this.flush(), BATCH_MS);
  }

  /** Erase changed the middle of the page; the append protocol cannot say that. */
  replace(strokes: Stroke[]) {
    this.full = strokes;
    this.queue = [];
    void this.flush();
  }

  async flush(): Promise<void> {
    if (this.inFlight) return;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.full === null && this.queue.length === 0) return;

    this.inFlight = true;
    this.onState("saving");
    try {
      if (this.full !== null) {
        const whole = this.full;
        const result = await replaceStrokesAction(this.blockId, whole);
        if (result.ok) {
          // Only clear it if this is still the page we sent. Anything erased
          // while the request was in flight has already replaced `full`.
          if (this.full === whole) this.full = null;
          this.confirmed = result.strokeCount;
          this.onState("idle");
        } else {
          this.onState("retrying");
        }
        return;
      }

      const batch = this.queue.slice();
      const result = await appendStrokesAction(this.blockId, this.confirmed, batch);

      if (result.ok) {
        // Splice off exactly what was sent. Strokes drawn during the request
        // are still in the queue behind it and must survive.
        this.queue.splice(0, batch.length);
        this.confirmed = result.strokeCount;
        this.onState(this.queue.length > 0 ? "saving" : "idle");
      } else if (result.reason === "gap") {
        // The server is behind us, so our idea of `confirmed` was wrong.
        // Believe the server and let the next flush resend from there.
        this.confirmed = result.serverCount;
        this.onState("retrying");
      } else {
        this.onState("retrying");
      }
    } catch {
      // Offline, most likely. Everything stays queued.
      this.onState("retrying");
    } finally {
      this.inFlight = false;
      if (this.queue.length > 0 || this.full !== null) {
        this.timer ??= setTimeout(() => this.flush(), BATCH_MS);
      }
    }
  }

  get pending() { return this.queue.length + (this.full ? 1 : 0); }

  destroy() { if (this.timer) clearTimeout(this.timer); }
}
