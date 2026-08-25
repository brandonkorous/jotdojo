"use client";

import { useState, useTransition } from "react";
import { Button, Textarea } from "@wizeworks/silicaui-react";
import type { CommentView } from "@jotacular/domain";
import { resolveCommentAction } from "@/app/actions";
import { useRemarks } from "@/lib/remarks";

/**
 * One thing somebody said, and the box for saying the next one. ADR-107.
 *
 * The two live together because they are the same object at two moments, and
 * because a comment and the reply to it must look like the same material --
 * the drawer and the popup on the canvas both render this pair and must not
 * drift into two dialects of the same card.
 *
 * An agent's card carries the agent ink and a label naming the client; yours
 * carries neither. docs/10: colour is the fast signal, the label is the
 * accessible one, and colour is never on its own.
 */
export function Remark({ comment }: { comment: CommentView }) {
  const remarks = useRemarks();
  const [pending, startTransition] = useTransition();
  const settled = comment.resolvedAt !== null;

  return (
    <article
      className="jd-remark"
      data-settled={settled}
      data-who={comment.authorType}
    >
      <header className="jd-remark-head">
        <span className="jd-remark-who">{comment.authorLabel}</span>
        <span className="jd-remark-when">{relative(comment.createdAt)}</span>
        {settled ? <span className="jd-remark-done">Done</span> : (
          <button
            type="button"
            disabled={pending}
            className="jd-remark-settle"
            onClick={() => startTransition(async () => {
              remarks?.markDone(comment.id);
              await resolveCommentAction(comment.id);
            })}
          >
            Mark done
          </button>
        )}
      </header>
      <p className="jd-remark-body">{comment.body}</p>
    </article>
  );
}

/**
 * Saying something.
 *
 * Enter sends and Shift-Enter breaks the line, which is the wrong way round
 * for an essay and the right way round here: a comment on a canvas is a
 * sentence, and reaching for a button after every one of them is friction the
 * capture contract does not tolerate.
 */
export function RemarkComposer(
  { anchorId, placeholder }: { anchorId: string | null; placeholder: string },
) {
  const remarks = useRemarks();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    const body = text.trim();
    if (!body || sending || !remarks) return;
    setSending(true);
    // Cleared FIRST, and put back only if the send failed. Anything else means
    // typing the next sentence into a box that empties underneath you.
    setText("");
    try {
      await remarks.say(body, anchorId);
    } catch {
      setText(body);
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      className="jd-remark-composer"
      onSubmit={(e) => { e.preventDefault(); void send(); }}
    >
      <Textarea
        rows={2}
        value={text}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.shiftKey) return;
          e.preventDefault();
          void send();
        }}
      />
      <Button type="submit" size="sm" color="primary" disabled={!text.trim() || sending}>
        Say it
      </Button>
    </form>
  );
}

const relative = (date: Date) => {
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
};
