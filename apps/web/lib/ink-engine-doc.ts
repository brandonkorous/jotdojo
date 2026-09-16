import type { InkDelta, Stroke } from "@jotacular/domain";
import { clip, holding, isEmpty, put, reborn, take, PASTE_OFFSET } from "./ink-clipboard";
import { EMPTY, InkHistory, fold, type Snapshot } from "./ink-history";
import type { InkLinks } from "./ink-engine-links";
import type { InkTextLayer } from "./ink-text-layer";
import type { InkImageLayer } from "./ink-image-layer";
import type { InkSelection } from "./ink-selection";

/**
 * The page as a whole: what is on it, and the record of what happened to it.
 * ADR-109, ADR-110.
 *
 * Split from ink-engine.ts, which was already at its size limit before either
 * of these existed, and the seam is a real one. Everything left in the engine
 * is about a POINTER and a CAMERA -- what is under the nib, where the view is
 * looking. Nothing here knows either. This is the document.
 */

export type DocContext = {
  strokes: () => Stroke[];
  setStrokes: (next: Stroke[]) => void;
  texts: () => InkTextLayer | null;
  images: () => InkImageLayer | null;
  links: () => InkLinks | null;
  sel: () => InkSelection;
  /** Publish WITHOUT recording. An undo is not a new thing to undo, and a
   *  paste records itself once rather than once per kind. */
  send: (delta: InkDelta) => void;
  /** The same, and remember it. What an ordinary edit uses. */
  record: (delta: InkDelta) => void;
  repaint: () => void;
  overlay: () => void;
  dropSelection: () => void;
  onSelection: () => void;
};

export class InkDoc {
  readonly history = new InkHistory();

  constructor(private readonly ctx: DocContext) {}

  /** The page right now, of every kind. What an inverse is computed against
   *  and what a fold produces. */
  get snapshot(): Snapshot {
    return {
      strokes: this.ctx.strokes(),
      texts: this.ctx.texts()?.all ?? [],
      images: this.ctx.images()?.all ?? [],
      links: this.ctx.links()?.all ?? [],
    };
  }

  /** A page arriving from anywhere but this person's hands: opening a note,
   *  or catching up. Never undoable -- InkHistory.observe says why. */
  observe() { this.history.observe(this.snapshot); }

  /** A page that was replaced rather than changed. */
  reset() { this.history.reset(this.snapshot); }

  get canUndo() { return this.history.canUndo; }
  get canRedo() { return this.history.canRedo; }

  undo(): boolean { return this.replay(this.history.undo()); }
  redo(): boolean { return this.replay(this.history.redo()); }

  /**
   * Put the clipboard's contents on the page, offset from where they were.
   *
   * The copy is SELECTED afterwards, so it can be dragged where it belongs
   * straight away rather than found and lassoed first. ADR-110.
   */
  paste(): boolean {
    const held = take();
    if (!held) return false;
    const next = reborn(held, PASTE_OFFSET, PASTE_OFFSET);
    this.ctx.setStrokes([...this.ctx.strokes(), ...next.strokes]);
    const texts = this.ctx.texts();
    const images = this.ctx.images();
    const links = this.ctx.links();
    texts?.load([...texts.all, ...next.texts]);
    images?.load([...images.all, ...next.images]);
    links?.load([...links.all, ...next.links]);

    this.ctx.record({
      remove: [], upsert: next.strokes,
      ...(texts ? { texts: [...texts.all] } : {}),
      ...(images ? { images: [...images.all] } : {}),
      ...(links ? { links: [...links.all] } : {}),
    });

    // BY ID, not by the objects `reborn` returned. Every layer COPIES what it
    // is loaded with -- a drag mutates objects in place, and two pages sharing
    // one would move both -- so holding the originals would give a selection
    // that moved nothing anybody could see.
    const fresh = new Set([...next.texts, ...next.images].map((o) => o.id));
    this.ctx.sel().hold(
      next.strokes,
      (texts?.all ?? []).filter((t) => fresh.has(t.id)),
      (images?.all ?? []).filter((i) => fresh.has(i.id)),
    );
    this.after();
    return true;
  }

  /** What the lasso caught, kept for a paste. False when it caught nothing,
   *  so an empty copy never silently empties the clipboard. */
  copy(): boolean {
    const sel = this.ctx.sel();
    const clipping = clip({
      strokes: sel.selected, texts: sel.selectedTexts, images: sel.selectedImages,
    }, this.ctx.links()?.all ?? []);
    if (isEmpty(clipping)) return false;
    put(clipping);
    return true;
  }

  /** Copy and paste in one gesture, which is what people actually want when
   *  they mean "another one of these". */
  duplicate(): boolean { return this.copy() && this.paste(); }

  get canPaste() { return holding(); }

  /**
   * Apply a delta this device decided on, and send it.
   *
   * The selection goes, because the objects it pointed at may have just been
   * taken away or put back -- the same call `reconcile` makes for the same
   * reason. ADR-058.
   */
  private replay(delta: InkDelta | null): boolean {
    if (!delta) return false;
    const next = fold(this.snapshot, delta);
    this.ctx.setStrokes(next.strokes.map((s) => ({ ...s, pts: s.pts.map((p) => [...p] as typeof p) })));
    this.ctx.texts()?.load(next.texts);
    this.ctx.images()?.load(next.images);
    this.ctx.links()?.load(next.links);
    this.ctx.dropSelection();
    this.ctx.send(delta);
    this.after();
    return true;
  }

  private after() {
    this.ctx.repaint();
    this.ctx.overlay();
    this.ctx.onSelection();
  }
}

export { EMPTY };
