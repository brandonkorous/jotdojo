"use client";

import {
  ContextMenuItem, ContextMenuSeparator,
} from "@wizeworks/silicaui-react";
import { Icon } from "@/components/Icon";
import { CARD_COLORS } from "@/lib/ink-cards";
import type { SelectionSummary } from "@/lib/ink-engine";
import type { ShapeKind } from "@/lib/ink-shapes";
import type { CanvasMenuActions } from "./CanvasMenu";

/**
 * What the canvas menu OFFERS. ADR-084, ADR-108, ADR-109, ADR-110.
 *
 * Split from CanvasMenu.tsx when arrows, undo and the clipboard took that file
 * past its size limit. The seam is a real one: the menu itself is about WHERE
 * it opens -- the trigger, the anchor, the hand that is in the way -- and this
 * is about what is on it, which changes every time the canvas learns a verb.
 */

const SHAPE_NAME: Record<ShapeKind, string> = {
  line: "a straight line",
  circle: "a circle",
  rectangle: "a rectangle",
  triangle: "a triangle",
};

/** What a caught object can be asked. */
export function Selected({
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
            <Icon name="agent" />
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

      {/* Only ever ONE thing. "These four squiggles and that photo" is not
          something a person means, and a comment that pointed at five objects
          could not be drawn beside any of them. ADR-107. And an arrow leaves
          ONE thing for the same reason. ADR-108. */}
      {selection.count === 1 && (actions.onComment || actions.onArrowFrom) && (
        <>
          {actions.onArrowFrom && (
            <ContextMenuItem onClick={actions.onArrowFrom}>
              <Icon name="arrow" />
              Draw an arrow from this
            </ContextMenuItem>
          )}
          {actions.onComment && (
            <ContextMenuItem onClick={actions.onComment}>
              <Icon name="remarks" />
              Comment on this
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
        </>
      )}

      <ContextMenuItem onClick={actions.onDuplicate}>
        <Icon name="duplicate" />
        Make another one
      </ContextMenuItem>
      <ContextMenuItem onClick={actions.onCopy}>
        <Icon name="copy" />
        Copy
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem onClick={() => actions.onResize(true)}>
        <Icon name="zoomIn" />
        Bigger
      </ContextMenuItem>
      <ContextMenuItem onClick={() => actions.onResize(false)}>
        <Icon name="zoomOut" />
        Smaller
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem onClick={actions.onExport}>
        <Icon name="download" />
        Save as an image
      </ContextMenuItem>
      <ContextMenuItem onClick={actions.onDelete}>
        <Icon name="remove" />
        Delete
      </ContextMenuItem>
    </>
  );
}

/**
 * Bare canvas. What can be done to a page rather than to a thing on it.
 *
 * "Fit everything on screen" was here and came out: the zoom chip in the corner
 * already does it and is always visible, so the menu was offering a second door
 * to a room nobody had trouble finding. A menu that pads itself out is a menu
 * people stop reading.
 *
 * Undo and paste earn their place on a different ground: a phone has no Ctrl
 * key, and without this there is no way to reach either of them at all.
 * ADR-109, ADR-110.
 */
export function Empty({
  at, actions,
}: { at: () => { x: number; y: number }; actions: CanvasMenuActions }) {
  const back = actions.canUndo();
  const forward = actions.canRedo();
  return (
    <>
      <ContextMenuItem onClick={() => { const p = at(); actions.onTextBoxHere(p.x, p.y); }}>
        <Icon name="text" />
        Put a note here
      </ContextMenuItem>
      {actions.canPaste() && (
        <ContextMenuItem onClick={actions.onPaste}>
          <Icon name="paste" />
          Paste
        </ContextMenuItem>
      )}
      {(back || forward) && <ContextMenuSeparator />}
      {back && (
        <ContextMenuItem onClick={actions.onUndo}>
          <Icon name="undo" />
          Undo
        </ContextMenuItem>
      )}
      {forward && (
        <ContextMenuItem onClick={actions.onRedo}>
          <Icon name="redo" />
          Redo
        </ContextMenuItem>
      )}
    </>
  );
}
