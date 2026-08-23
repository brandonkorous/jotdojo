"use server";

import {
  createMediaBlock, finalizeMedia, mediaUrl, getNote,
} from "@jotacular/domain";
import { requireActor } from "@/lib/session";

/**
 * Photos and voice. docs/07-capture-pipeline.md.
 *
 * Split out of app/actions.ts rather than kept with the note actions: these
 * three talk to blob storage and hand back time-limited URLs, which is a
 * different job from writing a row.
 */

// --- photos ---------------------------------------------------------------
// docs/07-capture-pipeline.md

export type PhotoSlot = {
  blockId: string;
  url: string;
  headers: Record<string, string>;
};

export async function createPhotoSlotAction(
  noteId: string, contentType: string,
): Promise<{ ok: true; slot: PhotoSlot } | { ok: false; message: string }> {
  try {
    const slot = await createMediaBlock(await requireActor(), noteId, "image", contentType);
    return { ok: true, slot: { blockId: slot.blockId, url: slot.url, headers: slot.headers } };
  } catch (err) {
    // Structured, not thrown: the caller is holding a photo and needs to know
    // whether to keep it or let go of it.
    return { ok: false, message: (err as Error).message };
  }
}

export async function finalizePhotoAction(
  blockId: string, meta: { byteSize: number; width?: number; height?: number },
): Promise<{ ok: boolean; message?: string }> {
  try {
    await finalizeMedia(await requireActor(), blockId, meta);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

/** Time-limited, re-fetched on demand. Never stored in the page. */
export async function photoUrlAction(blockId: string): Promise<string | null> {
  try {
    return await mediaUrl(await requireActor(), blockId);
  } catch {
    return null;
  }
}

export async function noteBlocksAction(noteId: string) {
  return (await getNote(await requireActor(), noteId)).blocks ?? [];
}

// --- voice ----------------------------------------------------------------

export async function createRecordingSlotAction(
  noteId: string, contentType: string,
): Promise<{ ok: true; slot: PhotoSlot } | { ok: false; message: string }> {
  try {
    const slot = await createMediaBlock(await requireActor(), noteId, "audio", contentType);
    return { ok: true, slot: { blockId: slot.blockId, url: slot.url, headers: slot.headers } };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

export async function finalizeRecordingAction(
  blockId: string, meta: { byteSize: number; durationMs: number },
): Promise<{ ok: boolean; message?: string }> {
  try {
    await finalizeMedia(await requireActor(), blockId, meta);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}
