"use client";

import { useState, useTransition } from "react";
import { deleteNoteAction, restoreNoteAction } from "@/app/dashboard-actions";

/**
 * Throwing a note away, and getting it back. Issue 013.
 *
 * Two words rather than one: `Remove` asks, because a list row is an easy
 * thing to hit by accident, and `Keep` says what happens rather than what
 * does not -- the wording Account's Disconnect already settled on.
 */
export function RemoveNote({ id }: { id: string }) {
  const [asking, setAsking] = useState(false);
  const [busy, start] = useTransition();

  if (!asking) {
    return (
      <button type="button" className="btn btn-ghost btn-xs jd-quiet"
        onClick={() => setAsking(true)}>
        Remove
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="jd-quiet">Throw this away?</span>
      <button type="button" className="btn btn-xs" disabled={busy}
        onClick={() => start(() => { void deleteNoteAction(id); })}>
        Remove
      </button>
      <button type="button" className="btn btn-ghost btn-xs" onClick={() => setAsking(false)}>
        Keep
      </button>
    </span>
  );
}

export function RestoreNote({ id }: { id: string }) {
  const [busy, start] = useTransition();
  return (
    <button type="button" className="btn btn-ghost btn-xs" disabled={busy}
      onClick={() => start(() => { void restoreNoteAction(id); })}>
      Put it back
    </button>
  );
}
