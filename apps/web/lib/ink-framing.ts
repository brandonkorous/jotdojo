import type { Stroke } from "@jotacular/domain";
import { strokesBounds, union, type Bounds } from "@jotacular/ink-render";
import type { InkSurface } from "./ink-surface";
import type { InkViewport } from "./ink-viewport";
import type { InkPainter } from "./ink-painter";

/**
 * Where the camera points, and when React is allowed to hear about it.
 *
 * Split out of ink-engine.ts at the size limit, and it is a real seam: nothing
 * here changes a stroke. It answers two questions -- what part of an endless
 * surface is on screen, and which camera changes are worth a re-render -- and
 * the engine below it answers what is drawn on that surface. ADR-053, ADR-058.
 */
export class InkFraming {
  /** The last camera React was told about, so it hears nothing on a pan. */
  private reported = { k: 1, home: true };

  constructor(
    private readonly view: InkViewport,
    private readonly surface: InkSurface,
    private readonly painter: InkPainter,
    private readonly onView?: (k: number, home: boolean) => void,
  ) {}

  /**
   * Frame the CONTENT. An empty page lands exactly where it always did.
   *
   * Text is in the union because a note with nothing but a typed box on it has
   * no stroke bounds at all, and would open on blank paper somewhere off to the
   * side -- the exact complaint ADR-054 exists to answer, arriving through a
   * new kind of object. ADR-065.
   */
  fitTo(strokes: readonly Stroke[], texts?: Bounds | null) {
    const ink = strokesBounds(strokes);
    const box = ink && texts ? union(ink, texts) : (ink ?? texts ?? null);
    this.view.fitTo(box, this.surface.width, this.surface.height);
    this.tell();
    this.painter.now();
  }

  /**
   * Resizing clears both canvases, so the repaint is not optional.
   *
   * The view is ANCHORED, not re-fitted: this fires when the iOS keyboard opens
   * and when a tablet rotates, and re-framing there would teleport the page out
   * from under somebody mid-sentence.
   */
  resize(cssWidth: number, cssHeight: number) {
    const was = { w: this.surface.width, h: this.surface.height };
    this.surface.resize(cssWidth, cssHeight);
    this.view.keepCentre(was.w, was.h, cssWidth, cssHeight);
    this.tell();
    this.painter.now();
  }

  /** The camera moved under its own steam -- a pan, a pinch. */
  moved() {
    this.painter.everything();
    this.tell();
  }

  /**
   * React hears about the camera only when something it renders changed: the
   * zoom readout, or whether there is anywhere to go back to. Panning around
   * out there re-renders nothing.
   */
  private tell() {
    const home = this.view.atHome;
    if (this.view.k === this.reported.k && home === this.reported.home) return;
    this.reported = { k: this.view.k, home };
    this.onView?.(this.view.k, home);
  }
}
