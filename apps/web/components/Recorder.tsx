"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { canRecord, startRecording, type RecorderHandle } from "@/lib/recorder";
import { createRecordingSlotAction, finalizeRecordingAction } from "@/app/actions/media";

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
const clock = (ms: number) => {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

/** Records, uploads, and hands the block to the page, which puts a voice card
 *  where somebody is looking. ADR-121. */
export function Recorder({ noteId, startSignal, onRecorded }: {
  noteId: string;
  startSignal: number;
  onRecorded: (blockId: string) => void;
}) {
  const handle = useRef<RecorderHandle | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const seen = useRef(0);

  const [elapsed, setElapsed] = useState(0);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    handle.current?.cancel();
  }, []);

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
      onRecorded(slot.slot.blockId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      setElapsed(0);
    }
  }, [noteId, onRecorded]);

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
      setError("Jotacular could not reach your microphone. Check the site permissions.");
    }
  }, []);

  useEffect(() => {
    if (startSignal > seen.current) {
      seen.current = startSignal;
      if (recording) void stop();
      else void begin();
    }
  }, [startSignal, recording, begin, stop]);

  if (!recording && !busy && !error) return null;

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
      {error && <p className="jd-recorder-error">{error}</p>}

    </div>
  );
}
