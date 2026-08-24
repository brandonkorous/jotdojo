"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { InkEngine, SelectionSummary } from "@/lib/ink-engine";
import { canReachText, inkToolFor, type CanvasTool } from "@/lib/canvas-tool";
import { NO_SELECTION } from "@/lib/ink-selection";
import type { InkSync, SyncState } from "@/lib/ink-sync";
import type { InkCatchup } from "@/lib/ink-catchup";
import { useLiveNote } from "@/lib/use-live";
import { useInkTrouble } from "@/lib/use-ink-feed";
import { downloadSelection } from "@/lib/export-client";
import type { InkStyle } from "@/lib/ink-style";
import { useInkEngine } from "@/lib/use-ink-engine";
import { SelectionBar } from "./SelectionBar";
import { ZoomChip } from "./ZoomChip";

/**
 * React's entire involvement with ink.
 *
 * It mounts two canvases, hands them to the engine, and then does nothing per
 * stroke. State updates here happen on mount, on tool change, and when the sync
 * status changes -- never on pointermove. docs/08-ink.md is explicit that
 * touching component state in the stroke hot path destroys the feel, and it is
 * right: at pen sample rates a re-render per move is a re-render every few
 * milliseconds.
 */

export function InkCanvas({
  noteId, tool, style, onReady, onDraw, onTextPlaced, live = false,
  outer, held, onSelection,
}: {
  noteId: string;
  /**
   * The tool the PERSON picked, spine included.
   *
   * Not the engine's narrower `InkTool`. The engine has no concept of the
   * spine, but the plane needs one -- so the collapse happens here, where both
   * answers can still be taken from the same source. ADR-085.
   */
  tool: CanvasTool;
  /** Colour and width for THIS tool. Held per tool by the caller. ADR-045. */
  style: InkStyle;
  onReady?: (blockId: string) => void;
  /** A text box was placed, so the caller can hand the tool back to the spine. */
  onTextPlaced?: () => void;
  /** Somebody is drawing here, for presence. Called per finished stroke, never
   *  per pointer sample -- the hot path stays out of React. ADR-058. */
  onDraw?: () => void;
  /**
   * Whether to watch for changes from elsewhere. OFF by default, deliberately.
   *
   * The marketing hero draws on an anonymous draft, which is one device by
   * construction -- its cookie is host-only and httpOnly. Subscribing there
   * would open a stream that answers 401 and then retry it six times on every
   * visit. A component that has not said it wants this does not get it.
   */
  live?: boolean;
  /**
   * The whole canvas shell, so the camera can be moved on EVERY tool. The ink
   * surface takes no pointers while somebody is typing, so a camera listening
   * only there is a camera the spine can never reach. ADR-102.
   */
  outer?: RefObject<HTMLElement | null>;
  /** The caller's handle on the engine, for furniture it hangs outside this
   *  component -- the canvas menu wraps the whole page now. ADR-102. */
  held?: RefObject<InkEngine | null>;
  onSelection?: (selection: SelectionSummary) => void;
}) {
  const committedRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  /** The object plane. Outside the canvases, because scaling a canvas through
   *  a transformed ancestor blurs its bitmap. ADR-065. */
  const planeRef = useRef<HTMLDivElement>(null);
  const ownEngine = useRef<InkEngine | null>(null);
  // A ref either way, so it is stable for the whole life of the component --
  // the effects below list it because the linter cannot see that, not because
  // any of them would ever run again on its account.
  const engineRef = held ?? ownEngine;
  const syncRef = useRef<InkSync | null>(null);
  const catchupRef = useRef<InkCatchup | null>(null);
  /** In a ref, because the engine is built once and this changes per render. */
  const draw = useRef(onDraw);
  draw.current = onDraw;
  /** In a ref for the same reason `draw` is: the engine is built once. */
  const placed = useRef(onTextPlaced);
  placed.current = onTextPlaced;
  const ready = useRef(onReady);
  ready.current = onReady;

  const ink = inkToolFor(tool);
  const reachable = canReachText(tool);

  const [state, setState] = useState<SyncState>("idle");
  const [selected, setSelected] = useState<SelectionSummary>(NO_SELECTION);
  /** In a ref for the same reason `draw` is: the engine is built once. */
  const told = useRef(onSelection);
  told.current = onSelection;
  const [error, setError] = useState<string | null>(null);
  /** Only ever set from the engine's `onView`, which stays silent on a pan. */
  const [view, setView] = useState({ k: 1, home: true });
  /** Held in state as well as in a ref, because the live subscription below is
   *  a hook and cannot read a ref that was filled after mount. */
  const [blockId, setBlockId] = useState<string | null>(null);

  /**
   * Somebody else's strokes. ADR-058.
   *
   * The event says only how far the page has got; the catch-up decides whether
   * that means "ask for the tail" or "read it whole", and merges the result
   * with anything still queued here.
   */
  useLiveNote(live && blockId ? noteId : null, {
    onInk: (event) => {
      if (event.blockId !== blockId) return;
      void catchupRef.current?.check({ count: event.strokeCount, version: event.version });
    },
    // A reconnect means events were missed by definition -- NOTIFY has no
    // durability -- so the page is checked against the server rather than
    // assumed to be current.
    onResync: () => { void catchupRef.current?.check(); },
  });

  useInkEngine({
    noteId,
    surfaces: {
      committed: committedRef, live: liveRef, shell: shellRef,
      grid: gridRef, plane: planeRef, outer,
    },
    held: { engine: engineRef, sync: syncRef, catchup: catchupRef },
    initial: { tool: ink, style, textReachable: reachable },
    owned: live,
    onState: setState,
    onSelection: (next) => { setSelected(next); told.current?.(next); },
    onView: setView,
    onError: setError,
    onBlock: setBlockId,
    onDraw: draw,
    onTextPlaced: placed,
    onReady: ready,
  });

  /**
   * Delete and Backspace remove a lasso selection.
   *
   * Bound on the window, not the canvas: a canvas is not focusable, and giving
   * the drawing surface a tabindex would put a focus ring around the page every
   * time someone picked up the pen.
   */
  useEffect(() => {
    if (selected.count === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const el = document.activeElement;
      // Never steal Backspace from something being typed into.
      if (el instanceof HTMLElement
        && (el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      e.preventDefault();
      engineRef.current?.selection.remove();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected.count, engineRef]);

  useInkTrouble(state, error);

  useEffect(() => { engineRef.current?.setTool(ink); }, [ink, engineRef]);
  useEffect(() => { engineRef.current?.setTextReachable(reachable); }, [reachable, engineRef]);
  useEffect(() => { engineRef.current?.setStyle(style); }, [style, engineRef]);

  /**
   * The last line of defence for unsaved strokes.
   *
   * `pagehide` is the only event iOS Safari reliably fires when a tab is
   * backgrounded or the app is swiped away; `beforeunload` is not delivered
   * there. `visibilitychange` catches the more common case of switching apps.
   */
  useEffect(() => {
    const flush = () => { void syncRef.current?.flush(); };
    const onVisible = () => {
      if (document.visibilityState === "hidden") return flush();
      // A phone that was asleep may have had its stream suspended without ever
      // reporting an error, so coming back is treated as a gap.
      void catchupRef.current?.check();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const engine = () => engineRef.current;

  return (
    <div ref={shellRef} className="jd-ink-shell">
      <div ref={gridRef} className="jd-ink-grid" aria-hidden />
      {/* Between the grid and the canvases in the DOM, and BELOW the live
          canvas in z-order, so a highlighter drawn over a typed line reads the
          way it does on paper. */}
      <div ref={planeRef} className="jd-object-plane" />
      <canvas ref={committedRef} className="jd-ink-layer" aria-hidden />
      <canvas
        ref={liveRef}
        className="jd-ink-layer jd-ink-live"
        role="img"
        aria-label="Handwriting canvas"
      />
      <SelectionBar
        selection={selected}
        onColor={(color) => engine()?.selection.restyle({ color })}
        onWidth={(width) => engine()?.selection.restyle({ width }, false)}
        onCommitWidth={(width) => engine()?.selection.restyle({ width })}
        onCard={(fill) => engine()?.selection.recolourCards(fill)}
        onDelete={() => engine()?.selection.remove()}
        onExport={() => void downloadSelection(noteId, selected.ids)}
      />
      <ZoomChip
        zoom={view.k}
        home={view.home}
        onFit={() => engine()?.fitToContent()}
      />
    </div>
  );
}
