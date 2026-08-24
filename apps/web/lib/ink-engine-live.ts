import type { ImageOnPage, Stroke, TextBox } from "@jotacular/domain";
import { mergePages, newcomers } from "./ink-merge";
import type { ObjectPlane } from "./ink-object-plane";

/**
 * What another device did to this page. ADR-058, ADR-103.
 *
 * Split from ink-engine.ts when photographs made a third thing to catch up and
 * the file reached its limit again. The seam is one the engine already draws in
 * its own comments: every method here is about somebody ELSE's edit arriving,
 * and the rule they all share is that the camera does not move and the
 * selection is not touched -- writing here must not scroll out from under
 * somebody because a laptop in the next room caught up.
 */

export type LivePage = {
  strokes: () => Stroke[];
  setStrokes: (strokes: Stroke[]) => void;
  plane: () => ObjectPlane | null;
  repaint: () => void;
  dropSelection: () => void;
};

export class LiveMerge {
  constructor(private readonly page: LivePage) {}

  /** Strokes somebody else drew. Nothing happens when there are none this page
   *  has not already got, which is the common answer while two people write. */
  strokes(incoming: Stroke[]) {
    const mine = this.page.strokes();
    if (newcomers(mine, incoming).length === 0) return;
    this.page.setStrokes(mergePages(mine, incoming));
    this.page.repaint();
  }

  /** Somebody else's text boxes. The box being typed into is not overwritten --
   *  the text layer protects its own caret. */
  texts(boxes: TextBox[]) { this.page.plane()?.texts.applyRemote(boxes); }

  /** The same for photographs, which have no caret to protect. */
  images(images: ImageOnPage[]) { this.page.plane()?.images.adopt(images); }

  /** Adopt the server's page, keeping what is still queued here. The selection
   *  goes, because the strokes it pointed at may not have survived. */
  reconcile(server: Stroke[], pending: readonly Stroke[]) {
    this.page.setStrokes(mergePages(server, pending));
    this.page.dropSelection();
    this.page.repaint();
  }
}
