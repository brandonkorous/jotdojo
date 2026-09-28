"use client";

import type { RefObject } from "react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
} from "@wizeworks/silicaui-react";
import { Icon } from "@/components/Icon";
import type { Side } from "@/lib/toolbar-side";
import type { CanvasTool } from "@/lib/canvas-tool";

/**
 * The second choice behind the Select button: pick things up, or move the
 * page. It pops out beside the button, as the add menu does, so the eye does
 * not travel. Tapping the Select button already in hand opens it. ADR-123.
 */
export function SelectOrPan({ open, onOpenChange, anchor, side, onTool }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The rail, whose Select button the menu is pinned to. */
  anchor: RefObject<HTMLElement | null>;
  side: Side;
  onTool: (tool: CanvasTool) => void;
}) {
  const button = () => anchor.current?.querySelector<HTMLElement>("[data-mode=select]") ?? null;
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuContent
        anchor={button}
        side={side === "left" ? "right" : "left"}
        align="center"
        sideOffset={10}
      >
        <DropdownMenuItem onClick={() => onTool("select")}>
          <Icon name="select" />
          Select
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onTool("pan")}>
          <Icon name="pan" />
          Pan
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
