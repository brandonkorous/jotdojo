"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CommandItem } from "@wizeworks/silicaui-react";
import { listNotesAction, createNoteAction } from "@/app/actions";
import { useModKey } from "@/lib/mod-key";
import { applyTheme, pageIsDark, rememberTheme, type ThemeChoice } from "@/lib/theme";

/** What the search palette offers: a handful of places to go, then the notes. */
export function useCommandItems(open: boolean): CommandItem[] {
  const router = useRouter();
  const mod = useModKey();
  const notes = useRecentNotes(open);
  const [, startTransition] = useTransition();

  // What is ON SCREEN, not what was chosen: `auto` on a dark machine is a dark
  // page with nothing stored. Read after mount; the server has no theme.
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(pageIsDark()); }, []);
  const nextTheme: ThemeChoice = dark ? "paper" : "paper-night";

  return [
    {
      id: "new",
      label: "New note",
      group: "Actions",
      shortcut: `${mod}N`,
      onSelect: () => startTransition(async () => {
        const { id } = await createNoteAction();
        router.push(`/n/${id}`);
      }),
    },
    { id: "dashboard", label: "Dashboard", group: "Actions", onSelect: () => router.push("/dashboard") },
    // The way to the promise on the consent screen. Issue 029.
    {
      id: "review", label: "What agents did", group: "Actions",
      keywords: ["agent", "claude", "revert", "undo", "review"],
      onSelect: () => router.push("/review"),
    },
    // The six words Kwabena searched before giving up, in his order. Issue 032.
    {
      id: "account", label: "Account, people and capture tokens", group: "Actions",
      keywords: ["invite", "member", "people", "family", "share", "add", "seat", "space"],
      onSelect: () => router.push("/account"),
    },
    // Wanted WHERE you are writing, not three screens away. ADR-116.
    {
      id: "theme", label: dark ? "Turn the lights up" : "Turn the lights down", group: "Actions",
      keywords: ["theme", "dark", "light", "night", "mode"],
      onSelect: () => { rememberTheme(nextTheme); applyTheme(nextTheme); setDark(!dark); },
    },
    ...notes,
  ];
}

/**
 * Reloaded whenever the palette opens, then filtered locally. The hundred most
 * recent and no more: the palette exposes no query to hang a server search on,
 * so past a hundred the Dashboard is the way back. Issues 010 and 053.
 */
function useRecentNotes(open: boolean): CommandItem[] {
  const router = useRouter();
  const [notes, setNotes] = useState<CommandItem[]>([]);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const recent = await listNotesAction();
      setNotes(recent.slice(0, 100).map((n) => ({
        id: n.id,
        label: n.title ?? "Untitled",
        description: n.preview,
        // `preview` stops at 180 characters; the words make the middle of a
        // long note findable too. Issue 016.
        keywords: n.words ? [n.words] : undefined,
        group: "Notes",
        onSelect: () => router.push(`/n/${n.id}`),
      })));
    });
  }, [router, open]);

  return notes;
}
