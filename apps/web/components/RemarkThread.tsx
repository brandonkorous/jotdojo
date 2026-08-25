"use client";

import type { Thread } from "@/lib/remark-threads";
import { Remark, RemarkComposer } from "./Remark";

/**
 * One conversation: what has been said, and the box for the next thing.
 * ADR-107.
 *
 * Rendered by the popup on the canvas and by the drawer, unchanged. They are
 * two ways to reach the same thread, and a thread that looked different
 * depending on which door you came through would be two threads.
 */
export function RemarkThread({ thread }: { thread: Thread }) {
  return (
    <div className="jd-remark-thread">
      {thread.comments.length === 0 && (
        <p className="jd-remark-empty">{empty(thread)}</p>
      )}
      {thread.comments.map((c) => <Remark key={c.id} comment={c} />)}
      <RemarkComposer anchorId={thread.anchorId} placeholder={prompt(thread)} />
    </div>
  );
}

/**
 * What a thread is ABOUT, in one line.
 *
 * No label means nobody has looked at the page yet, which is not the same as
 * the object being gone -- `labelsFor` names an erased one outright, so the
 * fallback here has to stay neutral.
 */
export function threadTitle(thread: Thread): string {
  if (thread.anchorId === null) return "This page";
  return thread.label ?? "Something on this page";
}

const empty = (thread: Thread) => (thread.anchorId === null
  ? "Nothing about this page yet."
  : "Nothing about this yet.");

const prompt = (thread: Thread) => (thread.anchorId === null
  ? "Something about this page"
  : "Something about this");
