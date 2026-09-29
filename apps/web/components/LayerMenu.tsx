"use client";

import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@wizeworks/silicaui-react";
import { Icon } from "@/components/Icon";
import type { Reorder } from "@/lib/ink-stack";
import { useModKey } from "@/lib/mod-key";
import { LAYER_MOVES } from "./CanvasMenuItems";

/** Where the selection sits among everything else, from the selection bar.
 *  The same four moves as the canvas menu, with their keys. ADR-136. */
export function LayerMenu({ onReorder }: { onReorder: (how: Reorder) => void }) {
  const mod = useModKey();
  const keys: Record<Reorder, string> = {
    front: `${mod}Shift+]`, forward: `${mod}]`, backward: `${mod}[`, back: `${mod}Shift+[`,
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <button type="button" className="jd-tool" title="Arrange" aria-label="Arrange">
          <Icon name="toFront" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="center" sideOffset={10}>
        {LAYER_MOVES.map(({ how, label, icon }) => (
          <DropdownMenuItem key={how} onClick={() => onReorder(how)}>
            <Icon name={icon} />
            <span className="grow">{label}</span>
            <kbd className="jd-menu-key">{keys[how]}</kbd>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
