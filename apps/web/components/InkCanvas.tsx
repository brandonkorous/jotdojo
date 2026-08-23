"use client";

import { useEffect, useRef, useState } from "react";
import type { InkEngine, SelectionSummary, Tool } from "@/lib/ink-engine";
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
}: {
  noteId: string;
  tool: Tool;
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
}) {
  const committedRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  /** The object plane. Outside the canvases, because scaling a canvas through
   *  a transformed ancestor blurs its bitmap. ADR-065. */
  const planeRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<InkEngine | null>(null);
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

  const [state, setState] = useState<SyncState>("idle");
  const [selected, setSelected] = useState<SelectionSummary>(NO_SELECTION);
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
      grid: gridRef, plane: planeRef,
    },
    held: { engine: engineRef, sync: syncRef, catchup: catchupRef },
    initial: { tool, style },
    onState: setState,
    onSelection: setSelected,
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
      engineRef.current?.deleteSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected.count]);

  useInkTrouble(state, error);

  useEffect(() => { engineRef.current?.setTool(tool); }, [tool]);
  useEffect(() => { engineRef.current?.setStyle(style); }, [style]);

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
        onColor={(color) => engineRef.current?.restyleSelection({ color })}
        onWidth={(width) => engineRef.current?.restyleSelection({ width }, false)}
        onCommitWidth={(width) => engineRef.current?.restyleSelection({ width })}
        onDelete={() => engineRef.current?.deleteSelection()}
        onExport={() => void downloadSelection(noteId, selected.ids)}
      />
      <ZoomChip
        zoom={view.k}
        home={view.home}
        onFit={() => engineRef.current?.fitToContent()}
      />
    </div>
  );
}
