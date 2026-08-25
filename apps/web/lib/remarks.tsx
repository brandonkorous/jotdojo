"use client";

import {
  createContext, useCallback, useContext, useMemo, useState, type ReactNode,
} from "react";
import type { CommentView } from "@jotacular/domain";
import { commentOnNoteAction } from "@/app/actions";
import { pinsOf, threadsOf, type PinCount, type Thread } from "./remark-threads";

/**
 * Everything anybody has said about this note, and about the things on it.
 * ADR-061, ADR-107.
 *
 * Held apart from the live line on purpose. The line is about NOW -- it flashes
 * and falls back. A comment is a piece of work: "the MOT has a deadline" may
 * not be dealt with until Thursday, and something you have to come back to
 * cannot live somewhere that scrolls away.
 */

type Remarks = {
  all: CommentView[];
  open: CommentView[];
  /** Grouped by what each one is about, page thread first. */
  threads: Thread[];
  /** One per commented object, for the marks on the canvas. */
  pins: PinCount[];
  /** The list of everything. */
  drawer: boolean;
  setDrawer: (open: boolean) => void;
  /**
   * The one thread showing beside its object on the canvas, or null.
   *
   * Separate from the drawer, and both can be shut: they answer different
   * questions. "What is this note about" is a popup on the page; "what is
   * outstanding anywhere" is the drawer.
   */
  focus: string | null;
  openThread: (anchorId: string | null) => void;
  /** Locally resolved, so a card leaves the moment Done is pressed rather than
   *  on the next server round trip. */
  markDone: (id: string) => void;
  /** Say something, about the page or about one thing on it. */
  say: (body: string, anchorId: string | null) => Promise<void>;
  /** What the canvas calls each commented object. Pushed by the pins, which
   *  are the only part of this that can see the page. */
  setLabels: (labels: Record<string, string>) => void;
};

const Context = createContext<Remarks | null>(null);

export function RemarksProvider(
  { noteId, comments, children }:
  { noteId: string; comments: CommentView[]; children: ReactNode },
) {
  const [drawer, setDrawer] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [mine, setMine] = useState<CommentView[]>([]);
  const [labels, setLabelsState] = useState<Record<string, string>>({});

  const markDone = useCallback((id: string) => {
    setDone((all) => (all.includes(id) ? all : [...all, id]));
  }, []);

  /** Appended locally rather than revalidated. A `revalidatePath` here would
   *  re-render the page somebody is writing on to show them a sentence they
   *  just typed. */
  const say = useCallback(async (body: string, anchorId: string | null) => {
    const saved = await commentOnNoteAction(noteId, body, anchorId);
    setMine((all) => [...all, saved]);
  }, [noteId]);

  const openThread = useCallback((anchorId: string | null) => {
    setFocus(anchorId);
    if (anchorId !== null) setDrawer(false);
  }, []);

  /** Replaced wholesale rather than merged: an object erased on another device
   *  should stop having a name here, not keep the last one it had. */
  const setLabels = useCallback((next: Record<string, string>) => {
    setLabelsState((held) => (same(held, next) ? held : next));
  }, []);

  const value = useMemo<Remarks>(() => {
    // BY ID, because the two lists overlap. `mine` is the optimistic copy, and
    // the server list catches up on the next revalidation of this page --
    // which `resolveCommentAction` triggers, so pressing Done on your own
    // comment used to make a second one appear beside it.
    const seen = new Set(comments.map((c) => c.id));
    const all = [...comments, ...mine.filter((c) => !seen.has(c.id))].map((c) => (
      done.includes(c.id) && !c.resolvedAt ? { ...c, resolvedAt: new Date() } : c
    ));
    const threads = threadsOf(all, labels);
    return {
      all,
      open: all.filter((c) => !c.resolvedAt),
      threads,
      pins: pinsOf(threads),
      drawer,
      setDrawer,
      focus,
      openThread,
      markDone,
      say,
      setLabels,
    };
  }, [comments, mine, done, labels, drawer, focus, openThread, markDone, say, setLabels]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Null outside a canvas, so the chrome can be rendered without one. */
export function useRemarks(): Remarks | null {
  return useContext(Context);
}

/** Whether two label maps say the same thing. Cheap, and it stops a push per
 *  frame from re-rendering the drawer. */
function same(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
}
