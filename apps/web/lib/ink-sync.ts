import type { InkDelta, Stroke } from "@jotacular/domain";
import { appendStrokesAction } from "@/app/actions";
import { applyInkDeltaAction } from "@/app/actions/live";

/**
 * Eager stroke sync. docs/08-ink.md, ADR-058.
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

/** What the server is known to hold. `version` moves on every write; `count`
 *  only describes appends, which is why both are carried. */
export type ServerPage = { count: number; version: number };

/**
 * One thing to send.
 *
 * An ORDERED list, and that is the whole reason this type exists. Appends and
 * deltas are not interchangeable in time: draw a stroke and rub it out inside
 * the two-second window, and a delta sent ahead of the queue would remove an id
 * the server has never heard of and the append behind it would then put the
 * stroke back. The person watches their erased line return.
 */
type Op = { kind: "append"; strokes: Stroke[] } | { kind: "delta"; delta: InkDelta };

export class InkSync {
  private ops: Op[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight = false;
  /** What the SERVER has, which is the only account that matters. */
  private server: ServerPage;

  constructor(
    private readonly blockId: string,
    private readonly onState: (state: SyncState) => void,
    start: ServerPage = { count: 0, version: 0 },
  ) {
    this.server = start;
  }

  push(strokes: Stroke[]) {
    const last = this.ops[this.ops.length - 1];
    // Coalesced onto the trailing append, never onto one behind a delta.
    if (last?.kind === "append") last.strokes.push(...strokes);
    else this.ops.push({ kind: "append", strokes: [...strokes] });

    if (this.queued >= BATCH_SIZE) return void this.flush();
    this.timer ??= setTimeout(() => this.flush(), BATCH_MS);
  }

  /** Erase, move, recolour, delete. Sent as soon as the queue ahead of it is
   *  clear, because it may be talking about strokes still in that queue. */
  delta(delta: InkDelta) {
    this.ops.push({ kind: "delta", delta });
    void this.flush();
  }

  async flush(): Promise<void> {
    if (this.inFlight) return;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const op = this.ops[0];
    if (!op) return;

    this.inFlight = true;
    this.onState("saving");
    try {
      await (op.kind === "append" ? this.sendAppend(op.strokes) : this.sendDelta(op.delta));
    } catch {
      // Offline, most likely. Everything stays queued.
      this.onState("retrying");
    } finally {
      this.inFlight = false;
      if (this.ops.length > 0) this.timer ??= setTimeout(() => this.flush(), BATCH_MS);
    }
  }

  private async sendAppend(strokes: Stroke[]): Promise<void> {
    const batch = strokes.slice();
    const result = await appendStrokesAction(this.blockId, this.server.count, batch);

    if (result.ok) {
      // Splice off exactly what was sent. Strokes drawn during the request are
      // still in the queue behind it and must survive.
      strokes.splice(0, batch.length);
      if (strokes.length === 0) this.ops.shift();
      this.believe({ count: result.strokeCount, version: result.version });
      this.onState(this.ops.length > 0 ? "saving" : "idle");
    } else if (result.reason === "gap") {
      // The server is behind us, so our idea of its count was wrong. Believe
      // it and let the next flush resend from there.
      this.server = { ...this.server, count: result.serverCount };
      this.onState("retrying");
    } else {
      this.onState("retrying");
    }
  }

  private async sendDelta(delta: InkDelta): Promise<void> {
    const result = await applyInkDeltaAction(this.blockId, delta);
    if (!result.ok) return void this.onState("retrying");

    this.ops.shift();
    this.believe({ count: result.strokeCount, version: result.version });
    this.onState(this.ops.length > 0 ? "saving" : "idle");
  }

  /** Adopt what the server says it has -- after a write, or after catching up
   *  on somebody else's. Never moves backwards. */
  believe(page: ServerPage) {
    if (page.version < this.server.version) return;
    this.server = page;
  }

  get at(): ServerPage { return this.server; }

  /** Strokes drawn here that the server has not confirmed. What a full re-read
   *  has to be merged with, or they are lost. */
  get unsent(): Stroke[] {
    return this.ops.flatMap((op) => (op.kind === "append" ? op.strokes : []));
  }

  get pending() { return this.ops.length; }

  private get queued() {
    return this.ops.reduce((n, op) => n + (op.kind === "append" ? op.strokes.length : 1), 0);
  }

  destroy() { if (this.timer) clearTimeout(this.timer); }
}
