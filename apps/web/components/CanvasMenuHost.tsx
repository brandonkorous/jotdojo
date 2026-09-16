"use client";

import { useState, type RefObject } from "react";
import type { InkEngine, SelectionSummary } from "@/lib/ink-engine";
import { downloadSelection } from "@/lib/export-client";
import { bringIntoView } from "@/lib/remark-anchor";
import { useRemarks } from "@/lib/remarks";
import { CanvasMenu } from "./CanvasMenu";
import { StickerTray } from "./StickerTray";

/**
 * The canvas menu, wired to an engine, wrapping a whole page. ADR-102.
 *
 * It used to live inside InkCanvas and wrap the drawing surface, which meant it
 * only existed where the drawing surface took pointers -- so on the tool the
 * app OPENS with there was no menu at all, and on a note nobody had drawn on
 * yet there was no menu to have. Both are the same bug seen from two angles.
 *
 * Wrapping the shell instead puts the trigger above the typing spine as well as
 * the ink, so a hold anywhere on the page means the same thing. A textarea
 * still keeps its own hold -- that is the system's text-selection gesture and
 * it is the right one there -- by stopping the event where it starts.
 */
export function CanvasMenuHost({
  noteId, engine, selection, children,
}: {
  noteId: string;
  /** Filled by InkCanvas's async mount, so it is null for the first moments of
   *  a page. Every action reads it at the point of use for that reason. */
  engine: RefObject<InkEngine | null>;
  selection: SelectionSummary;
  children: React.ReactNode;
}) {
  const at = () => engine.current;
  const remarks = useRemarks();
  /** The tray lives HERE rather than in Canvas.tsx, because this is already
   *  the thing that holds the engine and every verb the canvas offers. */
  const [tray, setTray] = useState(false);

  /** One object, so the id IS the selection. The camera brings it to the
   *  middle first, because the popup opens beside it. ADR-107. */
  const comment = () => {
    const id = selection.ids[0];
    const held = at();
    if (!id || !held || !remarks) return;
    bringIntoView(held, id);
    held.dropSelection();
    remarks.openThread(id);
  };

  /** One object again, and for the same reason: an arrow leaves exactly one
   *  thing. The selection is dropped so the next tap is the far end. ADR-108. */
  const arrow = () => {
    const id = selection.ids[0];
    const held = at();
    if (!id || !held) return;
    held.dropSelection();
    held.aimFrom(id);
  };

  return (
    <>
      <CanvasMenu
        selection={selection}
        actions={{
          onOpenAt: (x, y) => at()?.selectAtClient(x, y),
          anchorRect: () => at()?.marqueeRect() ?? null,
          onCard: (fill) => at()?.selection.recolourCards(fill),
          onSticker: () => setTray(true),
          onStickerColour: (color) => at()?.selection.recolourStickers(color),
          onResize: (bigger) => at()?.selection.resize(bigger),
          onTidy: () => at()?.selection.tidyShape(),
          onExport: () => void downloadSelection(noteId, selection.ids),
          onDelete: () => at()?.selection.remove(),
          onTextBoxHere: (x, y) => at()?.textAtClient(x, y),
          onComment: remarks ? comment : undefined,
          // Only where there is an object plane to tie an arrow to. ADR-108.
          onArrowFrom: at()?.links ? arrow : undefined,
          onCopy: () => { at()?.doc.copy(); },
          onDuplicate: () => { at()?.doc.duplicate(); },
          onPaste: () => { at()?.doc.paste(); },
          canPaste: () => at()?.doc.canPaste ?? false,
          onUndo: () => { at()?.doc.undo(); },
          onRedo: () => { at()?.doc.redo(); },
          canUndo: () => at()?.doc.canUndo ?? false,
          canRedo: () => at()?.doc.canRedo ?? false,
        }}
      >
        {children}
      </CanvasMenu>
      {/* OUTSIDE the menu, not inside its trigger: a right-click on the tray
          would otherwise open the canvas menu on top of it. */}
      <StickerTray
        open={tray}
        onClose={() => setTray(false)}
        onPick={(name, color) => at()?.open.placeSticker(name, color)}
      />
    </>
  );
}
