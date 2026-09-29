import type { MediaClip } from "@jotacular/domain";

/**
 * One photograph on the plane, drawn as a polaroid: a frame, the picture
 * inside it with its own rounded corners, and a line in the deep bottom band.
 * ADR-127. The frame is what moves and turns; the picture only fills it.
 */
export type Print = { frame: HTMLElement; img: HTMLImageElement; meta: HTMLElement };

export function makePrint(blockId: string): Print {
  const frame = document.createElement("div");
  frame.className = "jd-plane-image";
  frame.dataset.block = blockId;
  const img = document.createElement("img");
  img.className = "jd-print-img";
  // Empty until the block's caption is known; a filename is not a description.
  img.alt = "";
  img.draggable = false;
  // Bytes that will not load show nothing, not an empty frame claiming a photo.
  img.onerror = () => { frame.dataset.broken = "true"; };
  img.onload = () => { delete frame.dataset.broken; };
  const meta = document.createElement("span");
  meta.className = "jd-print-meta";
  frame.append(img, meta);
  return { frame, img, meta };
}

export function showPicture(print: Print, url: string) {
  if (print.img.src !== url) print.img.src = url;
}

/** The date it was added, as somebody would write it on the white edge. The
 *  vision caption becomes the picture's alt text rather than more ink. */
export function writeOn(print: Print, clip: MediaClip) {
  print.meta.textContent = written(clip.createdAt);
  if (clip.transcript) print.img.alt = clip.transcript.slice(0, 300);
}

export function written(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, {
    day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }),
  });
}
