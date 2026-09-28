"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { CommandPalette } from "@wizeworks/silicaui-react";
import { RemarksButton } from "./RemarksButton";
import { SideRail } from "./SideRail";
import { cornerSide, railSide, type Align } from "@/lib/toolbar-side";
import type { CanvasTool } from "@/lib/canvas-tool";
import { useModKey } from "@/lib/mod-key";
import { useCommandItems } from "@/lib/use-command-items";

/**
 * All of the app's chrome: the tools down one side, and search, remarks and
 * you in the opposite top corner. ADR-120. Positioning is `.jd-chrome` in
 * canvas.css and side-rail.css, never a Tailwind `absolute` -- read why there.
 */
type User = { name?: string | null; image?: string | null; email?: string | null } | null;

export function Chrome({
  align, user, dimmed, tool, onTool, onCamera, onMic, onTextBox, onSticker,
}: {
  align: Align;
  user: User;
  dimmed: boolean;
  tool: CanvasTool;
  onTool: (tool: CanvasTool) => void;
  onCamera: () => void;
  onMic: () => void;
  onTextBox: () => void;
  /** Open the sticker tray. ADR-115. */
  onSticker: () => void;
}) {
  const [open, setOpen] = useState(false);
  const items = useCommandItems(open);

  return (
    <>
      <SideRail
        side={railSide(align)} dimmed={dimmed} tool={tool} onTool={onTool}
        onCamera={onCamera} onMic={onMic} onTextBox={onTextBox} onSticker={onSticker}
      />

      <Corner side={cornerSide(align)} dimmed={dimmed} user={user} onSearch={() => setOpen(true)} />

      <CommandPalette
        items={items}
        open={open}
        onOpenChange={setOpen}
        placeholder="Search notes, or jump somewhere"
        emptyMessage="Hmm — not in your jots."
      />
    </>
  );
}

/** Search, remarks and you, in the top corner opposite the tools. ADR-120. */
function Corner({ side, dimmed, user, onSearch }: {
  side: "left" | "right";
  dimmed: boolean;
  user: User;
  onSearch: () => void;
}) {
  const mod = useModKey();
  return (
    <div data-side={side} data-dimmed={dimmed} className="jd-chrome glass jd-corner">
      <button
        type="button"
        onClick={onSearch}
        aria-label="Search notes and commands"
        title={`Search notes, or jump somewhere  ${mod}K`}
        className="jd-corner-search"
      >
        <Icon name="search" />
        <span className="jd-corner-search-text">Search notes…</span>
        <kbd className="jd-corner-search-key">{mod}K</kbd>
      </button>

      <span aria-hidden className="jd-rail-sep-v" />

      {/* The way back to what an agent said, days after it said it. ADR-061. */}
      <RemarksButton />

      <a href="/account" aria-label="Account" className="jd-tool overflow-hidden">
        {/* A 24px avatar on the provider's own CDN; next/image would need a
            remotePatterns entry per provider to save nothing measurable. */}
        {user?.image
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={user.image} alt="" className="h-6 w-6 rounded-full" />
          : <span aria-hidden className="text-xs font-medium">{initial(user)}</span>}
      </a>
    </div>
  );
}

/** The letter on the account button. Never "?", which next to a toolbar reads
 *  as "help" rather than as "you". */
function initial(user: { name?: string | null; email?: string | null } | null): string {
  const source = user?.name?.trim() || user?.email?.trim() || "";
  return source ? source.slice(0, 1).toUpperCase() : "·";
}
