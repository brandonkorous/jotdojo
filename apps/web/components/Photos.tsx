"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPhotoSlotAction, finalizePhotoAction } from "@/app/actions/media";
import { usePublish } from "@/lib/live-feed";

/**
 * Taking a photograph, and putting it on the page. ADR-103.
 *
 * `capture="environment"` asks a phone for the rear camera directly instead of
 * the photo library, which is the difference between "photograph this napkin"
 * being one tap and being four.
 *
 * The upload does NOT pass through our server: the action hands back a
 * time-limited URL and the browser PUTs the bytes straight at storage
 * (docs/04). On a phone over a slow connection that is the whole difference
 * between a capture that lands and one that times out.
 *
 * THERE IS NO STRIP ANY MORE. A photo used to land in a tray along the bottom
 * of the screen, where it could not be moved, could not be drawn on, could not
 * be put beside the note it was about -- and took 40% of a phone to say so. It
 * goes on the canvas now, and everything the canvas can already do to an object
 * works on it. This component is the camera and nothing else.
 *
 * IT RENDERS NO SURFACE OF ITS OWN. What the camera is doing goes on the live
 * line with everything else -- ADR-061 collapsed four status surfaces into that
 * one line, and a pill of our own floating over the foot of the page would be
 * the fifth. There is nothing to look at here but the picture that arrives.
 */
export function Photos({
  noteId, openSignal, onPlaced,
}: {
  noteId: string;
  /** Increments when the camera is chosen. */
  openSignal: number;
  /** Where the picture goes, once the bytes are safe. The canvas decides -- it
   *  is the thing that knows where somebody is looking. */
  onPlaced: (blockId: string, natural: { w: number; h: number }) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const opened = useRef(0);

  useEffect(() => {
    if (openSignal <= opened.current) return;
    opened.current = openSignal;
    // Reaching for the camera again is the retry, so the old failure stops
    // holding the line the moment somebody acts on it.
    setError(null);
    fileRef.current?.click();
  }, [openSignal]);

  /**
   * One clause, sentence case, no full stop -- the line never wraps, and a
   * message written as two sentences arrives as one of them plus an ellipsis.
   *
   * Nothing is said on success. The picture appearing on the page IS the
   * confirmation, and a line that repeats what somebody can already see is the
   * noise ADR-061 exists to remove.
   */
  usePublish(
    "photo",
    error
      ? { tone: "trouble" as const, line: error }
      : busy
        ? { tone: "standing" as const, line: "Adding your photo", rank: 1 }
        : null,
    [busy, error],
  );

  const upload = useCallback(async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      // Measured BEFORE the upload, from the file already in hand. Asking the
      // server afterwards would mean a photo appearing as a square and then
      // reshaping itself once a second request came back.
      const natural = await measure(file);
      const slot = await createPhotoSlotAction(noteId, file.type || "image/jpeg");
      if (!slot.ok) { setError(slot.message); return; }

      const put = await fetch(slot.slot.url, {
        method: "PUT", headers: slot.slot.headers, body: file,
      });
      if (!put.ok) return void setError(FAILED);

      const done = await finalizePhotoAction(slot.slot.blockId, {
        byteSize: file.size, width: natural.w, height: natural.h,
      });
      if (!done.ok) return void setError(done.message ?? "That photo could not be saved");
      onPlaced(slot.slot.blockId, natural);
    } catch {
      setError(FAILED);
    } finally {
      setBusy(false);
    }
  }, [noteId, onPlaced]);

  return (
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
  );
}

/** It is worth being precise that nothing was lost: the bytes are still on the
 *  device, and reaching for the camera again is the retry. */
const FAILED = "That photo did not upload — it is still on your device";

/**
 * How big the picture actually is.
 *
 * `createImageBitmap` where it exists, because it decodes off the main thread
 * and a phone photo is twelve megapixels. The `<img>` fallback is for older
 * Safari, and a square is the fallback's fallback -- a photo placed at the
 * wrong aspect ratio is still a photo somebody can drag, and losing the
 * capture over a measurement would not be.
 */
async function measure(file: File): Promise<{ w: number; h: number }> {
  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file);
      const size = { w: bitmap.width, h: bitmap.height };
      bitmap.close();
      return size;
    }
  } catch { /* fall through */ }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
