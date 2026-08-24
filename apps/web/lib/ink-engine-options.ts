import type { InkDelta, Stroke } from "@jotacular/domain";
import type { SelectionSummary } from "./ink-selection";

/**
 * What React promises the engine, and what the engine promises back.
 *
 * Split from ink-engine.ts at the size limit, and it is the seam the file was
 * already drawn along: `InputHost` in ink-input.ts is the same idea one layer
 * down -- a narrow contract between an imperative island and the thing that
 * mounted it. The engine is a state machine; this is the shape of the wire
 * into it, and the two change for different reasons.
 */
export type EngineOptions = {
  committed: HTMLCanvasElement;
  live: HTMLCanvasElement;
  /** Called when strokes are added, so the sync layer can queue them. */
  onStrokes: (strokes: Stroke[], firstIndex: number) => void;
  /**
   * Erase, move, recolour and delete all change the middle of the page, which
   * the append protocol cannot express. They are sent as a delta naming the
   * strokes involved -- never as a fresh copy of the whole page, which would
   * discard whatever another device drew in the meantime. ADR-058.
   */
  onDelta: (delta: InkDelta) => void;
  /** What is selected, so the UI can offer the right things to do with it.
   *  The kinds matter: a marker recoloured to ink is the grey smear ADR-045
   *  exists to prevent, so its own palette has to be reachable. */
  onSelectionChange?: (selection: SelectionSummary) => void;
  /** The dot grid. Painted through CSS variables inside the frame loop, so it
   *  moves with the ink rather than a frame behind it. */
  grid?: HTMLElement;
  /** Fired ONLY when the zoom changes or the camera leaves or returns to home.
   *  Panning around out there re-renders nothing. */
  onView?: (k: number, home: boolean) => void;
  /** A box was placed. The tool goes back to the spine straight away: placing
   *  one is a one-shot, not a mode somebody has to remember to leave. */
  onTextPlaced?: () => void;
  /** The object plane: typed text on the same surface. OUTSIDE the canvases,
   *  because scaling a canvas through a transformed ancestor blurs it. Omit it
   *  and the engine is exactly what it was before ADR-065. */
  plane?: HTMLElement;
  /**
   * Where a photograph's bytes are, signed on demand. ADR-103.
   *
   * A function rather than a URL map: the links are time-limited, the canvas
   * may hold a page for an afternoon, and the plane asks once per block rather
   * than once per frame.
   */
  imageSrc?: (blockId: string) => Promise<string | null>;
  /**
   * The whole canvas shell, for camera gestures. ADR-102.
   *
   * The camera listens HERE rather than on the drawing surface, because the
   * drawing surface takes no pointers while somebody is typing -- so before
   * this, a page could not be panned or pinched on the tool it opens with.
   * Omit it and the camera is fenced to the ink tools, as it was.
   */
  gestures?: HTMLElement;
};
