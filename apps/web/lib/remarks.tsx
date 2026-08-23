"use client";

import {
  createContext, useCallback, useContext, useMemo, useState, type ReactNode,
} from "react";
import type { CommentView } from "@jotdojo/domain";

/**
 * Everything an agent has ever said about this note. ADR-061.
 *
 * Held apart from the live line on purpose. The line is about NOW -- it flashes
 * and falls back. A remark is a piece of work: "the MOT has a deadline" may not
 * be dealt with until Thursday, and something you have to come back to cannot
 * live somewhere that scrolls away.
 */

type Remarks = {
  all: CommentView[];
  open: CommentView[];
  drawer: boolean;
  setDrawer: (open: boolean) => void;
  /** Locally resolved, so a card leaves the moment Done is pressed rather than
   *  on the next server round trip. */
  markDone: (id: string) => void;
};

const Context = createContext<Remarks | null>(null);

export function RemarksProvider(
  { comments, children }: { comments: CommentView[]; children: ReactNode },
) {
  const [drawer, setDrawer] = useState(false);
  const [done, setDone] = useState<string[]>([]);

  const markDone = useCallback((id: string) => {
    setDone((all) => (all.includes(id) ? all : [...all, id]));
  }, []);

  const value = useMemo<Remarks>(() => {
    const all = comments.map((c) => (
      done.includes(c.id) && !c.resolvedAt ? { ...c, resolvedAt: new Date() } : c
    ));
    return {
      all,
      open: all.filter((c) => !c.resolvedAt),
      drawer,
      setDrawer,
      markDone,
    };
  }, [comments, done, drawer, markDone]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Null outside a canvas, so the chrome can be rendered without one. */
export function useRemarks(): Remarks | null {
  return useContext(Context);
}
