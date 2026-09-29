import type { ImageOnPage, Sticker, Stroke, TextBox } from "@jotacular/domain";
import { stackOf, type StackKind } from "@jotacular/ink-render";
import { RunLayers, type InkRun } from "./ink-run-layers";
import type { InkSurface } from "./ink-surface";
import type { StrokeIndex } from "./ink-index";
import { orderVersion } from "./ink-stack";

/** What the stacker reads and where it finds each object's elements. */
export type StackSource = {
  texts: () => readonly TextBox[];
  images: () => readonly ImageOnPage[];
  stickers: () => readonly Sticker[];
  els: (kind: StackKind, id: string) => Element[];
};

/** Above every object and sheet: the handles are never covered. */
export const GRIPS_RANK = 1_000_000;

/**
 * Puts the page in its one order on screen. ADR-136.
 *
 * Every object gets a z-index from its rank. Strokes below the lowest object
 * stay on the canvas; each later run of strokes becomes a sheet at its rank.
 * Re-sorted only when something could have moved in the order.
 */
export class Stacker {
  private readonly layers: RunLayers;
  private canvas = new Set<string>();
  private key = "";
  private runs: InkRun[] = [];
  private ranks: { kind: StackKind; id: string; rank: number }[] = [];

  constructor(el: HTMLElement, private readonly src: StackSource) {
    this.layers = new RunLayers(el);
  }

  destroy() { this.layers.destroy(); }

  /** Whether a loose stroke is painted on the canvas rather than a sheet. */
  onCanvas(stroke: Stroke): boolean { return this.canvas.has(stroke.id); }

  /** Whether anything on the plane is below the top of the page -- in which
   *  case a new stroke lands on a sheet, above it. */
  get hasObjects(): boolean {
    return this.src.texts().length + this.src.images().length + this.src.stickers().length > 0;
  }

  /** Call on every page repaint; cheap unless the order could have changed,
   *  and the runs cost only the strokes in view. ADR-137. */
  update(strokes: readonly Stroke[], surface: InkSurface, index: StrokeIndex) {
    const key = signature(strokes, this.src);
    if (key !== this.key) { this.key = key; this.restack(strokes); }
    // Every time, not only on a re-sort: an element rebuilt since keeps no
    // z-index of its own. Objects are few; this is a loop, not a sort.
    for (const r of this.ranks) {
      for (const el of this.src.els(r.kind, r.id)) {
        const h = el as HTMLElement;
        if (h.style.zIndex !== String(r.rank)) h.style.zIndex = String(r.rank);
      }
    }
    this.layers.paint(this.runs, surface, index);
  }

  private restack(strokes: readonly Stroke[]) {
    const byId = new Map(strokes.map((s) => [s.id, s]));
    const stack = stackOf({
      strokes, texts: this.src.texts(), images: this.src.images(), stickers: this.src.stickers(),
    });
    const canvas = new Set<string>();
    const runs: InkRun[] = [];
    let rank = 0;
    let run: Stroke[] | null = null;
    let seenObject = false;
    const ranks: typeof this.ranks = [];
    for (const item of stack) {
      if (item.kind === "stroke") {
        if (!seenObject) { canvas.add(item.id); continue; }
        if (!run) { run = []; runs.push({ strokes: run, rank: ++rank }); }
        run.push(byId.get(item.id)!);
        continue;
      }
      seenObject = true;
      run = null;
      rank += 1;
      ranks.push({ kind: item.kind, id: item.id, rank });
    }
    this.ranks = ranks;
    this.canvas = canvas;
    this.runs = runs;
  }
}

/**
 * Changes when the order could have: strokes added or removed (the list is
 * replaced or grows), an object added, removed or re-ranked, or a move within
 * the order. Never a walk over every stroke. ADR-137.
 */
const listIds = new WeakMap<readonly Stroke[], number>();
let nextListId = 1;
function signature(strokes: readonly Stroke[], src: StackSource): string {
  let list = listIds.get(strokes);
  if (list === undefined) { list = nextListId++; listIds.set(strokes, list); }
  let sum = 0;
  const add = (items: readonly { z?: number }[]) => { for (const it of items) sum += it.z ?? 0; };
  add(src.texts()); add(src.images()); add(src.stickers());
  return `${list}|${strokes.length}|${src.texts().length}|${src.images().length}|${src.stickers().length}|${sum}|${orderVersion}`;
}
