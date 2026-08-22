"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { canRecord, startRecording, type RecorderHandle } from "@/lib/recorder";
import {
  createRecordingSlotAction, finalizeRecordingAction, noteBlocksAction,
} from "@/app/actions/media";

/**
 * In-app recording, for long form: a meeting, a rant in the car.
 *
 * Short voice capture should go through Shortcuts dictation instead -- faster
 * for the person and free for us (docs/02). This is for the recordings that are
 * too long for that, and it is deliberately not the primary voice path.
 *
 * The upload happens on stop, not per chunk. That is a real limitation and it
 * is named here rather than hidden: a tab closed mid-recording loses the
 * recording. Eager chunk upload is the fix and it is not built.
 */
type Block = Awaited<ReturnType<typeof noteBlocksAction>>[number];

const POLL_MS = 4000;
const POLL_CEILING_MS = 30_000;

const clock = (ms: number) => {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

export function Recorder({ noteId, startSignal }: { noteId: string; startSignal: number }) {
  const handle = useRef<RecorderHandle | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poll = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seen = useRef(0);

  const [elapsed, setElapsed] = useState(0);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clips, setClips] = useState<Block[]>([]);

  const refresh = useCallback(async (delay = POLL_MS) => {
    const blocks = await noteBlocksAction(noteId);
    const audio = blocks.filter((b) => b.kind === "audio");
    setClips(audio);
    if (audio.some((b) => b.transcriptState === "pending")) {
      poll.current = setTimeout(
        () => void refresh(Math.min(delay * 1.5, POLL_CEILING_MS)), delay,
      );
    }
  }, [noteId]);

  useEffect(() => {
    void refresh();
    return () => {
      if (poll.current) clearTimeout(poll.current);
      if (timer.current) clearInterval(timer.current);
      handle.current?.cancel();
    };
  }, [refresh]);

  const stop = useCallback(async () => {
    const active = handle.current;
    if (!active) return;
    handle.current = null;
    if (timer.current) clearInterval(timer.current);
    setRecording(false);
    setBusy(true);

    try {
      const { blob, mimeType, durationMs } = await active.stop();
      if (blob.size === 0) { setError("Nothing was recorded."); return; }

      const slot = await createRecordingSlotAction(noteId, mimeType);
      if (!slot.ok) { setError(slot.message); return; }

      const put = await fetch(slot.slot.url, {
        method: "PUT", headers: slot.slot.headers, body: blob,
      });
      if (!put.ok) { setError("The recording did not upload. Try again."); return; }

      const done = await finalizeRecordingAction(slot.slot.blockId, {
        byteSize: blob.size, durationMs,
      });
      if (!done.ok) { setError(done.message ?? "That recording could not be saved."); return; }
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      setElapsed(0);
    }
  }, [noteId, refresh]);

  const begin = useCallback(async () => {
    setError(null);
    if (!canRecord()) {
      setError("This browser cannot record audio. Try the iOS Shortcut instead.");
      return;
    }
    try {
      handle.current = await startRecording();
      setRecording(true);
      const startedAt = Date.now();
      timer.current = setInterval(() => setElapsed(Date.now() - startedAt), 500);
    } catch {
      // Almost always a denied microphone permission, and saying so is more
      // useful than the browser's own error, which people do not see.
      setError("jotdojo could not reach your microphone. Check the site permissions.");
    }
  }, []);

  useEffect(() => {
    if (startSignal > seen.current) {
      seen.current = startSignal;
      if (recording) void stop();
      else void begin();
    }
  }, [startSignal, recording, begin, stop]);

  if (!recording && !busy && !error && clips.length === 0) return null;

  return (
    <div className="jd-chrome glass jd-recorder">
      {recording && (
        <div className="jd-recorder-live">
          <span aria-hidden className="jd-recorder-dot" />
          <span aria-live="polite">Recording {clock(elapsed)}</span>
          <button type="button" className="btn btn-xs btn-primary" onClick={() => void stop()}>
            Stop
          </button>
        </div>
      )}

      {busy && <p className="jd-transcript-note">Saving the recording&hellip;</p>}
      {error && <p className="jd-photos-error">{error}</p>}

      <ul className="jd-clips">
        {clips.map((b) => (
          <li key={b.id} className="jd-clip">
            <span aria-hidden className="jd-clip-glyph">{"\u25B6"}</span>
            <span className="jd-clip-text">
              {b.transcriptState === "pending" && "Transcribing\u2026"}
              {b.transcriptState === "failed" && "Saved, but not transcribed yet"}
              {b.transcriptState === "ready" && (b.transcript || "Nothing was said")}
            </span>
            {b.transcriptState === "ready" && b.confidence !== null && (
              <span className="badge badge-sm badge-soft">
                {Math.round((b.confidence ?? 0) * 100)}%
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
