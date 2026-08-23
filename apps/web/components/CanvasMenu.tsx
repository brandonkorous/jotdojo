"use client";

import { useRef } from "react";

import {
  ContextMenu, ContextMenuContent, ContextMenuItem,
  ContextMenuSeparator, ContextMenuTrigger,
} from "@wizeworks/silicaui-react";
import { Download, Minus, Plus, Sparkles, Trash2, Type } from "lucide-react";
import { CARD_COLORS } from "@/lib/ink-cards";
import type { SelectionSummary } from "@/lib/ink-engine";
import type { ShapeKind } from "@/lib/ink-shapes";

/**
 * The menu on the canvas. ADR-084.
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
 */

const SHAPE_NAME: Record<ShapeKind, string> = {
  line: "a straight line",
  circle: "a circle",
  rectangle: "a rectangle",
  triangle: "a triangle",
};

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

/** What a caught object can be asked. */
function Selected({
  selection, actions,
}: { selection: SelectionSummary; actions: CanvasMenuActions }) {
  return (
    <>
      {/* The offer ADR-066 could only make in the moment. A person who lifted
          the pen and only then wished the circle were round had no way back
          until now -- and the classifier still has to be sure, so most strokes
          never see this line at all. */}
      {selection.shape && (
        <>
          <ContextMenuItem onClick={actions.onTidy}>
            <Sparkles aria-hidden strokeWidth={1.75} />
            Make this {SHAPE_NAME[selection.shape]}
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}

      {selection.texts > 0 && (
        <>
          <div role="group" aria-label="Card colour" className="jd-menu-swatches">
            {CARD_COLORS.map(({ name, fill }) => (
              <button
                key={name}
                type="button"
                className="jd-tool jd-swatch"
                title={fill ? `${name} card` : "No card"}
                aria-label={fill ? `${name} card` : "No card"}
                onClick={() => actions.onCard(fill)}
              >
                <span
                  aria-hidden
                  className={fill ? "jd-chip" : "jd-chip jd-chip-none"}
                  style={fill ? { background: fill } : undefined}
                />
              </button>
            ))}
          </div>
          <ContextMenuSeparator />
        </>
      )}

      <ContextMenuItem onClick={() => actions.onResize(true)}>
        <Plus aria-hidden strokeWidth={1.75} />
        Bigger
      </ContextMenuItem>
      <ContextMenuItem onClick={() => actions.onResize(false)}>
        <Minus aria-hidden strokeWidth={1.75} />
        Smaller
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem onClick={actions.onExport}>
        <Download aria-hidden strokeWidth={1.75} />
        Save as an image
      </ContextMenuItem>
      <ContextMenuItem onClick={actions.onDelete}>
        <Trash2 aria-hidden strokeWidth={1.75} />
        Delete
      </ContextMenuItem>
    </>
  );
}

/**
 * Bare canvas. One thing, and no filler.
 *
 * "Fit everything on screen" was here and came out: the zoom chip in the corner
 * already does it and is always visible, so the menu was offering a second door
 * to a room nobody had trouble finding. A menu that pads itself out is a menu
 * people stop reading.
 */
function Empty({
  at, actions,
}: { at: () => { x: number; y: number }; actions: CanvasMenuActions }) {
  return (
    <ContextMenuItem onClick={() => { const p = at(); actions.onTextBoxHere(p.x, p.y); }}>
      <Type aria-hidden strokeWidth={1.75} />
      Put a note here
    </ContextMenuItem>
  );
}
