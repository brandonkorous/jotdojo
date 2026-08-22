"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createPhotoSlotAction, finalizePhotoAction, photoUrlAction, noteBlocksAction,
} from "@/app/actions/media";

/**
 * Photo capture and the strip of what has been captured.
 *
 * `capture="environment"` asks a phone for the rear camera directly instead of
 * the photo library, which is the difference between "photograph this napkin"
 * being one tap and being four.
 *
 * The upload does NOT pass through our server: the action hands back a
 * time-limited URL and the browser PUTs the bytes straight at storage
 * (docs/04). On a phone over a slow connection that is the whole difference
 * between a capture that lands and one that times out.
 */
type Block = Awaited<ReturnType<typeof noteBlocksAction>>[number];

const POLL_MS = 3000;
const POLL_CEILING_MS = 20_000;

export function Photos({
  noteId, openSignal,
}: {
  noteId: string;
  /** Increments when the camera tool is tapped. */
  openSignal: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Block[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opened = useRef(0);

  const refresh = useCallback(async (delay = POLL_MS) => {
    const blocks = await noteBlocksAction(noteId);
    const images = blocks.filter((b) => b.kind === "image");
    setPhotos(images);

    setUrls((current) => {
      const missing = images.filter((b) => !current[b.id]);
      for (const b of missing) {
        void photoUrlAction(b.id).then((u) => {
          if (u) setUrls((prev) => ({ ...prev, [b.id]: u }));
        });
      }
      return current;
    });

    // Only while something is still being read. A note sitting open all
    // afternoon should not poll forever for a caption that already arrived.
    if (images.some((b) => b.transcriptState === "pending")) {
      timer.current = setTimeout(
        () => void refresh(Math.min(delay * 1.5, POLL_CEILING_MS)), delay,
      );
    }
  }, [noteId]);

  useEffect(() => {
    void refresh();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [refresh]);

  useEffect(() => {
    if (openSignal > opened.current) {
      opened.current = openSignal;
      fileRef.current?.click();
    }
  }, [openSignal]);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const slot = await createPhotoSlotAction(noteId, file.type || "image/jpeg");
      if (!slot.ok) { setError(slot.message); return; }

      const put = await fetch(slot.slot.url, {
        method: "PUT", headers: slot.slot.headers, body: file,
      });
      if (!put.ok) {
        setError("The photo did not upload. It is still on your device \u2014 try again.");
        return;
      }

      const done = await finalizePhotoAction(slot.slot.blockId, { byteSize: file.size });
      if (!done.ok) { setError(done.message ?? "That photo could not be saved."); return; }
      await refresh();
    } catch {
      setError("The photo did not upload. It is still on your device \u2014 try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />

      {(photos.length > 0 || busy || error) && (
        <div className="jd-chrome glass jd-photos">
          {error && <p className="jd-photos-error">{error}</p>}
          {busy && <p className="jd-transcript-note">Adding your photo&hellip;</p>}
          <ul className="jd-photo-strip">
            {photos.map((b) => (
              <li key={b.id} className="jd-photo">
                {urls[b.id]
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={urls[b.id]} alt={b.transcript ?? "Photo"} />
                  : <span className="jd-photo-placeholder" aria-hidden />}
                <span className="jd-photo-caption">
                  {b.transcriptState === "pending" && "Reading\u2026"}
                  {b.transcriptState === "failed" && "Saved, but not read"}
                  {b.transcriptState === "ready" && (b.transcript || "Nothing written on it")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
