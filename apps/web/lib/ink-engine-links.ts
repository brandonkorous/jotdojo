import type { InkDelta, Link } from "@jotacular/domain";
import type { Page } from "./ink-engine-page";
import { distanceTo, endsFor, segmentFor, type Segment } from "@jotacular/ink-render";

/**
 * The arrows on the page, and the one being aimed. ADR-108.
 *
 * A store rather than a field on the engine, for the reason ObjectPlane is one:
 * arrows have a lifecycle of their own -- aimed, tied, orphaned -- and putting
 * that in a class that also owns the frame loop is how ink-engine.ts reached
 * its size limit twice already.
 *
 * Aiming attaches ONE pointer listener while it lasts and drops it the moment
 * it ends. The alternative was a branch in ink-input.ts, which is the hot path
 * every pen sample runs through and the last place to put a rare mode.
 */

export type LinkContext = {
  /** The page, read at draw time: an arrow follows what it is tied to. */
  page: () => Page;
  onDelta: (delta: InkDelta) => void;
  /** Finished arrows live on the committed layer with the strokes. */
  repaint: () => void;
  /** The aim line lives on the overlay. */
  overlay: () => void;
  worldAt: (clientX: number, clientY: number) => { x: number; y: number };
  /** Where the aim listener attaches while somebody is pointing at a target. */
  surface: HTMLElement;
  /** Whether an arrow is being aimed, so the page can say so. */
  onAiming?: (on: boolean) => void;
};

export type LinkStyle = { color: string; width: number };

export class InkLinks {
  private links: Link[] = [];
  private from: string | null = null;
  private at: { x: number; y: number } | null = null;
  private style: LinkStyle = { color: "#1F2933", width: 2.2 };

  constructor(private readonly ctx: LinkContext) {}

  destroy() { this.stopAiming(); }

  get all(): readonly Link[] { return this.links; }
  get aiming() { return this.from !== null; }

  /** Load a page. Copied, because a drag mutates objects in place and two
   *  pages sharing one would move both -- the rule every layer here follows. */
  load(links: readonly Link[]) {
    this.links = links.map((l) => ({ ...l, from: { ...l.from }, to: { ...l.to } }));
    this.cancelAim();
  }

  /** Somebody else's arrows. Nothing here has a caret to protect, so adopting
   *  is just loading -- the call InkImageLayer makes for the same reason. */
  adopt(links: readonly Link[]) {
    this.load(links);
    this.ctx.repaint();
  }

  /** Start aiming from one object. The next tap on another finishes it. */
  beginAim(fromId: string, style: LinkStyle) {
    this.from = fromId;
    this.style = style;
    this.at = null;
    this.ctx.surface.addEventListener("pointermove", this.track);
    this.ctx.onAiming?.(true);
    this.ctx.overlay();
  }

  /**
   * Finish the arrow, if the tap landed on something else.
   *
   * Returns whether the tap was consumed. Tapping the SOURCE again cancels,
   * which is the only sensible reading of "an arrow from this to this" -- and
   * it means a mistake costs one tap rather than a trip to a menu.
   */
  finishAim(toId: string | null): boolean {
    const from = this.from;
    if (from === null) return false;
    this.cancelAim();
    if (toId === null || toId === from) return true;
    this.connect(from, toId);
    return true;
  }

  cancelAim() {
    if (this.from === null) return;
    this.from = null;
    this.at = null;
    this.stopAiming();
    this.ctx.onAiming?.(false);
    this.ctx.overlay();
  }

  /** An arrow between two objects that are both still there. */
  connect(fromId: string, toId: string) {
    const ends = endsFor(this.ctx.page(), fromId, toId);
    if (!ends) return;
    const link: Link = {
      id: crypto.randomUUID(), ...ends,
      color: this.style.color, width: this.style.width, head: "end",
    };
    this.links = [...this.links, link];
    this.ctx.repaint();
    this.publish();
  }

  /**
   * Take the named arrows, and any left pointing at nothing.
   *
   * The second half mirrors what `orphanedBy` does server-side. Without it the
   * arrow stays on screen until the next reload, which looks like the delete
   * failed rather than like the page catching up.
   */
  remove(ids: readonly string[]): boolean {
    const gone = new Set(ids);
    const before = this.links.length;
    this.links = this.links.filter((l) => !gone.has(l.id)
      && !(l.from.id !== null && gone.has(l.from.id))
      && !(l.to.id !== null && gone.has(l.to.id)));
    if (this.links.length === before) return false;
    this.ctx.repaint();
    return true;
  }

  /** The arrow nearest this point, within reach, or null. For the eraser: an
   *  arrow is a line, and rubbing out a line is what an eraser is for. */
  hitAt(x: number, y: number, radius: number): Link | null {
    const page = this.ctx.page();
    for (let i = this.links.length - 1; i >= 0; i--) {
      const link = this.links[i]!;
      const seg = segmentFor(link, page);
      if (seg && distanceTo(seg, x, y) <= radius) return link;
    }
    return null;
  }

  /** Every arrow that can be drawn right now, with the line to draw it on. */
  segments(): Array<{ link: Link; seg: Segment }> {
    const page = this.ctx.page();
    const out: Array<{ link: Link; seg: Segment }> = [];
    for (const link of this.links) {
      const seg = segmentFor(link, page);
      if (seg) out.push({ link, seg });
    }
    return out;
  }

  /** The dashed line from the source to wherever the pointer is, or null when
   *  nobody is aiming and when the pointer has not moved yet. */
  aimSegment(): Segment | null {
    if (this.from === null || !this.at) return null;
    const seg = segmentFor(
      { id: "", from: { id: this.from, x: this.at.x, y: this.at.y },
        to: { id: null, x: this.at.x, y: this.at.y },
        color: this.style.color, width: this.style.width, head: "end" },
      this.ctx.page(),
    );
    return seg;
  }

  /** Every arrow, as the delta carries them. */
  publish() {
    this.ctx.onDelta({ remove: [], upsert: [], links: [...this.links] });
  }

  private track = (e: PointerEvent) => {
    this.at = this.ctx.worldAt(e.clientX, e.clientY);
    this.ctx.overlay();
  };

  private stopAiming() {
    this.ctx.surface.removeEventListener("pointermove", this.track);
  }
}
