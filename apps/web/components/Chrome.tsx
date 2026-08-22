"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CommandPalette } from "@wizeworks/silicaui-react";
import type { CommandItem } from "@wizeworks/silicaui-react";
import type { Align } from "@/lib/toolbar-side";
import type { CanvasTool } from "@/lib/canvas-tool";
import { listNotesAction, createNoteAction } from "@/app/actions";
import { ToolRail } from "./ToolRail";

/**
 * All of the app's chrome: one floating pill, top of the canvas.
 *
 * It was two pills -- a tool rail down one side and a small palette affordance
 * in a corner. With four tools, an avatar and a search box, two pieces of
 * furniture for a handful of controls was one too many, and splitting them put
 * the search where nothing else was.
 *
 * Search leads, because it is the thing people reach for most and because a
 * wide field in the middle of the top edge is where every application has
 * trained them to look. The tools and the avatar sit after it, behind a seam.
 *
 * Two things here are load-bearing and easy to break:
 *
 *  - Positioning comes from `.jd-chrome` in globals.css, NOT from a Tailwind
 *    `absolute` class. Silica's `glass` outranks single-class utilities.
 *  - `.jd-chrome` also sets its own `--u-accent`. `glass` tints from that
 *    variable, and it inherits -- so a `text-base-content` on <body> otherwise
 *    makes the pill tint with the *ink* colour and render as a dark slab with
 *    invisible icons on it.
 *
 * Read the comments on both rules before changing either.
 */
export function Chrome({
  align, user, dimmed, tool, onTool, onCamera, onMic,
}: {
  align: Align;
  user: { name?: string | null; image?: string | null; email?: string | null } | null;
  dimmed: boolean;
  tool: CanvasTool;
  onTool: (tool: CanvasTool) => void;
  onCamera: () => void;
  onMic: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<CommandItem[]>([]);
  const [, startTransition] = useTransition();

  // Preloaded once so filtering is instant with no round trip. When a
  // collection outgrows this, the palette gains a "search everything" command
  // that calls searchNotesAction instead of filtering locally.
  useEffect(() => {
    startTransition(async () => {
      const recent = await listNotesAction();
      setNotes(recent.slice(0, 100).map((n) => ({
        id: n.id,
        label: n.title ?? "Untitled",
        description: n.preview,
        group: "Notes",
        onSelect: () => router.push(`/n/${n.id}`),
      })));
    });
  }, [router]);

  const items: CommandItem[] = [
    {
      id: "new",
      label: "New note",
      group: "Actions",
      shortcut: "\u2318N",
      onSelect: () => startTransition(async () => {
        const { id } = await createNoteAction();
        router.push(`/n/${id}`);
      }),
    },
    { id: "dashboard", label: "Dashboard", group: "Actions", onSelect: () => router.push("/dashboard") },
    { id: "account", label: "Account and capture tokens", group: "Actions", onSelect: () => router.push("/account") },
    ...notes,
  ];

  // `auto` centres it. A stored left/right preference still means what it
  // always meant -- keep the chrome away from the hand holding the pencil --
  // it just moves the one pill along the top edge instead of choosing a side
  // for a rail that no longer exists. ADR-012.
  const pos = {
    auto: "left-1/2 -translate-x-1/2",
    left: "left-3",
    right: "right-3",
  }[align];

  return (
    <>
      <div
        data-dimmed={dimmed}
        className={`jd-chrome glass top-3 z-20 flex items-center gap-1 rounded-full p-1 ${pos}`}
        style={{ width: "min(94vw, 34rem)" }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Search notes and commands"
          className="jd-search"
        >
          <span aria-hidden className="opacity-50">{"⌕"}</span>
          <span className="jd-search-label">Search notes, or jump somewhere</span>
          <kbd aria-hidden className="jd-search-kbd font-mono">{"⌘K"}</kbd>
        </button>

        <span aria-hidden className="jd-rail-sep-v" />

        <ToolRail
          tool={tool}
          onTool={onTool}
          onAction={(id) => (id === "cam" ? onCamera() : onMic())}
        />

        <span aria-hidden className="jd-rail-sep-v" />

        <a href="/account" aria-label="Account" className="jd-tool overflow-hidden">
          {user?.image
            ? <img src={user.image} alt="" className="h-6 w-6 rounded-full" />
            : <span aria-hidden className="text-xs font-medium">{initial(user)}</span>}
        </a>
      </div>

      <CommandPalette
        items={items}
        open={open}
        onOpenChange={setOpen}
        placeholder="Search notes, or jump somewhere"
        emptyMessage="Nothing matches that yet."
      />
    </>
  );
}

/**
 * The letter on the account button.
 *
 * A Google account without a display name, or a sign-in that only knows an
 * address, used to land on a literal "?" -- which on a round button next to a
 * toolbar reads as "help", not as "you".
 */
function initial(user: { name?: string | null; email?: string | null } | null): string {
  const source = user?.name?.trim() || user?.email?.trim() || "";
  return source ? source.slice(0, 1).toUpperCase() : "·";
}
