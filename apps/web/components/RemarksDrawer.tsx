"use client";

import { useTransition } from "react";
import {
  Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle,
} from "@wizeworks/silicaui-react";
import type { CommentView } from "@jotacular/domain";
import { resolveCommentAction } from "@/app/actions";
import { useRemarks } from "@/lib/remarks";

/**
 * Everything the agent has said about this note, open and dealt with. ADR-061.
 *
 * A drawer rather than cards on the canvas. A remark is a piece of work with
 * its own clock -- "the MOT has a deadline" is a Thursday problem -- and work
 * you come back to needs somewhere to be kept, not somewhere to be caught.
 *
 * Resolved ones stay, greyed. "I already dealt with that" is a question people
 * ask, and a list that only shows what is outstanding cannot answer it.
 */
export function RemarksDrawer() {
  const remarks = useRemarks();
  const [pending, startTransition] = useTransition();
  if (!remarks) return null;

  const { all, open, drawer, setDrawer, markDone } = remarks;

  return (
    <Drawer open={drawer} onOpenChange={setDrawer}>
      <DrawerContent side="right" className="jd-remarks-drawer">
        <DrawerHeader sticky>
          <DrawerTitle>
            {open.length === 0
              ? "Nothing outstanding"
              : open.length === 1 ? "1 remark" : `${open.length} remarks`}
          </DrawerTitle>
          <DrawerClose>
            <button type="button" className="jd-tool" aria-label="Close">{"\u2715"}</button>
          </DrawerClose>
        </DrawerHeader>

        {all.length === 0 && (
          <p className="jd-remark-empty">
            Nothing from your agent on this page yet.
          </p>
        )}

        <div className="jd-remark-list">
          {[...all].reverse().map((c) => (
            <Remark
              key={c.id}
              comment={c}
              pending={pending}
              onDone={() => startTransition(async () => {
                markDone(c.id);
                await resolveCommentAction(c.id);
              })}
            />
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function Remark(
  { comment, pending, onDone }:
  { comment: CommentView; pending: boolean; onDone: () => void },
) {
  const settled = comment.resolvedAt !== null;
  return (
    <article className="jd-remark" data-settled={settled}>
      <div className="jd-remark-head">
        <span className="badge badge-agent badge-sm">{comment.authorLabel}</span>
        <span className="jd-remark-when">{relative(comment.createdAt)}</span>
        {settled
          ? <span className="jd-remark-when">Done</span>
          : (
            <button
              type="button"
              disabled={pending}
              className="btn btn-ghost btn-xs"
              onClick={onDone}
            >
              Done
            </button>
          )}
      </div>
      <p className="jd-remark-body">{comment.body}</p>
    </article>
  );
}

const relative = (date: Date) => {
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
};
