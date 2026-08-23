import type { Stroke, TextBox } from "@jotacular/domain";
import { getInkAction } from "@/app/actions";
import { strokesSinceAction } from "@/app/actions/live";
import { needsFullRead } from "./ink-merge";
import type { InkSync, ServerPage } from "./ink-sync";

/**
 * Catching this canvas up with a page somebody else changed. ADR-058.
 *
 * The live stream never carries strokes -- only "the page is now at this count
 * and this version" -- so everything that actually reaches the canvas comes
 * through here, over the same authorized reads as any other fetch.
 *
 * Two ways to catch up, and choosing between them is the only decision:
 *
 *   the page only GREW      ask for what came after. The common case, because
 *                           drawing is mostly what people do
 *   the middle CHANGED      read it whole, because every index is now a guess
 *
 * A full read merges the upload queue back in. Adopting the server's page
 * outright would be simpler and would throw away strokes drawn in the last two
 * seconds, which is not a trade this product makes.
 */

export type CatchupTarget = {
  applyRemote(strokes: Stroke[]): void;
  reconcile(server: Stroke[], pending: readonly Stroke[]): void;
  /** Somebody else's text boxes. Only ever reaches here through a FULL read:
   *  a text edit bumps the version without moving the stroke count, which
   *  `needsFullRead` already treats as "the middle changed". ADR-065. */
  applyRemoteTexts(texts: TextBox[]): void;
};

export class InkCatchup {
  private running = false;
  private again = false;

  constructor(
    private readonly blockId: string,
    private readonly sync: InkSync,
    private readonly target: CatchupTarget,
  ) {}

  /**
   * Catch up. `said` is what an event claimed, when there was one.
   *
   * Without it -- a reconnect, or a tab coming back to the foreground -- there
   * is no claim to trust and the page is checked against the server directly.
   */
  async check(said?: ServerPage): Promise<void> {
    // An event whose version we have already reached is our own write coming
    // back, or one that arrived out of order. Nothing to do, and no round trip.
    if (said && said.version <= this.sync.at.version) return;

    if (this.running) { this.again = true; return; }
    this.running = true;
    try {
      await this.catchUp();
    } catch {
      // A failed catch-up leaves this device showing a slightly old page, which
      // the next event or reconnect corrects. Nothing local is at risk.
    } finally {
      this.running = false;
      if (this.again) { this.again = false; void this.check(); }
    }
  }

  private async catchUp(): Promise<void> {
    const have = this.sync.at;
    const tail = await strokesSinceAction(this.blockId, have.count);
    if (!tail.ok) return;

    const now = { count: tail.strokeCount, version: tail.version };
    if (needsFullRead(have, now)) return this.readWholePage();

    if (tail.strokes.length > 0) this.target.applyRemote(tail.strokes as Stroke[]);
    this.sync.believe(now);
  }

  private async readWholePage(): Promise<void> {
    const ink = await getInkAction(this.blockId);
    this.target.reconcile(ink.document.strokes as Stroke[], this.sync.unsent);
    this.target.applyRemoteTexts((ink.document.texts ?? []) as TextBox[]);
    this.sync.believe({ count: ink.strokeCount, version: ink.version });
  }
}
