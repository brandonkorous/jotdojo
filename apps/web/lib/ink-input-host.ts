import type { Stroke } from "@jotacular/domain";
import type { InkTool } from "./canvas-tool";
import type { StrokeCapture } from "./ink-capture";
import type { InkSelection } from "./ink-selection";
import type { InkSurface } from "./ink-surface";
import type { InkViewport } from "./ink-viewport";
import type { Bounds } from "./ink-geometry";

/**
 * The contract between a pointer and the page, apart from the machine that
 * routes one. ADR-053, and the seam ink-input.ts named for itself: what the
 * input machine may ASK is a different thing from what it DOES.
 */
/** What the input machine is allowed to ask of the page. Deliberately narrow:
 *  it may start, extend and finish things, and it may never paint. */
export type InputHost = {
  readonly surface: InkSurface;
  readonly view: InkViewport;
  readonly capture: StrokeCapture;
  readonly sel: InkSelection;
  readonly tool: InkTool;
  /** True when something was actually removed, so the drag knows to resend. */
  eraseAt(x: number, y: number): boolean;
  /** The erase drag ended; resend the page if it actually removed anything. */
  endErase(erased: boolean): void;
  commit(stroke: Stroke): void;
  /** Put a caret on the plane, in a box that is there or a new one. True when
   *  the plane took the tap, which is when the canvas must do nothing. */
  tapText(x: number, y: number): boolean;
  /** The box being dragged out, for the overlay to show. Null clears it. */
  previewText(rect: Bounds | null): void;
  /** Commit a box at exactly the rectangle somebody drew. ADR-078. */
  drawText(rect: Bounds): void;
  /** Put the loaded sticker down, centred here. The engine holds WHICH one, so
   *  this says only where. ADR-115. */
  stampSticker(x: number, y: number): void;
  /** Select the one object under a tap, rather than a loop round it. ADR-084. */
  tapSelect(x: number, y: number): void;
  /** Let go of whatever has the caret. A pen coming down should not leave one
   *  blinking behind it. */
  blurText(): void;
  finishSelect(): void;
  dropSelection(): void;
  dragSelection(x: number, y: number): void;
  scheduleLive(): void;
  /** The camera moved. */
  onView(): void;
};
