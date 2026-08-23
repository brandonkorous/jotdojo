"use server";

import {
  heartbeat, leave, applyInkDelta, strokesSince, noteBody,
  type Presence, type InkDelta,
} from "@jotdojo/domain";
import { requireActor, captureActor } from "@/lib/session";

/**
 * The read and write halves of live updates. ADR-058.
 *
 * The stream itself is /api/live/[noteId] and carries nothing but ids; these
 * are what a client calls once it has been told something changed. Keeping the
 * two apart is the point -- authorization lives on the fetch, where row-level
 * security already is, rather than on a socket that has to remember.
 */

export type Catchup =
  | { ok: true; strokes: unknown[]; strokeCount: number; version: number }
  | { ok: false };

/**
 * The strokes added after `from`.
 *
 * Never throws: a device that has fallen behind is not in trouble, and the
 * commonest reason this fails is that somebody closed the note a moment ago.
 */
export async function strokesSinceAction(blockId: string, from: number): Promise<Catchup> {
  try {
    const { actor } = await captureActor();
    const tail = await strokesSince(actor, blockId, from);
    return { ok: true, ...tail };
  } catch {
    return { ok: false };
  }
}

/**
 * The typed body, for a device told that somebody else saved.
 *
 * Only ever adopted by a device with nothing unsaved of its own -- see
 * use-note-body.ts. Somebody mid-sentence keeps their sentence.
 */
export async function noteBodyAction(
  noteId: string,
): Promise<{ body: string; revision: number } | null> {
  try {
    const { actor } = await captureActor();
    const note = await noteBody(actor, noteId);
    return { body: note.body, revision: note.revision };
  } catch {
    return null;
  }
}

export type DeltaResult =
  | { ok: true; strokeCount: number; version: number }
  | { ok: false; message: string };

/**
 * Erase, move, recolour, delete -- anything that changes the middle of a page.
 *
 * Never throws, for the same reason appendStrokesAction does not: the caller is
 * holding the only copy of what it is trying to say, and an exception here
 * would be caught by a boundary that has no idea of that.
 */
export async function applyInkDeltaAction(
  blockId: string, delta: InkDelta,
): Promise<DeltaResult> {
  try {
    const { actor } = await captureActor();
    return { ok: true, ...(await applyInkDelta(actor, blockId, delta)) };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

/**
 * Still here, and possibly still writing.
 *
 * An empty list is a valid answer and the one an anonymous draft always gets:
 * its cookie is host-only, so there is no second device to be present on.
 */
export async function heartbeatAction(
  noteId: string, deviceId: string, writing: boolean,
): Promise<Presence[]> {
  try {
    return await heartbeat(await requireActor(), noteId, deviceId, writing);
  } catch {
    return [];
  }
}

export async function leaveNoteAction(noteId: string, deviceId: string): Promise<void> {
  try {
    await leave(await requireActor(), noteId, deviceId);
  } catch {
    // Best effort by nature -- this rides on pagehide. The presence TTL is
    // what actually guarantees somebody stops being shown.
  }
}
