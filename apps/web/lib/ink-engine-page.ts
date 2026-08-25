import type { ImageOnPage, Stroke, TextBox } from "@jotacular/domain";
import { strokeBounds, type Bounds } from "./ink-geometry";
import { boxArea, imageArea } from "./ink-objects";

/**
 * Finding one named thing on the page, whatever kind of thing it is. ADR-107.
 *
 * Everything else on this canvas reasons about the three arrays separately,
 * because that is how they are stored and how they behave -- a photograph is
 * not a stroke and never wants the same code. A comment is the first thing
 * that genuinely does not care: it was left on THAT, and THAT is one of three
 * kinds it never chose between.
 *
 * Pure, and no DOM. `ink-pins.ts` draws what these two functions find.
 */
export type Page = {
  strokes: readonly Stroke[];
  texts: readonly TextBox[];
  images: readonly ImageOnPage[];
};

/**
 * Where a named object is, or null once it is gone.
 *
 * Null is an ordinary answer, not an error. Erasing the thing a comment is
 * about does not erase the comment -- what somebody said is still true of a
 * page that used to have it on -- so a page always has to be able to say "not
 * here any more" without anything breaking.
 */
export function locate(page: Page, id: string): Bounds | null {
  const box = page.texts.find((b) => b.id === id);
  if (box) return boxArea(box);
  const image = page.images.find((i) => i.id === id);
  if (image) return imageArea(image);
  const stroke = page.strokes.find((s) => s.id === id);
  return stroke ? strokeBounds([stroke]) : null;
}

/**
 * What a named object IS, in words, for a list that has to say which one.
 *
 * A drawer holding five threads from five unrelated notes is unreadable
 * without this: "3 comments" says nothing about which note. A typed note can
 * say what it says, and the other two kinds get named rather than quoted.
 */
export function describe(page: Page, id: string): string | null {
  const box = page.texts.find((b) => b.id === id);
  if (box) return summarise(box.text) || "an empty note";
  if (page.images.some((i) => i.id === id)) return "a photo";
  if (page.strokes.some((s) => s.id === id)) return "something drawn";
  return null;
}

/** The first line, shortened. Never mid-word: a title cut to "the mortg" reads
 *  as a bug rather than as a summary. */
function summarise(text: string, limit = 42): string {
  const line = text.trim().split("\n")[0]?.trim() ?? "";
  if (line.length <= limit) return line;
  const cut = line.slice(0, limit);
  const space = cut.lastIndexOf(" ");
  return `${(space > limit / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
