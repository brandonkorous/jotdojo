"use client";

import { useEffect, type RefObject } from "react";
import type { ImageOnPage, Stroke, TextBox } from "@jotacular/domain";
import { InkEngine, type SelectionSummary, type Tool } from "./ink-engine";
import { InkSync, type SyncState } from "./ink-sync";
import { InkCatchup } from "./ink-catchup";
import type { InkStyle } from "./ink-style";
import { inkLayerAction, getInkAction } from "@/app/actions";
import { photoUrlAction, noteImagesAction } from "@/app/actions/media";

/**
 * Standing the engine up, and taking it down again.
 *
 * Split out of InkCanvas.tsx at the size limit, and the seam is a real one: the
 * component is refs, a little state and some markup, while this is the one
 * genuinely intricate thing it used to also be -- an async mount with a
 * disposal race, a resize observer, and a teardown that must FLUSH before it
 * frees, because whatever is queued exists nowhere else.
 */

/** Filled by the mount, read by everything else in the component. */
export type EngineRefs = {
  engine: RefObject<InkEngine | null>;
  sync: RefObject<InkSync | null>;
  catchup: RefObject<InkCatchup | null>;
};

export type Surfaces = {
  committed: RefObject<HTMLCanvasElement | null>;
  live: RefObject<HTMLCanvasElement | null>;
  shell: RefObject<HTMLDivElement | null>;
  grid: RefObject<HTMLDivElement | null>;
  plane: RefObject<HTMLDivElement | null>;
  /** The whole canvas shell, so the camera can be moved on every tool -- the
   *  ink surface is pointer-transparent while somebody types. ADR-102. */
  outer?: RefObject<HTMLElement | null>;
};

export type MountOptions = {
  noteId: string;
  surfaces: Surfaces;
  held: EngineRefs;
  /** Read ONCE, at mount. Later changes are pushed imperatively by the caller,
   *  so changing a pen does not rebuild the engine and lose the page. */
  initial: { tool: Tool; style: InkStyle; textReachable: boolean };
  onState: (state: SyncState) => void;
  onSelection: (selection: SelectionSummary) => void;
  onView: (view: { k: number; home: boolean }) => void;
  onError: (message: string) => void;
  /** Whether this is a signed-in person's note rather than the hero's anonymous
   *  draft. Gates the one query a draft can never have an answer to. */
  owned?: boolean;
  onBlock: (blockId: string) => void;
  /** In refs at the call site, because the engine is built once and these
   *  change per render. */
  onDraw: RefObject<(() => void) | undefined>;
  onTextPlaced: RefObject<(() => void) | undefined>;
  onReady: RefObject<((blockId: string) => void) | undefined>;
};

export function useInkEngine(o: MountOptions) {
  const { noteId, surfaces, held, initial } = o;

  useEffect(() => {
    const committed = surfaces.committed.current;
    const liveCanvas = surfaces.live.current;
    const shell = surfaces.shell.current;
    const grid = surfaces.grid.current;
    const plane = surfaces.plane.current;
    if (!committed || !liveCanvas || !shell || !grid || !plane) return;

    let disposed = false;
    let engine: InkEngine | null = null;
    let sync: InkSync | null = null;
    let observer: ResizeObserver | null = null;

    (async () => {
      const rect = shell.getBoundingClientRect();
      const canvas = { w: Math.round(rect.width), h: Math.round(rect.height) };

      let block: Awaited<ReturnType<typeof inkLayerAction>>;
      try {
        block = await inkLayerAction(noteId, canvas);
      } catch (err) {
        o.onError((err as Error).message);
        return;
      }
      if (disposed) return;

      sync = new InkSync(block.blockId, o.onState, {
        count: block.strokeCount, version: block.version,
      });
      engine = new InkEngine({
        committed,
        live: liveCanvas,
        grid,
        plane,
        gestures: surfaces.outer?.current ?? undefined,
        // Signed on demand and never stored in the page. ADR-103.
        imageSrc: photoUrlAction,
        onStrokes: (strokes) => { sync!.push(strokes); o.onDraw.current?.(); },
        onDelta: (delta) => sync!.delta(delta),
        onSelectionChange: o.onSelection,
        onTextPlaced: () => o.onTextPlaced.current?.(),
        onView: (k, home) => o.onView({ k, home }),
      });
      engine.setTool(initial.tool);
      // Here as well as in the caller's effect: the mount is async, so that
      // effect has already run against a null ref by the time we get here, and
      // the page opens on the text tool with every note unclickable. ADR-085.
      engine.setTextReachable(initial.textReachable);
      engine.setStyle(initial.style);
      engine.resize(canvas.w, canvas.h);

      // A block created a moment ago is empty, but a reload of an existing one
      // is not -- and loading after resize matters, because resize repaints.
      //
      // Strokes OR text OR photographs: a note that is nothing but one photo
      // has a stroke count of zero and still has a page to load. ADR-065,
      // ADR-103.
      if (block.strokeCount > 0 || block.hasText || block.hasImages) {
        const existing = await getInkAction(block.blockId);
        if (!disposed) {
          engine.load(
            existing.document.strokes as Stroke[],
            (existing.document.texts ?? []) as TextBox[],
            (existing.document.images ?? []) as ImageOnPage[],
          );
        }
      }

      // Photographs taken before placements existed have a row and nowhere to
      // be. Asked AFTER the page loads, so a picture that already has a home is
      // recognised and left where somebody put it. ADR-103.
      //
      // Only on a real note. The marketing hero draws on an anonymous draft
      // that cannot have photographs, and asking would be an authenticated
      // round trip on every visit to the front page -- the same reason the live
      // subscription is off by default there.
      if (o.owned) {
        const known = await noteImagesAction(noteId);
        if (disposed) return;
        if (known.length > 0) engine.adoptImages(known);
      }

      observer = new ResizeObserver(([entry]) => {
        if (!entry || !engine) return;
        engine.resize(Math.round(entry.contentRect.width), Math.round(entry.contentRect.height));
      });
      observer.observe(shell);

      held.engine.current = engine;
      held.sync.current = sync;
      held.catchup.current = new InkCatchup(block.blockId, sync, engine);
      o.onBlock(block.blockId);
      o.onReady.current?.(block.blockId);
    })();

    return () => {
      disposed = true;
      observer?.disconnect();
      // Flush before tearing down. Whatever is queued exists nowhere else.
      void sync?.flush();
      sync?.destroy();
      engine?.destroy();
      held.engine.current = null;
      held.sync.current = null;
      held.catchup.current = null;
    };
    // noteId only: tool and colour are pushed imperatively by the caller so
    // that changing a pen does not rebuild the engine and lose the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);
}
