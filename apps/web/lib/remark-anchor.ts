import type { InkEngine } from "./ink-engine";
import { describe, locate } from "./ink-engine-page";
import { clientRect } from "./ink-screen";

/**
 * Where the thing somebody commented on is, right now, on the glass. ADR-107.
 *
 * The popup follows its object rather than being placed once, so panning the
 * page carries the conversation along with the note it is about. Everything
 * here reads the engine and changes nothing, which is what makes it safe to
 * call from a frame loop.
 */

/** Padding between an object's corner and the popup that hangs off it. */
const GAP = 12;

/**
 * What the canvas calls each commented object, for the drawer's headings.
 *
 * An object that is not there gets a name too, and it is not the same as
 * having no name yet: "no label" means nobody has looked at the page, and the
 * drawer must not report that as an erasure.
 */
export function labelsFor(
  engine: InkEngine, anchorIds: readonly string[],
): Record<string, string> {
  const page = engine.objects;
  const out: Record<string, string> = {};
  for (const id of anchorIds) out[id] = describe(page, id) ?? "No longer on the page";
  return out;
}

/** The object's rectangle in viewport coordinates, or null once it is gone. */
export function anchorRect(engine: InkEngine, anchorId: string): DOMRect | null {
  const at = locate(engine.objects, anchorId);
  return at ? clientRect(engine.surface, engine.view, at) : null;
}

/**
 * Where a popup of this size should sit beside that object.
 *
 * To the right of its top corner by default, flipped to the left when the
 * right edge of the window is closer than the popup is wide, and clamped so it
 * can never hang off the bottom. Nothing here scrolls, so a popup that left
 * the window would simply be gone.
 */
export function placeBeside(
  at: DOMRect, size: { w: number; h: number },
  view: { w: number; h: number },
): { left: number; top: number } {
  const right = at.right + GAP;
  const left = right + size.w > view.w - GAP ? at.left - GAP - size.w : right;
  const top = at.top;
  return {
    left: clamp(left, GAP, Math.max(GAP, view.w - size.w - GAP)),
    top: clamp(top, GAP, Math.max(GAP, view.h - size.h - GAP)),
  };
}

/**
 * Pan the camera until that object is in the middle of the screen.
 *
 * A PAN, never a zoom. Somebody who has set a page to the size they like it
 * and then asked where a comment is does not also want the magnification
 * changed underneath them.
 */
export function bringIntoView(engine: InkEngine, anchorId: string): boolean {
  const at = locate(engine.objects, anchorId);
  if (!at) return false;
  const { view, surface } = engine;
  const r = surface.rect();
  engine.view.panBy(
    r.width / 2 - (view.x + (at.x + at.w / 2) * view.k),
    r.height / 2 - (view.y + (at.y + at.h / 2) * view.k),
  );
  engine.onView();
  return true;
}

const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));
