import type { Point, Stroke } from "@jotdojo/domain";
import type { InkTool } from "./canvas-tool";
import type { StrokeCapture } from "./ink-capture";
import type { InkSelection } from "./ink-selection";
import type { InkSurface } from "./ink-surface";
import type { ViewSnapshot } from "./ink-viewport";
import { bindPointer, PalmGuard, pointFrom, samplesOf } from "./ink-pointer";

/**
 * The pointer state machine, split from the page it draws on. ADR-053.
 *
 * One finger, one pen, one stroke at a time. What is DRAWN lives in the engine;
 * what a pointer is currently DOING lives here, and the two grew apart the
 * moment the canvas gained a camera.
 */

/** What the input machine is allowed to ask of the page. Deliberately narrow:
 *  it may start, extend and finish things, and it may never paint. */
export type InputHost = {
  readonly surface: InkSurface;
  readonly view: ViewSnapshot;
  readonly capture: StrokeCapture;
  readonly sel: InkSelection;
  readonly tool: InkTool;
  /** True when something was actually removed, so the drag knows to resend. */
  eraseAt(x: number, y: number): boolean;
  /** The erase drag ended; resend the page if it actually removed anything. */
  endErase(erased: boolean): void;
  commit(stroke: Stroke): void;
  finishSelect(): void;
  dropSelection(): void;
  dragSelection(x: number, y: number): void;
  scheduleLive(): void;
};

export class InkInput {
  private readonly palm = new PalmGuard();
  private penDown = false;
  private activePointer: number | null = null;
  private startedAt = 0;
  private erasedThisDrag = false;
  private readonly unbind: () => void;

  constructor(private readonly el: HTMLElement, private readonly host: InputHost) {
    this.unbind = bindPointer(el, { down: this.down, move: this.move, up: this.up });
  }

  destroy() { this.unbind(); }

  private pointAt(e: PointerEvent): Point {
    return pointFrom(e, this.host.surface.rect(), this.startedAt, this.host.view);
  }

  private down = (e: PointerEvent) => {
    if (!this.palm.accepts(e)) return;
    e.preventDefault();
    this.el.setPointerCapture(e.pointerId);
    this.activePointer = e.pointerId;
    this.penDown = true;
    this.startedAt = performance.now();
    this.erasedThisDrag = false;

    const p = this.pointAt(e);
    const host = this.host;

    if (host.tool === "eraser") return void this.erase(p);

    if (host.tool === "select") {
      // Inside an existing marquee means "move this", not "start over" --
      // otherwise a selection could never be dragged, only redrawn.
      if (host.sel.covers(p[0], p[1])) return void host.sel.beginDrag(p[0], p[1]);
      host.dropSelection();
      host.sel.beginLasso(p);
      return void host.scheduleLive();
    }

    host.capture.begin(p);
    host.scheduleLive();
  };

  private move = (e: PointerEvent) => {
    if (!this.penDown || e.pointerId !== this.activePointer) return;
    e.preventDefault();
    const host = this.host;

    if (host.tool === "eraser") return void this.erase(this.pointAt(e));

    if (host.tool === "select") {
      const p = this.pointAt(e);
      if (host.sel.dragging) return void host.dragSelection(p[0], p[1]);
      host.sel.extendLasso(p);
      return void host.scheduleLive();
    }

    // The hot path: hoist the rect and the camera once, then map every sample
    // the pen actually produced rather than the one per frame the event carries.
    const rect = host.surface.rect();
    const view = host.view;
    for (const sample of samplesOf(e)) {
      host.capture.extend(pointFrom(sample, rect, this.startedAt, view));
    }
    host.scheduleLive();
  };

  private up = (e: PointerEvent) => {
    if (!this.penDown || e.pointerId !== this.activePointer) return;
    this.penDown = false;
    this.activePointer = null;
    if (this.el.hasPointerCapture(e.pointerId)) this.el.releasePointerCapture(e.pointerId);

    const host = this.host;
    if (host.tool === "eraser") return void host.endErase(this.erasedThisDrag);
    if (host.tool === "select") return void host.finishSelect();

    const stroke = host.capture.finish();
    if (stroke) host.commit(stroke);
  };

  private erase(p: Point) {
    if (this.host.eraseAt(p[0], p[1])) this.erasedThisDrag = true;
  }
}
