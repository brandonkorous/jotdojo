"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getInkAction, correctTranscriptAction } from "@/app/actions";
import { useLiveNote } from "@/lib/use-live";

/**
 * What the machine read, and the way to disagree with it.
 *
 * docs/08-ink.md: confidence is always carried and always shown. Below roughly
 * 0.6 the correction affordance stops being a quiet pencil icon and says so
 * outright, because a transcript nobody trusts and nobody can see is worse than
 * no transcript at all -- it will be quoted back by an agent as though it were
 * what the person wrote.
 */
const LOW_CONFIDENCE = 0.6;

/**
 * The fallback, not the mechanism. ADR-058.
 *
 * A reading arriving is pushed down the live stream the moment the worker
 * stores it, so this exists only for a browser whose stream never connected.
 * It used to be four seconds because it was the only way to find out.
 */
const POLL_MS = 15_000;
const POLL_CEILING_MS = 30_000;

/**
 * How long "reading your handwriting" is still true for.
 *
 * Past this the claim is a lie -- and the shape of the lie matters. Nothing is
 * wrong with the page: the ink is stored, and it is stored as strokes, so a
 * reader arriving next week reads it just as well. What is not happening is a
 * reading, either because the queue is long or because recognition is not
 * switched on for this space, and the UI cannot tell which. So it stops
 * claiming an action is in progress and says the part it knows.
 */
const PATIENCE_MS = 90_000;

type Ink = Awaited<ReturnType<typeof getInkAction>>;

export function InkTranscript(
  { noteId, blockId, live = false }:
  { noteId: string; blockId: string | null; live?: boolean },
) {
  const [ink, setInk] = useState<Ink | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  /** Set once the wait stops being a wait, so the card can stop promising. */
  const [waited, setWaited] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async (delay: number) => {
    if (!blockId) return;
    // Cancel whatever was already scheduled. There are now three callers -- the
    // mount, a live event and a reconnect -- and without this each would start
    // its own chain, only the last of which the cleanup can ever stop.
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    try {
      const next = await getInkAction(blockId);
      setInk(next);
      // Stop polling once there is an answer, one way or the other. Backing off
      // matters more than it looks: this is a server action per tick, and a
      // page left open all afternoon would otherwise hammer the database for
      // a transcript that already arrived.
      if (next.transcriptState === "pending" && next.strokeCount > 0) {
        timer.current = setTimeout(() => poll(Math.min(delay * 1.5, POLL_CEILING_MS)), delay);
      }
    } catch {
      timer.current = setTimeout(() => poll(Math.min(delay * 2, POLL_CEILING_MS)), delay);
    }
  }, [blockId]);

  /** The worker finished reading this page. No wait, no poll interval. */
  useLiveNote(live && blockId ? noteId : null, {
    onBlock: (event) => { if (event.blockId === blockId) void poll(POLL_MS); },
    onResync: () => { void poll(POLL_MS); },
  });

  useEffect(() => {
    if (!blockId) return;
    setWaited(false);
    void poll(POLL_MS);
    // Polling continues -- a reading that arrives late should still appear.
    // Only the wording gives up, because only the wording was making a promise.
    const patience = setTimeout(() => setWaited(true), PATIENCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      clearTimeout(patience);
    };
  }, [blockId, poll]);

  if (!blockId || !ink || ink.strokeCount === 0) return null;

  const confident = ink.confidence === null || ink.confidence >= LOW_CONFIDENCE;
  const byAuthor = ink.confidence === null && Boolean(ink.transcript);

  const save = async () => {
    setSaving(true);
    try {
      await correctTranscriptAction(blockId, draft);
      setInk({ ...ink, transcript: draft, confidence: null, transcriptState: "ready" });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="jd-chrome glass jd-transcript">
      {ink.transcriptState === "pending" && (
        <p className="jd-transcript-note">
          {waited
            ? "Your ink is saved. Nothing has read it back yet."
            : "Reading your handwriting…"}
        </p>
      )}

      {ink.transcriptState === "failed" && (
        <p className="jd-transcript-note">
          {/* Precise on purpose. The page is fine; only the reading failed, and
              saying "could not save" would be a lie that causes panic. */}
          Your ink is saved. Reading it did not work &mdash; it will try again.
        </p>
      )}

      {ink.transcriptState === "ready" && ink.transcript !== null && !editing && (
        <>
          <p className="jd-transcript-text">{ink.transcript || <em>No text on this page.</em>}</p>
          <div className="jd-transcript-foot">
            <span className={`badge badge-sm ${confident ? "badge-soft" : "badge-warning"}`}>
              {byAuthor
                ? "your wording"
                : `read at ${Math.round((ink.confidence ?? 0) * 100)}% confidence`}
            </span>
            <button
              type="button"
              className={`btn btn-xs ${confident ? "btn-ghost" : "btn-warning"}`}
              onClick={() => { setDraft(ink.transcript ?? ""); setEditing(true); }}
            >
              {confident ? "Fix" : "Fix this"}
            </button>
          </div>
        </>
      )}

      {editing && (
        <div className="jd-transcript-edit">
          <textarea
            autoFocus
            className="textarea w-full"
            style={{ fontSize: 16 }}
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="What this says"
          />
          <div className="jd-transcript-foot">
            <span className="text-xs opacity-60">
              Your version is final. Nothing will re-read this page.
            </span>
            <button type="button" className="btn btn-xs btn-ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-xs btn-primary" disabled={saving} onClick={save}>
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
