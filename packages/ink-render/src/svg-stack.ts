import type { InkDocument, Stroke } from "@jotacular/domain";
import { escapeAttr, segments, stickerSvg, textLines } from "./svg-parts";
import { stackOf } from "./stack";

/**
 * Everything on the page, painted bottom to top in its one order. ADR-136.
 *
 * Consecutive strokes are painted as one run, so highlights within it stay a
 * single coat (ADR-132). A note brings its own strokes between its colour and
 * its words (ADR-134). Photos are not drawn here, as before (ADR-103).
 *
 * Recognition gets strokes alone, all of them: it never sees a note, an arrow
 * or a sticker, so it reads a note's handwriting with the rest.
 */
export function stackedBody(doc: InkDocument, recognition: boolean, text: boolean): string[] {
  if (!text) return inkLayer(doc.strokes, recognition);
  const strokes = new Map(doc.strokes.map((s) => [s.id, s]));
  const texts = new Map((doc.texts ?? []).map((t) => [t.id, t]));
  const stickers = new Map((doc.stickers ?? []).map((s) => [s.id, s]));
  const out: string[] = [];
  let run: Stroke[] = [];
  const flush = () => { out.push(...inkLayer(run, recognition)); run = []; };
  for (const item of stackOf(doc)) {
    if (item.kind === "stroke") { run.push(strokes.get(item.id)!); continue; }
    flush();
    if (item.kind === "text") {
      const box = texts.get(item.id)!;
      out.push(...textLines(box, escapeAttr, inkLayer(doc.strokes.filter((s) => s.in === box.id), recognition)));
    } else if (item.kind === "sticker") {
      out.push(...stickerSvg(stickers.get(item.id)!, escapeAttr));
    }
  }
  flush();
  return out;
}

/** Strokes as SVG: highlights solid inside ONE translucent group, so overlaps
 *  are one coat (ADR-132), then ink on top. Colour is dropped for recognition. */
export function inkLayer(strokes: readonly Stroke[], recognition: boolean): string[] {
  const ink = (st: Stroke) => (recognition ? "#000000" : escapeAttr(st.color));
  const marks = strokes.filter((st) => st.tool === "highlighter");
  const wash = marks.length === 0 ? [] : [
    `<g opacity="${recognition ? 0.25 : 0.35}">`,
    ...marks.flatMap((st) => segments(st, ink(st), 1)), "</g>",
  ];
  return [...wash, ...strokes.filter((st) => st.tool !== "highlighter")
    .flatMap((st) => segments(st, ink(st), 1))];
}
