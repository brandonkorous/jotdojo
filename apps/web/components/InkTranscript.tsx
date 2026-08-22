"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getInkAction, correctTranscriptAction } from "@/app/actions";

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

/** Recognition settles 30s after the last stroke, then a worker picks it up. */
const POLL_MS = 4000;
const POLL_CEILING_MS = 30_000;

type Ink = Awaited<ReturnType<typeof getInkAction>>;

export function InkTranscript({ blockId }: { blockId: string | null }) {
  const [ink, setInk] = useState<Ink | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async (delay: number) => {
    if (!blockId) return;
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

  useEffect(() => {
    if (!blockId) return;
    void poll(POLL_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
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
        <p className="jd-transcript-note">Reading your handwriting&hellip;</p>
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
