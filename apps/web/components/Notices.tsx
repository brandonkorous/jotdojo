"use client";

import { useState, useTransition } from "react";
import { resolveCommentAction } from "@/app/actions";
import type { CommentView } from "@jotdojo/domain";

/**
 * What an agent said about this note. ADR-004, ADR-048.
 *
 * The agent's only way of speaking is a comment, and this is where a comment
 * is heard. It sits at the foot of the canvas rather than beside the text,
 * because the page belongs to whoever wrote on it -- a remark is a visitor.
 *
 * Indigo and a label, never colour alone. docs/10-design-system.md.
 */
export function Notices({ comments }: { comments: CommentView[] }) {
  const open = comments.filter((c) => !c.resolvedAt);
  const [shown, setShown] = useState(true);
  const [pending, startTransition] = useTransition();

  if (open.length === 0) return null;

  if (!shown) {
    return (
      <button
        type="button"
        onClick={() => setShown(true)}
        className="jd-notices btn btn-sm border-agent text-agent"
      >
        {open.length === 1 ? "1 remark" : `${open.length} remarks`}
      </button>
    );
  }

  return (
    <aside className="jd-notices flex flex-col gap-2" aria-label="What your agent noticed">
      {open.map((c) => (
        <article
          key={c.id}
          className="glass rounded-2xl border border-agent px-4 py-3 shadow-sm"
        >
          <div className="mb-1 flex items-baseline gap-2">
            <span className="badge badge-agent badge-sm">{c.authorLabel}</span>
            <span className="text-xs opacity-50">{relative(c.createdAt)}</span>
            <button
              type="button"
              disabled={pending}
              className="btn btn-ghost btn-xs ml-auto"
              onClick={() => startTransition(async () => {
                await resolveCommentAction(c.id);
              })}
            >
              Done
            </button>
          </div>
          <p className="text-sm">{c.body}</p>
        </article>
      ))}
      <button
        type="button"
        onClick={() => setShown(false)}
        className="btn btn-ghost btn-xs self-end"
      >
        Hide
      </button>
    </aside>
  );
}

const relative = (date: Date) => {
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
};
