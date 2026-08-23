"use client";

import { useState } from "react";
import { correctTranscriptAction } from "@/app/actions";

/**
 * What the machine read, and the way to disagree with it. ADR-061.
 *
 * Lives behind the live line now rather than in a panel of its own. It owns its
 * own editing state so that typing a correction does not republish the line on
 * every keystroke.
 */
const LOW_CONFIDENCE = 0.6;

export type Reading = {
  transcript: string | null;
  confidence: number | null;
};

export function TranscriptCard({
  blockId, reading, onCorrected,
}: {
  blockId: string;
  reading: Reading;
  onCorrected: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const confident = reading.confidence === null || reading.confidence >= LOW_CONFIDENCE;
  const byAuthor = reading.confidence === null && Boolean(reading.transcript);

  const save = async () => {
    setSaving(true);
    try {
      await correctTranscriptAction(blockId, draft);
      onCorrected(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
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
    );
  }

  return (
    <>
      <p className="jd-transcript-text">
        {reading.transcript || <em>No text on this page.</em>}
      </p>
      <div className="jd-transcript-foot">
        <span className={`badge badge-sm ${confident ? "badge-soft" : "badge-warning"}`}>
          {byAuthor
            ? "your wording"
            : `read at ${Math.round((reading.confidence ?? 0) * 100)}% confidence`}
        </span>
        <button
          type="button"
          className={`btn btn-xs ${confident ? "btn-ghost" : "btn-warning"}`}
          onClick={() => { setDraft(reading.transcript ?? ""); setEditing(true); }}
        >
          {confident ? "Fix" : "Fix this"}
        </button>
      </div>
    </>
  );
}
