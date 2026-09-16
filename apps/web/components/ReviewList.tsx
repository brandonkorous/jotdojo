"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { AgentChange } from "@jotacular/domain";
import { revertAction } from "@/app/actions/review";

/**
 * What agents have done, and one tap to undo it. ADR-004, ADR-037, issue 029.
 *
 * The copy is docs/11's, near enough word for word — "Claude appended 2 blocks
 * to 'Napkin idea'. [Keep] [Revert]" — flat and factual. It reports the thing
 * that happened and never guesses at why.
 *
 * Violet is the agent's colour and nothing else's (design.md §11), so the mark
 * beside each row is the same signal a comment already uses on the canvas.
 */

/** What the agent did, in a person's words. `summary` is the revision's own
 *  verb, and an unknown one is printed rather than guessed at. */
function said(change: AgentChange): string {
  const who = change.agentName ?? "An agent";
  const what = change.noteTitle ? `“${change.noteTitle}”` : "a note";
  if (change.summary === "created") return `${who} wrote ${what}.`;
  if (change.summary === "edited") return `${who} changed ${what}.`;
  return `${who} ${change.summary ?? "changed"} ${what}.`;
}

/** Whole words, because "2h" is a developer's shorthand for a timestamp. */
function when(at: Date): string {
  const mins = Math.round((Date.now() - at.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} hours ago`;
  return `${Math.round(mins / 1440)} days ago`;
}

export function ReviewList({ changes }: { changes: AgentChange[] }) {
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState<Record<string, string>>({});

  if (changes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-base-300 p-6 text-sm jd-quiet">
        Nothing yet. When an agent writes a note or adds to one, it appears here with
        a way to take it back.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {changes.map((c) => (
        <li key={c.revisionId} className="rounded-lg border border-base-300 p-4">
          <div className="flex items-start gap-3">
            <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#7C5CFF]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm">{said(c)}</p>
              <p className="mt-1 text-xs jd-quiet">
                {c.agentModel ? `${c.agentModel} · ` : ""}via MCP · {when(c.createdAt)}
              </p>
              {failed[c.revisionId] && (
                <p className="mt-2 text-xs opacity-70">{failed[c.revisionId]}</p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link href={`/n/${c.noteId}`} className="btn btn-ghost btn-sm">Open</Link>
              {c.revertedAt ? (
                // Kept in the list on purpose: "what has this agent been doing"
                // is the question that matters after something goes wrong.
                <span className="text-xs jd-quiet">Taken back</span>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={pending}
                  onClick={() => startTransition(async () => {
                    const r = await revertAction(c.revisionId);
                    if (!r.ok) setFailed((f) => ({ ...f, [c.revisionId]: r.why ?? "" }));
                  })}
                >
                  Revert
                </button>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
