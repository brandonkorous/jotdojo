"use client";

import { useEffect, useRef, useState } from "react";
import type { Stroke } from "@jotdojo/domain";
import { InkEngine, type SelectionSummary, type Tool } from "@/lib/ink-engine";
import { InkSync, type SyncState } from "@/lib/ink-sync";
import type { InkStyle } from "@/lib/ink-style";
import { inkLayerAction, getInkAction } from "@/app/actions";
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
const NO_SELECTION: SelectionSummary = { count: 0, pen: false, marker: false };

export function InkCanvas({
  noteId, tool, style, onReady,
}: {
  noteId: string;
  tool: Tool;
  /** Colour and width for THIS tool. Held per tool by the caller. ADR-045. */
  style: InkStyle;
  onReady?: (blockId: string) => void;
}) {
  const committedRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<InkEngine | null>(null);
  const syncRef = useRef<InkSync | null>(null);

  const [state, setState] = useState<SyncState>("idle");
  const [selected, setSelected] = useState<SelectionSummary>(NO_SELECTION);
  const [error, setError] = useState<string | null>(null);
  /** Only ever set from the engine's `onView`, which stays silent on a pan. */
  const [view, setView] = useState({ k: 1, home: true });

  useEffect(() => {
    const committed = committedRef.current;
    const live = liveRef.current;
    const shell = shellRef.current;
    const grid = gridRef.current;
    if (!committed || !live || !shell || !grid) return;

    let disposed = false;
    let engine: InkEngine | null = null;
    let sync: InkSync | null = null;
    let observer: ResizeObserver | null = null;

    (async () => {
      const rect = shell.getBoundingClientRect();
      const canvas = { w: Math.round(rect.width), h: Math.round(rect.height) };

      let block: { blockId: string; strokeCount: number };
      try {
        block = await inkLayerAction(noteId, canvas);
      } catch (err) {
        setError((err as Error).message);
        return;
      }
      if (disposed) return;

      sync = new InkSync(block.blockId, setState, block.strokeCount);
      engine = new InkEngine({
        committed,
        live,
        grid,
        onStrokes: (strokes) => sync!.push(strokes),
        onReplace: (all: Stroke[]) => sync!.replace(all),
        onSelectionChange: setSelected,
        onView: (k, home) => setView({ k, home }),
      });
      engine.setTool(tool);
      engine.setStyle(style);
      engine.resize(canvas.w, canvas.h);

      // A block created a moment ago is empty, but a reload of an existing one
      // is not -- and loading after resize matters, because resize repaints.
      if (block.strokeCount > 0) {
        const existing = await getInkAction(block.blockId);
        if (!disposed) engine.load(existing.document.strokes as Stroke[]);
      }

      observer = new ResizeObserver(([entry]) => {
        if (!entry || !engine) return;
        engine.resize(Math.round(entry.contentRect.width), Math.round(entry.contentRect.height));
      });
      observer.observe(shell);

      engineRef.current = engine;
      syncRef.current = sync;
      onReady?.(block.blockId);
    })();

    return () => {
      disposed = true;
      observer?.disconnect();
      // Flush before tearing down. Whatever is queued exists nowhere else.
      void sync?.flush();
      sync?.destroy();
      engine?.destroy();
      engineRef.current = null;
      syncRef.current = null;
    };
    // noteId only: tool and colour are pushed imperatively below so that
    // changing a pen does not rebuild the engine and lose the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

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
    const onHidden = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, []);

  return (
    <div ref={shellRef} className="jd-ink-shell">
      <div ref={gridRef} className="jd-ink-grid" aria-hidden />
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
        onWidth={(width) => engineRef.current?.restyleSelection({ width })}
        onDelete={() => engineRef.current?.deleteSelection()}
      />
      <ZoomChip
        zoom={view.k}
        home={view.home}
        onFit={() => engineRef.current?.fitToContent()}
      />
      {(state !== "idle" || error) && (
        <p role="status" aria-live="polite" className="jd-chrome jd-ink-status">
          {error
            ? `Ink could not start: ${error}`
            : state === "retrying"
              ? "Strokes are safe here and will retry."
              : "Saving ink\u2026"}
        </p>
      )}
    </div>
  );
}
