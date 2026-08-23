"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Presence } from "@jotacular/domain";
import { heartbeatAction, leaveNoteAction } from "@/app/actions/live";
import { deviceId } from "./device";

/**
 * Who else has this note open. ADR-058.
 *
 * The heartbeat is a poll and unashamedly so: it is one small write every
 * fifteen seconds, it doubles as the read, and it expires by itself if the tab
 * is closed by a train going into a tunnel. A stream would have to solve
 * departure, which is the hard half of presence and the half a timeout solves
 * for free.
 */

const BEAT_MS = 15_000;
/** How long one keystroke keeps claiming "writing", client-side. Shorter than
 *  the server's window, so the claim is renewed rather than flickering. */
const WRITING_MS = 4_000;

export function usePresence(noteId: string, enabled: boolean) {
  const [here, setHere] = useState<Presence[]>([]);
  const wroteAt = useRef(0);
  const beatAt = useRef(0);
  const device = useRef("");

  const beat = useCallback(async () => {
    if (!enabled) return;
    device.current ||= deviceId();
    beatAt.current = Date.now();
    setHere(await heartbeatAction(noteId, device.current, Date.now() - wroteAt.current < WRITING_MS));
  }, [noteId, enabled]);

  /**
   * Called on every keystroke and every stroke, so it must stay cheap.
   *
   * It only records the time. The beat that follows is what tells anybody, and
   * it is sent early only when this is the START of writing -- otherwise
   * somebody typing a paragraph would send a request per character.
   */
  const writing = useCallback(() => {
    const first = Date.now() - wroteAt.current >= WRITING_MS;
    wroteAt.current = Date.now();
    if (first && Date.now() - beatAt.current > 2000) void beat();
  }, [beat]);

  useEffect(() => {
    if (!enabled) return;
    void beat();
    const timer = setInterval(() => void beat(), BEAT_MS);

    // Best effort, and the TTL is the real guarantee -- `pagehide` is not
    // delivered reliably anywhere, least of all on iOS.
    const goodbye = () => { void leaveNoteAction(noteId, device.current || deviceId()); };
    window.addEventListener("pagehide", goodbye);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", goodbye);
      goodbye();
    };
  }, [noteId, enabled, beat]);

  /** Everyone but this tab. What the UI is actually about. */
  const others = here.filter((p) => p.deviceId !== device.current);
  return { others, writing, refresh: beat };
}
