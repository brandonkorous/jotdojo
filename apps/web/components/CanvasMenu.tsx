"use client";

import { useRef } from "react";

import {
  ContextMenu, ContextMenuContent, ContextMenuTrigger,
} from "@wizeworks/silicaui-react";
import type { SelectionSummary } from "@/lib/ink-engine";
import { Empty, Selected } from "./CanvasMenuItems";

/**
 * WHERE the menu on the canvas opens. ADR-084.
 *
 * Right-click on a desktop, hold on a phone -- Base UI's ContextMenu carries
 * both, plus roving focus, typeahead and dismissal, which docs/10 requires and
 * which a hand-rolled popup would have had to earn.
 *
 * ANCHORED TO THE OBJECT, NOT THE POINTER. A menu at the touch point on a
 * phone opens under the thumb that summoned it. The selection already knows
 * where it is on the glass, so the menu points at the thing it acts on and the
 * hand is out of the way. Falling back to the pointer only when nothing was
 * hit, because then there is nothing else to point at.
 *
 * NOT A BOTTOM SHEET, which is the other obvious shape. toolbar-side.ts records
 * why the bottom bar was removed: a software keyboard covers the bottom of a
 * phone exactly when somebody is typing, which on this surface is most of the
 * time.
 *
 * WHAT it offers is CanvasMenuItems.tsx.
 */

export type CanvasMenuActions = {
  /** Select whatever is under the pointer, before the menu opens on it. */
  onOpenAt: (clientX: number, clientY: number) => void;
  /** Where the selection is on the glass, or null when nothing is selected. */
  anchorRect: () => DOMRect | null;
  onCard: (fill: string | null) => void;
  onResize: (bigger: boolean) => void;
  onTidy: () => void;
  onExport: () => void;
  onDelete: () => void;
  onTextBoxHere: (clientX: number, clientY: number) => void;
  /** Talk about the one thing that is held. Absent -- and the item hidden --
   *  wherever comments cannot be left. ADR-107. */
  onComment?: () => void;
  /** Draw an arrow FROM the one thing that is held. The next tap on another
   *  object finishes it. ADR-108. */
  onArrowFrom?: () => void;
  onCopy: () => void;
  onDuplicate: () => void;
  onPaste: () => void;
  /** Whether there is anything to paste, so the item is offered rather than
   *  shown greyed -- a menu that lists what it cannot do is noise. ADR-110. */
  canPaste: () => boolean;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
};

export function CanvasMenu({
  selection, actions, children,
}: {
  selection: SelectionSummary;
  actions: CanvasMenuActions;
  children: React.ReactNode;
}) {
  // A ref, not a variable: selecting under the pointer re-renders this
  // component, and a local would be back at the origin by the time the menu
  // asked where to open.
  const at = useRef({ x: 0, y: 0 });

  const anchor = {
    getBoundingClientRect: () =>
      actions.anchorRect() ?? new DOMRect(at.current.x, at.current.y, 0, 0),
  };

  const has = selection.count > 0;

  return (
    <ContextMenu>
      <ContextMenuTrigger
        className="jd-menu-target"
        onContextMenu={(e: React.MouseEvent) => {
          at.current = { x: e.clientX, y: e.clientY };
          actions.onOpenAt(e.clientX, e.clientY);
        }}
        onPointerDown={(e: React.PointerEvent) => {
          // A touch hold never fires contextmenu on every browser, so the
          // position is taken from the press that started it either way.
          at.current = { x: e.clientX, y: e.clientY };
          if (e.pointerType === "touch") actions.onOpenAt(e.clientX, e.clientY);
        }}
      >
        {children}
      </ContextMenuTrigger>

      <ContextMenuContent anchor={anchor} side="right" sideOffset={12}>
        {has ? (
          <Selected selection={selection} actions={actions} />
        ) : (
          <Empty at={() => at.current} actions={actions} />
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

